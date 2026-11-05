-- Afiliados estilo Hotmart: cada clic y cada venta guardan la fuente (src / utm_source)
-- para medir enlaces por canal. Y un panel de administración: resumen, pedidos, retiros,
-- productos y usuarios, solo para quien está en public.admins.

-- ---------------------------------------------------------------------
-- Fuente del clic y de la venta
-- ---------------------------------------------------------------------
alter table public.referral_clicks add column if not exists source text;
--> statement-breakpoint
alter table public.referral_clicks drop constraint if exists referral_clicks_source_check;
--> statement-breakpoint
alter table public.referral_clicks add constraint referral_clicks_source_check
  check (source is null or source ~ '^[a-z0-9_-]{1,40}$');
--> statement-breakpoint
alter table public.order_items add column if not exists ref_source text;
--> statement-breakpoint
alter table public.order_items drop constraint if exists order_items_ref_source_check;
--> statement-breakpoint
alter table public.order_items add constraint order_items_ref_source_check
  check (ref_source is null or ref_source ~ '^[a-z0-9_-]{1,40}$');
--> statement-breakpoint
drop function if exists public.track_click(text, uuid);
--> statement-breakpoint
create or replace function public.track_click(p_username text, p_product_id uuid, p_source text default null)
  returns boolean language plpgsql security definer set search_path = public as $$
declare aff uuid;
        src text := nullif(left(lower(regexp_replace(coalesce(p_source, ''), '[^a-zA-Z0-9_-]', '', 'g')), 40), '');
begin
  select id into aff from profiles where username = lower(p_username);
  -- Sin autorreferidos: el propio afiliado no suma clics.
  if aff is null or aff = auth.uid() then return false; end if;
  insert into referral_clicks (affiliate_id, product_id, source)
  values (aff, (select id from products where id = p_product_id), src);
  return true;
end $$;
--> statement-breakpoint
grant execute on function public.track_click(text, uuid, text) to anon, authenticated;
--> statement-breakpoint
drop function if exists public.create_order(jsonb, text, jsonb, text);
--> statement-breakpoint
create or replace function public.create_order(
  p_items jsonb, p_ref text, p_shipping jsonb, p_coupon text default null, p_src text default null
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
  src      text := nullif(left(lower(regexp_replace(coalesce(p_src, ''), '[^a-zA-Z0-9_-]', '', 'g')), 40), '');
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
    -- Venta directa (comisión 0): no hay parte para afiliados aunque llegue con enlace.
    affamt := case when aff is not null and aff <> p.owner_id and p.commission > 0
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
                             discount_amount, affiliate_id, ref_source)
    values (o_id, p.id, p.store_id, p.name, p.emoji, p.images[1], p.price, it.qty, sub,
            sub - plat - affamt, affamt, plat - disc - cdisc, disc + cdisc, case when affamt > 0 then aff end,
            case when affamt > 0 then src end);
    o_total := o_total + sub - disc - cdisc;
    o_disc := o_disc + disc + cdisc;
    o_cdisc := o_cdisc + cdisc;
  end loop;

  update orders set total = o_total, discount = o_disc, coupon_discount = o_cdisc where id = o_id;
  return query select o_id, o_ref, o_total;
end $$;
--> statement-breakpoint
grant execute on function public.create_order(jsonb, text, jsonb, text, text) to authenticated;
--> statement-breakpoint
-- ---------------------------------------------------------------------
-- Panel de administración
-- ---------------------------------------------------------------------
create or replace function public.admin_overview() returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := now() - interval '30 days';
begin
  if not is_admin() then raise exception 'Solo administración'; end if;
  return jsonb_build_object(
    'gmv30', (select coalesce(sum(total), 0) from orders where status = 'paid' and paid_at >= since),
    'orders30', (select count(*) from orders where status = 'paid' and paid_at >= since),
    'platform30', (select coalesce(sum(i.platform_amount), 0) from order_items i join orders o on o.id = i.order_id
                    where o.status = 'paid' and o.paid_at >= since and i.refunded_at is null),
    'affiliate30', (select coalesce(sum(i.affiliate_amount), 0) from order_items i join orders o on o.id = i.order_id
                     where o.status = 'paid' and o.paid_at >= since and i.refunded_at is null),
    'pendingWithdrawals', (select count(*) from withdrawals where status = 'requested'),
    'pendingWithdrawalsAmount', (select coalesce(sum(amount), 0) from withdrawals where status = 'requested'),
    'toShip', (select count(*) from order_items i join orders o on o.id = i.order_id
                where o.status = 'paid' and i.fulfillment in ('pending', 'preparing')),
    'openDisputes', (select count(*) from disputes where status = 'open'),
    'storesToVerify', (select count(*) from stores where not verified and verification_requested_at is not null),
    'stores', (select count(*) from stores where active),
    'products', (select count(*) from products where active),
    'users', (select count(*) from profiles),
    'affiliates', (select count(*) from profiles where username is not null)
  );
end $$;
--> statement-breakpoint
create or replace function public.admin_orders(p_limit int default 200)
  returns table (id uuid, reference text, status text, total integer, created_at timestamptz,
                 paid_at timestamptz, buyer_email text, items jsonb)
  language sql stable security definer set search_path = public, auth as $$
  select o.id, o.reference, o.status, o.total, o.created_at, o.paid_at, u.email::text,
         (select coalesce(jsonb_agg(jsonb_build_object(
                    'name', i.product_name, 'qty', i.qty, 'store', s.name, 'fulfillment', i.fulfillment,
                    'subtotal', i.subtotal, 'seller', i.seller_amount, 'affiliate', i.affiliate_amount,
                    'platform', i.platform_amount, 'refunded', i.refunded_at is not null)
                  order by i.created_at), '[]'::jsonb)
            from order_items i join stores s on s.id = i.store_id where i.order_id = o.id)
    from orders o join auth.users u on u.id = o.buyer_id
   where public.is_admin()
   order by o.created_at desc
   limit least(greatest(p_limit, 1), 1000)
$$;
--> statement-breakpoint
create or replace function public.admin_withdrawals()
  returns table (id uuid, user_id uuid, email text, full_name text, amount integer, method text,
                 account text, status text, created_at timestamptz)
  language sql stable security definer set search_path = public, auth as $$
  select w.id, w.user_id, u.email::text, p.full_name, w.amount, w.method, w.account, w.status, w.created_at
    from withdrawals w join auth.users u on u.id = w.user_id join profiles p on p.id = w.user_id
   where public.is_admin()
   order by (w.status = 'requested') desc, w.created_at desc
   limit 500
$$;
--> statement-breakpoint
-- Marca un retiro como pagado (ya se transfirió) o rechazado (el saldo vuelve a estar disponible).
create or replace function public.admin_set_withdrawal(p_id uuid, p_status text) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo administración'; end if;
  if p_status not in ('paid', 'rejected') then raise exception 'Estado inválido'; end if;
  update withdrawals set status = p_status where id = p_id and status = 'requested';
  if not found then raise exception 'Ese retiro ya fue procesado'; end if;
end $$;
--> statement-breakpoint
create or replace function public.admin_products(p_limit int default 500)
  returns table (id uuid, name text, emoji text, image text, price integer, stock integer, active boolean,
                 sold_count integer, commission numeric, category text, store_name text, store_slug text,
                 created_at timestamptz)
  language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.emoji, p.images[1], p.price, p.stock, p.active, p.sold_count, p.commission,
         p.category, s.name, s.slug, p.created_at
    from products p join stores s on s.id = p.store_id
   where public.is_admin()
   order by p.created_at desc
   limit least(greatest(p_limit, 1), 2000)
$$;
--> statement-breakpoint
create or replace function public.admin_set_product_active(p_id uuid, p_active boolean) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo administración'; end if;
  update products set active = p_active where id = p_id;
end $$;
--> statement-breakpoint
create or replace function public.admin_users(p_limit int default 500)
  returns table (id uuid, email text, full_name text, username text, account_type text, banned boolean,
                 has_store boolean, is_admin boolean, created_at timestamptz)
  language sql stable security definer set search_path = public, auth as $$
  select p.id, u.email::text, p.full_name, p.username, p.account_type, p.banned_at is not null,
         exists (select 1 from stores s where s.owner_id = p.id),
         exists (select 1 from admins a where a.user_id = p.id),
         p.created_at
    from profiles p join auth.users u on u.id = p.id
   where public.is_admin()
   order by p.created_at desc
   limit least(greatest(p_limit, 1), 2000)
$$;
--> statement-breakpoint
revoke execute on function public.admin_overview() from anon;
--> statement-breakpoint
revoke execute on function public.admin_orders(int) from anon;
--> statement-breakpoint
revoke execute on function public.admin_withdrawals() from anon;
--> statement-breakpoint
revoke execute on function public.admin_set_withdrawal(uuid, text) from anon;
--> statement-breakpoint
revoke execute on function public.admin_products(int) from anon;
--> statement-breakpoint
revoke execute on function public.admin_set_product_active(uuid, boolean) from anon;
--> statement-breakpoint
revoke execute on function public.admin_users(int) from anon;
