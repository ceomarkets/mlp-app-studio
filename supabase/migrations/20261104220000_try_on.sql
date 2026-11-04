-- Vestidor virtual: la tienda puede indicar el tipo de prenda y su color.
alter table public.products add column if not exists try_on jsonb;
alter table public.products drop constraint if exists products_try_on_check;
alter table public.products add constraint products_try_on_check check (
  try_on is null or (
    jsonb_typeof(try_on) = 'object'
    and (try_on->>'color' is null or try_on->>'color' ~ '^#[0-9a-fA-F]{6}$')
    and (try_on->>'kind' is null or length(try_on->>'kind') <= 20)
  )
);
