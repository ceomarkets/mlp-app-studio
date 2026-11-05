-- Registro general: 1) compra y venta (persona), 2) afiliados, 3) empresas. Quien compra
-- también puede vender como persona, sin ser empresa ni afiliado. Las tiendas indican si son
-- de una persona o de una empresa, y un producto puede venderse sin afiliados (venta directa).
-- Además: retiro del vestidor virtual.

-- Vestidor virtual retirado: ya no se guarda el ajuste de prenda.
alter table public.products drop constraint if exists products_try_on_check;
--> statement-breakpoint
alter table public.products drop column if exists try_on;
--> statement-breakpoint
-- Tienda de una persona o de una empresa (se muestra al comprador).
alter table public.stores add column if not exists kind text not null default 'empresa';
--> statement-breakpoint
alter table public.stores drop constraint if exists stores_kind_check;
--> statement-breakpoint
alter table public.stores add constraint stores_kind_check check (kind in ('persona', 'empresa'));
--> statement-breakpoint
-- Producto: comisión 0 = venta directa (sin afiliados); si no, entre 3% y 20%.
alter table public.products drop constraint if exists products_commission_check;
--> statement-breakpoint
alter table public.products add constraint products_commission_check
  check (commission = 0 or commission between 0.03 and 0.20);
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
