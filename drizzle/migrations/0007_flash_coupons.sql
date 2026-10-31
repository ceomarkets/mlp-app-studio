-- Ventas flash programadas por la administración y cupones reales.
-- La cuenta regresiva solo existe mientras hay una venta flash activa con fecha de fin.
-- El descuento de un cupón lo asume Plaza X: nunca supera su parte de la venta, así que
-- la tienda y el afiliado cobran lo mismo.

-- ---------------------------------------------------------------------
-- Cupones
-- ---------------------------------------------------------------------
create table if not exists public.coupons (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique check (code ~ '^[A-Z0-9-]{3,20}$'),
  description   text not null default '' check (char_length(description) <= 120),
  kind          text not null check (kind in ('percent', 'fixed')),
  value         integer not null check (value > 0),
  min_subtotal  integer not null default 0 check (min_subtotal >= 0),
  max_uses      integer check (max_uses is null or max_uses > 0),
  starts_at     timestamptz not null default now(),
  ends_at       timestamptz,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  constraint coupon_percent check (kind <> 'percent' or value <= 50),
  constraint coupon_dates check (ends_at is null or ends_at > starts_at)
);
--> statement-breakpoint
alter table public.coupons enable row level security;
--> statement-breakpoint
drop policy if exists "cupones: administración" on public.coupons;
--> statement-breakpoint
create policy "cupones: administración" on public.coupons for all
  using (public.is_admin()) with check (public.is_admin());
--> statement-breakpoint
alter table public.orders add column if not exists coupon_id uuid references public.coupons (id);
--> statement-breakpoint
alter table public.orders add column if not exists coupon_discount integer not null default 0;
--> statement-breakpoint
-- Usos que cuentan: pedidos pagados y los pendientes de la última hora (pago en curso).
create or replace function public.coupon_uses(p_coupon uuid, p_user uuid default null)
  returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from orders
   where coupon_id = p_coupon
     and (p_user is null or buyer_id = p_user)
     and (status = 'paid' or (status = 'pending' and created_at > now() - interval '1 hour'))
$$;
--> statement-breakpoint
-- Cupón válido para quien compra (o error con el motivo).
create or replace function public.usable_coupon(p_code text, p_user uuid)
  returns public.coupons language plpgsql stable security definer set search_path = public as $$
declare c coupons;
begin
  select * into c from coupons where code = upper(trim(p_code));
  if not found or not c.active then raise exception 'Cupón no válido'; end if;
  if c.starts_at > now() then raise exception 'Este cupón aún no está activo'; end if;
  if c.ends_at is not null and c.ends_at <= now() then raise exception 'Este cupón ya venció'; end if;
  if c.max_uses is not null and coupon_uses(c.id) >= c.max_uses then
    raise exception 'Este cupón se agotó';
  end if;
  if p_user is not null and coupon_uses(c.id, p_user) > 0 then
    raise exception 'Ya usaste este cupón';
  end if;
  return c;
end $$;
--> statement-breakpoint
-- Para el carrito: datos públicos del cupón si la persona puede usarlo.
create or replace function public.check_coupon(p_code text)
  returns table (code text, description text, kind text, value integer, min_subtotal integer,
                 ends_at timestamptz)
  language plpgsql stable security definer set search_path = public as $$
declare c coupons;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para usar cupones'; end if;
  c := usable_coupon(p_code, auth.uid());
  return query select c.code, c.description, c.kind, c.value, c.min_subtotal, c.ends_at;
end $$;
--> statement-breakpoint
-- ---------------------------------------------------------------------
-- Pedido con descuento por volumen + cupón
-- ---------------------------------------------------------------------
drop function if exists public.create_order(jsonb, text, jsonb);
--> statement-breakpoint
create or replace function public.create_order(
  p_items jsonb, p_ref text, p_shipping jsonb, p_coupon text default null
) returns table (order_id uuid, reference text, total integer)
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
  units    integer;
  disc     integer;
  cdisc    integer;
  o_disc   integer := 0;
  o_cdisc  integer := 0;
  gross    integer := 0;
  cp       coupons;
  left_fixed integer := 0;
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

  select coalesce(sum(greatest(1, least(99, (x ->> 'qty')::int))), 0)::int into units
    from jsonb_array_elements(p_items) x;

  if coalesce(trim(p_coupon), '') <> '' then
    cp := usable_coupon(p_coupon, uid);
    -- Subtotal antes de descuentos, para el mínimo de compra.
    select coalesce(sum(pr.price * q.qty), 0)::int into gross
      from (select (x ->> 'product_id')::uuid as pid, sum(greatest(1, least(99, (x ->> 'qty')::int)))::int as qty
              from jsonb_array_elements(p_items) x group by 1) q
      join products pr on pr.id = q.pid;
    if gross < cp.min_subtotal then
      raise exception 'Este cupón aplica desde $% en productos',
        replace(to_char(cp.min_subtotal, 'FM999,999,999'), ',', '.');
    end if;
    if cp.kind = 'fixed' then left_fixed := cp.value; end if;
  end if;

  o_ref := 'PX' || to_char(now() at time zone 'America/Bogota', 'YYMMDD') || '-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));
  insert into orders (reference, buyer_id, total, affiliate_id, shipping, coupon_id)
  values (o_ref, uid, 1, aff, jsonb_build_object(
    'name', left(trim(p_shipping ->> 'name'), 80),
    'phone', left(trim(p_shipping ->> 'phone'), 20),
    'city', left(trim(p_shipping ->> 'city'), 60),
    'address', left(trim(p_shipping ->> 'address'), 160),
    'notes', left(coalesce(trim(p_shipping ->> 'notes'), ''), 300)
  ), cp.id)
  returning id into o_id;

  for it in
    select (x ->> 'product_id')::uuid as product_id, sum(greatest(1, least(99, (x ->> 'qty')::int)))::int as qty
      from jsonb_array_elements(p_items) x
     group by 1
     order by 1
  loop
    select pr.*, s.owner_id into p
      from products pr join stores s on s.id = pr.store_id
     where pr.id = it.product_id and pr.active and s.active;
    if not found then raise exception 'Un producto ya no está disponible'; end if;
    if p.stock < it.qty then raise exception 'Sin stock suficiente de "%" (quedan %)', p.name, p.stock; end if;

    sub    := p.price * it.qty;
    plat   := round(sub * platform_rate());
    affamt := case when aff is not null and aff <> p.owner_id
                   then round(sub * greatest(affiliate_min(), least(affiliate_max(), p.commission)))
                   else 0 end;
    -- Volumen y cupón salen de la parte de Plaza X, nunca más de lo que le corresponde.
    disc := case when units >= bundle_min_units() then least(plat, round(sub * bundle_discount_rate())) else 0 end;
    cdisc := 0;
    if cp.id is not null then
      if cp.kind = 'percent' then
        cdisc := least(plat - disc, round(sub * cp.value / 100.0));
      else
        cdisc := least(plat - disc, left_fixed);
        left_fixed := left_fixed - cdisc;
      end if;
    end if;

    insert into order_items (order_id, product_id, store_id, product_name, product_emoji, product_image,
                             unit_price, qty, subtotal, seller_amount, affiliate_amount, platform_amount,
                             discount_amount, affiliate_id)
    values (o_id, p.id, p.store_id, p.name, p.emoji, p.images[1], p.price, it.qty, sub,
            sub - plat - affamt, affamt, plat - disc - cdisc, disc + cdisc, case when affamt > 0 then aff end);
    o_total := o_total + sub - disc - cdisc;
    o_disc := o_disc + disc + cdisc;
    o_cdisc := o_cdisc + cdisc;
  end loop;

  update orders set total = o_total, discount = o_disc, coupon_discount = o_cdisc where id = o_id;
  return query select o_id, o_ref, o_total;
end $$;
--> statement-breakpoint
-- ---------------------------------------------------------------------
-- Ventas flash
-- ---------------------------------------------------------------------
create table if not exists public.flash_sales (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 3 and 80),
  subtitle    text not null default '' check (char_length(subtitle) <= 160),
  coupon_code text check (coupon_code is null or coupon_code ~ '^[A-Z0-9-]{3,20}$'),
  link        text check (link is null or link ~ '^(/[^/]|/$|https://)'),
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint flash_dates check (ends_at > starts_at)
);
--> statement-breakpoint
alter table public.flash_sales enable row level security;
--> statement-breakpoint
drop policy if exists "flash: leer vigentes" on public.flash_sales;
--> statement-breakpoint
create policy "flash: leer vigentes" on public.flash_sales for select using (
  (active and starts_at <= now() and ends_at > now()) or public.is_admin()
);
--> statement-breakpoint
drop policy if exists "flash: administración" on public.flash_sales;
--> statement-breakpoint
create policy "flash: administración" on public.flash_sales for all
  using (public.is_admin()) with check (public.is_admin());
--> statement-breakpoint
-- Funciones internas: solo create_order y check_coupon las usan.
revoke execute on function public.usable_coupon(text, uuid) from public, anon, authenticated;
--> statement-breakpoint
revoke execute on function public.coupon_uses(uuid, uuid) from public, anon, authenticated;
