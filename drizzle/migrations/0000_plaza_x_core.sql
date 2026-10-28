-- =====================================================================
-- Plaza X · esquema principal
-- Marketplace multitienda con red de afiliados y pagos con Wompi.
--
-- Principios:
--   * Los precios, comisiones y repartos se calculan SIEMPRE en la base
--     de datos (funciones security definer), nunca se confía en el cliente.
--   * RLS activado en todas las tablas. Las escrituras sensibles (pedidos,
--     estados de envío, retiros) pasan por funciones con validación.
--   * La confirmación del pago solo la puede hacer el servidor (service
--     role) tras verificar la firma del evento de Wompi.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Parámetros del negocio (mismos valores que src/lib/plaza.ts)
-- ---------------------------------------------------------------------
create or replace function public.platform_rate() returns numeric
  language sql immutable as $$ select 0.09::numeric $$;
create or replace function public.affiliate_min() returns numeric
  language sql immutable as $$ select 0.03::numeric $$;
create or replace function public.affiliate_max() returns numeric
  language sql immutable as $$ select 0.20::numeric $$;
create or replace function public.min_withdrawal() returns integer
  language sql immutable as $$ select 50000 $$;
create or replace function public.hold_days() returns integer
  language sql immutable as $$ select 7 $$;

-- ---------------------------------------------------------------------
-- Perfiles
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  username    text unique check (username ~ '^[a-z0-9-]{3,30}$'),
  phone       text check (phone is null or phone ~ '^[0-9+ ]{7,20}$'),
  created_at  timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Tiendas (una por usuario)
-- ---------------------------------------------------------------------
create table public.stores (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null unique references public.profiles (id) on delete cascade,
  slug        text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  name        text not null check (char_length(name) between 2 and 60),
  tagline     text not null default '' check (char_length(tagline) <= 120),
  city        text not null default '' check (char_length(city) <= 40),
  emoji       text not null default '🛍️',
  whatsapp    text check (whatsapp is null or whatsapp ~ '^[0-9+ ]{7,20}$'),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Productos
-- ---------------------------------------------------------------------
create table public.products (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references public.stores (id) on delete cascade,
  name          text not null check (char_length(name) between 2 and 80),
  description   text not null default '' check (char_length(description) <= 2000),
  price         integer not null check (price between 1000 and 50000000),
  category      text not null check (category in ('Ropa', 'Alimentos', 'Artesanías', 'Campo', 'Hogar', 'Belleza', 'Tecnología', 'Otros')),
  commission    numeric(4, 3) not null default 0.10 check (commission between 0.03 and 0.20),
  stock         integer not null default 0 check (stock >= 0),
  images        text[] not null default '{}',
  emoji         text not null default '📦',
  active        boolean not null default true,
  sold_count    integer not null default 0,
  rating        numeric(2, 1) not null default 0,
  rating_count  integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index products_store_idx on public.products (store_id);
create index products_active_idx on public.products (active, category);
create index products_search_idx on public.products using gin (to_tsvector('spanish', name || ' ' || description));

create or replace function public.touch_updated_at() returns trigger
  language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Clics de afiliados (atribución 30 días)
-- ---------------------------------------------------------------------
create table public.referral_clicks (
  id            bigserial primary key,
  affiliate_id  uuid not null references public.profiles (id) on delete cascade,
  product_id    uuid references public.products (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index referral_clicks_aff_idx on public.referral_clicks (affiliate_id, created_at desc);

-- ---------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------
create table public.orders (
  id                    uuid primary key default gen_random_uuid(),
  reference             text not null unique,
  buyer_id              uuid not null references public.profiles (id),
  status                text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'cancelled')),
  total                 integer not null check (total > 0),
  affiliate_id          uuid references public.profiles (id),
  shipping              jsonb not null,
  wompi_transaction_id  text,
  paid_at               timestamptz,
  created_at            timestamptz not null default now()
);
create index orders_buyer_idx on public.orders (buyer_id, created_at desc);

create table public.order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders (id) on delete cascade,
  product_id        uuid references public.products (id) on delete set null,
  store_id          uuid not null references public.stores (id),
  product_name      text not null,
  product_emoji     text not null default '📦',
  product_image     text,
  unit_price        integer not null,
  qty               integer not null check (qty between 1 and 99),
  subtotal          integer not null,
  seller_amount     integer not null,
  affiliate_amount  integer not null default 0,
  platform_amount   integer not null,
  affiliate_id      uuid references public.profiles (id),
  paid_at           timestamptz,          -- se copia del pedido al confirmar el pago
  fulfillment       text not null default 'pending' check (fulfillment in ('pending', 'preparing', 'shipped', 'delivered', 'cancelled')),
  tracking          text,
  delivered_at      timestamptz,
  created_at        timestamptz not null default now()
);
create index order_items_store_idx on public.order_items (store_id, created_at desc);
create index order_items_aff_idx on public.order_items (affiliate_id, created_at desc);

-- ---------------------------------------------------------------------
-- Retiros (billetera única: ganancias de vendedor + afiliado)
-- ---------------------------------------------------------------------
create table public.withdrawals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  amount      integer not null check (amount >= 50000),
  method      text not null check (method in ('nequi', 'daviplata', 'bancolombia')),
  account     text not null check (char_length(account) between 7 and 30),
  status      text not null default 'requested' check (status in ('requested', 'paid', 'rejected')),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Reseñas (solo compradores con entrega confirmada)
-- ---------------------------------------------------------------------
create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  author      text not null default '',
  rating      integer not null check (rating between 1 and 5),
  comment     text not null default '' check (char_length(comment) <= 600),
  created_at  timestamptz not null default now(),
  unique (product_id, user_id)
);

create or replace function public.refresh_product_rating() returns trigger
  language plpgsql security definer set search_path = public as $$
declare pid uuid := coalesce(new.product_id, old.product_id);
begin
  update products p
     set rating = coalesce((select round(avg(r.rating)::numeric, 1) from reviews r where r.product_id = pid), 0),
         rating_count = (select count(*) from reviews r where r.product_id = pid)
   where p.id = pid;
  return null;
end $$;
create trigger reviews_rating after insert or update or delete on public.reviews
  for each row execute function public.refresh_product_rating();

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles        enable row level security;
alter table public.stores          enable row level security;
alter table public.products        enable row level security;
alter table public.referral_clicks enable row level security;
alter table public.orders          enable row level security;
alter table public.order_items     enable row level security;
alter table public.withdrawals     enable row level security;
alter table public.reviews         enable row level security;

-- Perfiles: cada quien ve y edita el suyo.
create policy "perfil propio: leer" on public.profiles for select using (id = auth.uid());
create policy "perfil propio: editar" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- Tiendas: públicas si están activas; el dueño las administra.
create policy "tiendas: leer" on public.stores for select using (active or owner_id = auth.uid());
create policy "tiendas: crear" on public.stores for insert with check (owner_id = auth.uid());
create policy "tiendas: editar" on public.stores for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Productos: públicos si están activos y su tienda también.
create policy "productos: leer" on public.products for select using (
  (active and exists (select 1 from stores s where s.id = store_id and s.active))
  or exists (select 1 from stores s where s.id = store_id and s.owner_id = auth.uid())
);
create policy "productos: crear" on public.products for insert with check (
  exists (select 1 from stores s where s.id = store_id and s.owner_id = auth.uid())
);
create policy "productos: editar" on public.products for update using (
  exists (select 1 from stores s where s.id = store_id and s.owner_id = auth.uid())
) with check (
  exists (select 1 from stores s where s.id = store_id and s.owner_id = auth.uid())
);
create policy "productos: borrar" on public.products for delete using (
  exists (select 1 from stores s where s.id = store_id and s.owner_id = auth.uid())
);
-- El vendedor no puede alterar contadores ni calificaciones: solo las funciones internas.
create or replace function public.protect_product_counters() returns trigger
  language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.sold_count := old.sold_count;
    new.rating := old.rating;
    new.rating_count := old.rating_count;
  end if;
  return new;
end $$;
create trigger products_protect_counters before update on public.products
  for each row execute function public.protect_product_counters();

-- Clics: el afiliado ve los suyos. Se registran por RPC.
create policy "clics: leer propios" on public.referral_clicks for select using (affiliate_id = auth.uid());

-- Funciones auxiliares (security definer) para evitar recursión entre políticas.
create or replace function public.is_order_buyer(p_order_id uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from orders where id = p_order_id and buyer_id = auth.uid())
$$;
create or replace function public.is_order_seller(p_order_id uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from order_items oi join stores s on s.id = oi.store_id
     where oi.order_id = p_order_id and s.owner_id = auth.uid()
  )
$$;

-- Pedidos: el comprador y las tiendas involucradas.
create policy "pedidos: leer" on public.orders for select using (
  buyer_id = auth.uid() or public.is_order_seller(id)
);

-- Ítems: comprador, tienda y afiliado (el afiliado no ve la dirección del pedido).
create policy "items: leer" on public.order_items for select using (
  affiliate_id = auth.uid()
  or exists (select 1 from stores s where s.id = store_id and s.owner_id = auth.uid())
  or public.is_order_buyer(order_id)
);

create policy "retiros: leer propios" on public.withdrawals for select using (user_id = auth.uid());

create policy "reseñas: leer" on public.reviews for select using (true);
create policy "reseñas: crear tras entrega" on public.reviews for insert with check (
  user_id = auth.uid()
  and exists (
    select 1 from order_items oi join orders o on o.id = oi.order_id
     where oi.product_id = reviews.product_id and o.buyer_id = auth.uid() and oi.fulfillment = 'delivered'
  )
);
create policy "reseñas: editar propia" on public.reviews for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =====================================================================
-- Funciones (RPC)
-- =====================================================================

-- ¿Usuario de afiliado disponible?
create or replace function public.username_available(p_username text) returns boolean
  language sql stable security definer set search_path = public as $$
  select not exists (select 1 from profiles where username = lower(p_username) and id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'))
$$;

-- Registra un clic de afiliado. Ignora autoreferidos y usuarios inexistentes.
create or replace function public.track_click(p_username text, p_product_id uuid) returns boolean
  language plpgsql security definer set search_path = public as $$
declare aff uuid;
begin
  select id into aff from profiles where username = lower(p_username);
  if aff is null or aff = auth.uid() then return false; end if;
  insert into referral_clicks (affiliate_id, product_id)
  values (aff, (select id from products where id = p_product_id));
  return true;
end $$;

-- Crea un pedido pendiente de pago. Precios y repartos salen de la base de datos.
-- p_items: [{"product_id": "...", "qty": 2}, ...]
-- p_shipping: {"name","phone","city","address","notes"}
create or replace function public.create_order(p_items jsonb, p_ref text, p_shipping jsonb)
  returns table (order_id uuid, reference text, total integer)
  language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  uid      uuid := auth.uid();
  aff      uuid;
  o_id     uuid;
  o_ref    text;
  o_total  integer := 0;
  it       record;
  p        record;
  sub      integer;
  plat     integer;
  affamt   integer;
begin
  if uid is null then raise exception 'Debes iniciar sesión para comprar' using errcode = '28000'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El carrito está vacío';
  end if;
  if coalesce(trim(p_shipping ->> 'name'), '') = '' or coalesce(trim(p_shipping ->> 'address'), '') = ''
     or coalesce(trim(p_shipping ->> 'city'), '') = '' or coalesce(trim(p_shipping ->> 'phone'), '') = '' then
    raise exception 'Completa los datos de envío';
  end if;

  if p_ref is not null and p_ref <> '' then
    select id into aff from profiles where username = lower(p_ref) and id <> uid;
  end if;

  o_ref := 'PX' || to_char(now() at time zone 'America/Bogota', 'YYMMDD') || '-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));
  insert into orders (reference, buyer_id, total, affiliate_id, shipping)
  values (o_ref, uid, 1, aff, jsonb_build_object(
    'name', left(trim(p_shipping ->> 'name'), 80),
    'phone', left(trim(p_shipping ->> 'phone'), 20),
    'city', left(trim(p_shipping ->> 'city'), 60),
    'address', left(trim(p_shipping ->> 'address'), 160),
    'notes', left(coalesce(trim(p_shipping ->> 'notes'), ''), 300)
  ))
  returning id into o_id;

  for it in
    select (x ->> 'product_id')::uuid as product_id, sum(greatest(1, least(99, (x ->> 'qty')::int)))::int as qty
      from jsonb_array_elements(p_items) x
     group by 1
  loop
    select pr.*, s.owner_id into p
      from products pr join stores s on s.id = pr.store_id
     where pr.id = it.product_id and pr.active and s.active;
    if not found then raise exception 'Un producto ya no está disponible'; end if;
    if p.stock < it.qty then raise exception 'Sin stock suficiente de "%" (quedan %)', p.name, p.stock; end if;

    sub    := p.price * it.qty;
    plat   := round(sub * platform_rate());
    -- Sin afiliado (o si el comprador es el dueño de la tienda) el vendedor recibe esa parte.
    affamt := case when aff is not null and aff <> p.owner_id
                   then round(sub * greatest(affiliate_min(), least(affiliate_max(), p.commission)))
                   else 0 end;

    insert into order_items (order_id, product_id, store_id, product_name, product_emoji, product_image,
                             unit_price, qty, subtotal, seller_amount, affiliate_amount, platform_amount, affiliate_id)
    values (o_id, p.id, p.store_id, p.name, p.emoji, p.images[1], p.price, it.qty, sub,
            sub - plat - affamt, affamt, plat, case when affamt > 0 then aff end);
    o_total := o_total + sub;
  end loop;

  update orders set total = o_total where id = o_id;
  return query select o_id, o_ref, o_total;
end $$;

-- Confirma el pago (solo service role, desde el webhook de Wompi). Idempotente.
create or replace function public.mark_order_paid(p_reference text, p_transaction_id text, p_amount_in_cents bigint)
  returns text language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  select * into o from orders where reference = p_reference for update;
  if not found then return 'not_found'; end if;
  if o.status = 'paid' then return 'already_paid'; end if;
  if o.total::bigint * 100 <> p_amount_in_cents then return 'amount_mismatch'; end if;

  update orders set status = 'paid', paid_at = now(), wompi_transaction_id = p_transaction_id where id = o.id;
  update order_items set paid_at = now() where order_id = o.id;
  update products pr
     set stock = greatest(pr.stock - oi.qty, 0), sold_count = pr.sold_count + oi.qty
    from order_items oi
   where oi.order_id = o.id and oi.product_id = pr.id;
  return 'paid';
end $$;

create or replace function public.mark_order_failed(p_reference text, p_transaction_id text)
  returns text language plpgsql security definer set search_path = public as $$
begin
  update orders set status = 'failed', wompi_transaction_id = p_transaction_id
   where reference = p_reference and status = 'pending';
  return case when found then 'failed' else 'ignored' end;
end $$;

revoke execute on function public.mark_order_paid(text, text, bigint) from public, anon, authenticated;
revoke execute on function public.mark_order_failed(text, text) from public, anon, authenticated;

-- El vendedor actualiza el estado de envío de sus ítems pagados.
create or replace function public.set_fulfillment(p_item_id uuid, p_status text, p_tracking text default null)
  returns void language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  if p_status not in ('preparing', 'shipped', 'delivered', 'cancelled') then raise exception 'Estado inválido'; end if;
  select true into ok
    from order_items oi join stores s on s.id = oi.store_id
   where oi.id = p_item_id and s.owner_id = auth.uid() and oi.paid_at is not null
     and oi.fulfillment not in ('delivered', 'cancelled');
  if not found then raise exception 'No puedes modificar este pedido'; end if;

  update order_items
     set fulfillment = p_status,
         tracking = coalesce(nullif(trim(p_tracking), ''), tracking),
         delivered_at = case when p_status = 'delivered' then now() else delivered_at end
   where id = p_item_id;
end $$;

-- Billetera: ganancias (vendedor + afiliado), retenidas 7 días tras la entrega.
create or replace function public.my_wallet()
  returns table (pending integer, available integer, withdrawn integer)
  language sql stable security definer set search_path = public as $$
  with earned as (
    select coalesce(sum(case when s.owner_id = auth.uid() then oi.seller_amount else 0 end
                      + case when oi.affiliate_id = auth.uid() then oi.affiliate_amount else 0 end), 0) as amount,
           (oi.fulfillment = 'delivered' and oi.delivered_at <= now() - make_interval(days => hold_days())) as released
      from order_items oi join stores s on s.id = oi.store_id
     where oi.paid_at is not null and oi.fulfillment <> 'cancelled'
       and (s.owner_id = auth.uid() or oi.affiliate_id = auth.uid())
     group by 2
  ), wd as (
    select coalesce(sum(amount), 0)::int as w from withdrawals where user_id = auth.uid() and status <> 'rejected'
  )
  select coalesce((select amount from earned where not released), 0)::int,
         (coalesce((select amount from earned where released), 0) - (select w from wd))::int,
         (select w from wd)
$$;

create or replace function public.request_withdrawal(p_amount integer, p_method text, p_account text)
  returns uuid language plpgsql security definer set search_path = public as $$
declare avail integer; wid uuid;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  select available into avail from my_wallet();
  if p_amount < min_withdrawal() then raise exception 'El retiro mínimo es $50.000'; end if;
  if p_amount > avail then raise exception 'Saldo disponible insuficiente'; end if;
  insert into withdrawals (user_id, amount, method, account)
  values (auth.uid(), p_amount, p_method, trim(p_account)) returning id into wid;
  return wid;
end $$;

-- =====================================================================
-- Almacenamiento de imágenes de productos (políticas)
-- Ruta de cada archivo: <user_id>/<nombre>
-- =====================================================================
create policy "imagenes: lectura pública" on storage.objects for select using (bucket_id = 'product-images');
create policy "imagenes: subir propias" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "imagenes: borrar propias" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text);