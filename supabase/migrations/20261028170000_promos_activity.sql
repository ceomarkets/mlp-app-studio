-- =====================================================================
-- Plaza X · promociones y actividad en vivo
--   * compare_at_price: "precio antes" para mostrar descuentos reales.
--   * recent_activity(): últimas ventas pagadas, anonimizadas
--     (producto + ciudad + hora), para la banda de la cabecera.
-- =====================================================================

alter table public.products
  add column compare_at_price integer
  check (compare_at_price is null or compare_at_price > price);

-- Si el vendedor baja el precio por encima del "precio antes", el descuento deja de ser válido.
create or replace function public.clear_invalid_compare_price() returns trigger
  language plpgsql as $$
begin
  if new.compare_at_price is not null and new.compare_at_price <= new.price then
    new.compare_at_price := null;
  end if;
  return new;
end $$;
create trigger products_clear_compare before insert or update on public.products
  for each row execute function public.clear_invalid_compare_price();

-- Ventas recientes sin datos personales: nunca expone nombre, teléfono ni dirección.
create or replace function public.recent_activity(p_limit integer default 20)
  returns table (product_id uuid, product_name text, product_emoji text, city text, qty integer, paid_at timestamptz)
  language sql stable security definer set search_path = public as $$
  select oi.product_id, oi.product_name, oi.product_emoji,
         initcap(left(coalesce(o.shipping ->> 'city', ''), 40)), oi.qty, oi.paid_at
    from order_items oi
    join orders o on o.id = oi.order_id
    join products p on p.id = oi.product_id and p.active
   where oi.paid_at is not null and oi.paid_at > now() - interval '7 days'
   order by oi.paid_at desc
   limit least(greatest(p_limit, 1), 50)
$$;
grant execute on function public.recent_activity(integer) to anon, authenticated;
