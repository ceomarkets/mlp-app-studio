-- Solicitudes de afiliación, aprobación por la empresa, verificación solicitada,
-- método de cobro del afiliado y video promocional por producto.

-- Tienda: exige aprobar a cada afiliado antes de pagarle comisiones.
alter table public.stores add column if not exists require_approval boolean not null default false;
-- La tienda pide la verificación; la otorga la administración (stores.verified).
alter table public.stores add column if not exists verification_requested_at timestamptz;

-- Perfil: rol con el que se registró y método de cobro preferido.
alter table public.profiles add column if not exists account_type text not null default 'comprador';
alter table public.profiles add column if not exists payout_method text;
do $$ begin
  alter table public.profiles add constraint profiles_account_type_check
    check (account_type in ('comprador', 'afiliado', 'empresa'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.profiles add constraint profiles_payout_method_check
    check (payout_method is null or payout_method in ('nequi', 'daviplata', 'bancolombia'));
exception when duplicate_object then null; end $$;

-- Registro: guarda el rol y el método de cobro elegidos al crear la cuenta.
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
declare t text := new.raw_user_meta_data ->> 'account_type';
        m text := new.raw_user_meta_data ->> 'payout_method';
begin
  insert into public.profiles (id, full_name, account_type, payout_method)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''),
          case when t in ('afiliado', 'empresa') then t else 'comprador' end,
          case when m in ('nequi', 'daviplata', 'bancolombia') then m end);
  return new;
end $$;

-- Producto: video promocional (Reels/TikTok/YouTube) para los afiliados.
alter table public.products add column if not exists promo_video text;
do $$ begin
  alter table public.products add constraint products_promo_video_check
    check (promo_video is null or (promo_video ~ '^https://' and char_length(promo_video) <= 500));
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Solicitudes de afiliación
-- ---------------------------------------------------------------------
create table if not exists public.affiliate_requests (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references public.stores (id) on delete cascade,
  affiliate_id  uuid not null references public.profiles (id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  message       text check (message is null or char_length(message) <= 300),
  created_at    timestamptz not null default now(),
  decided_at    timestamptz,
  unique (store_id, affiliate_id)
);
create index if not exists affiliate_requests_store_idx on public.affiliate_requests (store_id, status);
alter table public.affiliate_requests enable row level security;

drop policy if exists "afiliaciones: leer" on public.affiliate_requests;
create policy "afiliaciones: leer" on public.affiliate_requests for select using (
  affiliate_id = auth.uid() or public.is_store_owner(store_id) or public.is_admin()
);
-- Escritura solo por funciones.

create or replace function public.request_affiliation(p_store_slug text, p_message text default null)
  returns text language plpgsql security definer set search_path = public as $$
declare st record; prev text;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if is_banned() then raise exception 'Tu cuenta está suspendida'; end if;
  select id, owner_id, require_approval into st from stores where slug = p_store_slug and active;
  if not found then raise exception 'Tienda no encontrada'; end if;
  if st.owner_id = auth.uid() then raise exception 'No puedes afiliarte a tu propia tienda'; end if;
  if not exists (select 1 from profiles where id = auth.uid() and username is not null) then
    raise exception 'Primero elige tu usuario de afiliado';
  end if;

  select status into prev from affiliate_requests where store_id = st.id and affiliate_id = auth.uid();
  if prev = 'approved' then return 'approved'; end if;
  if prev = 'rejected' then raise exception 'La tienda no aprobó tu solicitud'; end if;

  -- Tiendas abiertas: quedan aprobadas al instante.
  insert into affiliate_requests (store_id, affiliate_id, status, message, decided_at)
  values (st.id, auth.uid(),
          case when st.require_approval then 'pending' else 'approved' end,
          nullif(left(trim(coalesce(p_message, '')), 300), ''),
          case when st.require_approval then null else now() end)
  on conflict (store_id, affiliate_id) do update set message = excluded.message;
  return case when st.require_approval then 'pending' else 'approved' end;
end $$;

create or replace function public.decide_affiliation(p_id uuid, p_approve boolean)
  returns void language plpgsql security definer set search_path = public as $$
begin
  update affiliate_requests
     set status = case when p_approve then 'approved' else 'rejected' end, decided_at = now()
   where id = p_id and is_store_owner(store_id);
  if not found then raise exception 'No puedes decidir esta solicitud'; end if;
end $$;

-- Tienda con aprobación obligatoria: sin solicitud aprobada, la comisión vuelve a la tienda.
create or replace function public.enforce_affiliate_approval() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.affiliate_id is not null
     and exists (select 1 from stores where id = new.store_id and require_approval)
     and not exists (select 1 from affiliate_requests
                      where store_id = new.store_id and affiliate_id = new.affiliate_id
                        and status = 'approved') then
    new.seller_amount := new.seller_amount + new.affiliate_amount;
    new.affiliate_amount := 0;
    new.affiliate_id := null;
  end if;
  return new;
end $$;
drop trigger if exists order_items_affiliate_approval on public.order_items;
create trigger order_items_affiliate_approval before insert on public.order_items
  for each row execute function public.enforce_affiliate_approval();

-- ---------------------------------------------------------------------
-- Administración de tiendas (verificación)
-- ---------------------------------------------------------------------
create or replace function public.admin_stores()
  returns table (id uuid, owner_id uuid, slug text, name text, city text, emoji text, active boolean,
                 verified boolean, verification_requested_at timestamptz, owner_email text,
                 owner_banned boolean, products bigint, sold bigint, open_disputes bigint,
                 created_at timestamptz)
  language sql stable security definer set search_path = public, auth as $$
  select s.id, s.owner_id, s.slug, s.name, s.city, s.emoji, s.active, s.verified, s.verification_requested_at,
         u.email::text, p.banned_at is not null,
         (select count(*) from products where store_id = s.id and active),
         (select coalesce(sum(sold_count), 0) from products where store_id = s.id),
         (select count(*) from disputes where store_id = s.id and status = 'open'),
         s.created_at
    from stores s
    join auth.users u on u.id = s.owner_id
    join profiles p on p.id = s.owner_id
   where public.is_admin()
   order by s.verification_requested_at desc nulls last, s.created_at desc
$$;

create or replace function public.set_store_verified(p_store uuid, p_verified boolean)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo administración'; end if;
  update stores set verified = p_verified,
                    verification_requested_at = case when p_verified then null else verification_requested_at end
   where id = p_store;
end $$;

-- Reactivar a un vendedor suspendido por error.
create or replace function public.set_user_banned(p_user uuid, p_banned boolean, p_reason text default null)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo administración'; end if;
  if p_user = auth.uid() then raise exception 'No puedes suspender tu propia cuenta'; end if;
  update profiles set banned_at = case when p_banned then now() end,
                      ban_reason = case when p_banned then left(coalesce(p_reason, ''), 300) end
   where id = p_user;
  if p_banned then update stores set active = false where owner_id = p_user; end if;
end $$;

-- Tienda: solicitudes con el usuario y nombre del afiliado (los perfiles no son públicos).
create or replace function public.store_affiliate_requests()
  returns table (id uuid, affiliate_id uuid, username text, full_name text, status text,
                 message text, created_at timestamptz, sales bigint)
  language sql stable security definer set search_path = public as $$
  select r.id, r.affiliate_id, p.username, p.full_name, r.status, r.message, r.created_at,
         (select count(*) from order_items oi
           where oi.store_id = r.store_id and oi.affiliate_id = r.affiliate_id and oi.paid_at is not null)
    from affiliate_requests r
    join stores s on s.id = r.store_id and s.owner_id = auth.uid()
    join profiles p on p.id = r.affiliate_id
   order by (r.status = 'pending') desc, r.created_at desc
$$;
