-- =====================================================================
-- Plaza X · descuento por volumen y recursos para afiliados (idempotente)
--   * Llevar 3 o más unidades da 5 % de
--     descuento real. Sale de la comisión de Plaza X (9 %): el vendedor y el
--     afiliado cobran lo mismo. Para desactivarlo, devuelve 0 en
--     bundle_discount_rate(); para cambiarlo, edita los valores.
--   * promo_copy / promo_image: material que la empresa comparte con sus
--     afiliados (texto e imagen publicitaria).
-- =====================================================================

create or replace function public.bundle_min_units() returns integer
  language sql immutable as $$ select 3 $$;
--> statement-breakpoint
create or replace function public.bundle_discount_rate() returns numeric
  language sql immutable as $$ select 0.05::numeric $$;
--> statement-breakpoint
alter table public.orders add column if not exists discount integer not null default 0;
--> statement-breakpoint
alter table public.order_items add column if not exists discount_amount integer not null default 0;
--> statement-breakpoint
alter table public.products add column if not exists promo_copy text not null default '';
--> statement-breakpoint
alter table public.products add column if not exists promo_image text;
--> statement-breakpoint
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_promo_copy_len') then
    alter table public.products add constraint products_promo_copy_len check (char_length(promo_copy) <= 600);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_promo_image_https') then
    alter table public.products add constraint products_promo_image_https check (promo_image is null or promo_image ~ '^https://');
  end if;
end $$;
--> statement-breakpoint
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
  units    integer;
  disc     integer;
  o_disc   integer := 0;
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

  -- Unidades totales del pedido: decide si aplica el descuento por volumen.
  select coalesce(sum(greatest(1, least(99, (x ->> 'qty')::int))), 0)::int into units
    from jsonb_array_elements(p_items) x;

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

    -- Descuento por volumen: sale de la parte de Plaza X; vendedor y afiliado no pierden nada.
    disc := case when units >= bundle_min_units() then least(plat, round(sub * bundle_discount_rate())) else 0 end;

    insert into order_items (order_id, product_id, store_id, product_name, product_emoji, product_image,
                             unit_price, qty, subtotal, seller_amount, affiliate_amount, platform_amount,
                             discount_amount, affiliate_id)
    values (o_id, p.id, p.store_id, p.name, p.emoji, p.images[1], p.price, it.qty, sub,
            sub - plat - affamt, affamt, plat - disc, disc, case when affamt > 0 then aff end);
    o_total := o_total + sub - disc;
    o_disc := o_disc + disc;
  end loop;

  update orders set total = o_total, discount = o_disc where id = o_id;
  return query select o_id, o_ref, o_total;
end $$;
