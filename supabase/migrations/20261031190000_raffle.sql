-- Sorteo "Desafío = Premio". En Colombia un sorteo promocional requiere autorización de
-- Coljuegos: solo puede publicarse (activarse) con el número de autorización y las bases.
-- Mientras no exista uno activo, sigue el descuento real por volumen.

create table if not exists public.raffles (
  id              uuid primary key default gen_random_uuid(),
  title           text not null check (char_length(title) between 3 and 80),
  prize           text not null check (char_length(prize) between 3 and 160),
  prize_image     text check (prize_image is null or prize_image ~ '^https://'),
  prize_value     integer check (prize_value is null or prize_value > 0),
  coljuegos_auth  text check (coljuegos_auth is null or char_length(trim(coljuegos_auth)) between 3 and 60),
  terms_url       text check (terms_url is null or terms_url ~ '^(https://|/)'),
  min_units       integer not null default 5 check (min_units between 1 and 99),
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  active          boolean not null default false,
  entries_count   integer,
  drawn_at        timestamptz,
  created_at      timestamptz not null default now(),
  constraint raffle_dates check (ends_at > starts_at),
  -- Sin autorización ni bases no se puede publicar.
  constraint raffle_authorized check (not active or (coljuegos_auth is not null and terms_url is not null))
);
alter table public.raffles enable row level security;

drop policy if exists "sorteos: leer publicados" on public.raffles;
create policy "sorteos: leer publicados" on public.raffles for select using (active or public.is_admin());
drop policy if exists "sorteos: administración" on public.raffles;
create policy "sorteos: administración" on public.raffles for all
  using (public.is_admin()) with check (public.is_admin());

-- Resultado: tabla aparte para que el público no vea quién ganó
-- (solo la administración y la persona ganadora).
create table if not exists public.raffle_draws (
  raffle_id  uuid primary key references public.raffles (id) on delete cascade,
  order_id   uuid not null references public.orders (id),
  user_id    uuid not null references public.profiles (id),
  drawn_at   timestamptz not null default now()
);
alter table public.raffle_draws enable row level security;
drop policy if exists "resultado: ganador o administración" on public.raffle_draws;
create policy "resultado: ganador o administración" on public.raffle_draws for select
  using (user_id = auth.uid() or public.is_admin());

-- Pedidos que participan: pagados dentro de la vigencia con al menos min_units unidades
-- no canceladas ni reembolsadas. Un pedido = una oportunidad.
create or replace function public.raffle_candidates(p_raffle uuid)
  returns table (order_id uuid, buyer_id uuid, units bigint)
  language sql stable security definer set search_path = public as $$
  select o.id, o.buyer_id, sum(oi.qty)
    from raffles r
    join orders o on o.status = 'paid' and o.paid_at >= r.starts_at and o.paid_at < r.ends_at
    join order_items oi on oi.order_id = o.id and oi.fulfillment <> 'cancelled'
   where r.id = p_raffle
   group by o.id, o.buyer_id, r.min_units
  having sum(oi.qty) >= r.min_units
$$;
revoke execute on function public.raffle_candidates(uuid) from public, anon, authenticated;

-- Mis oportunidades en un sorteo.
create or replace function public.my_raffle_entries(p_raffle uuid)
  returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from raffle_candidates(p_raffle) where buyer_id = auth.uid()
$$;

-- ¿Gané? (solo la persona ganadora recibe true)
create or replace function public.i_won_raffle(p_raffle uuid)
  returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from raffle_draws where raffle_id = p_raffle and user_id = auth.uid())
$$;

-- Administración: sorteo aleatorio en el servidor, una sola vez y después del cierre.
create or replace function public.draw_raffle(p_raffle uuid)
  returns table (order_reference text, winner_email text, entries integer)
  language plpgsql security definer set search_path = public, auth as $$
declare r raffles; pick record; n integer;
begin
  if not is_admin() then raise exception 'Solo administración'; end if;
  select * into r from raffles where id = p_raffle for update;
  if not found then raise exception 'Sorteo no encontrado'; end if;
  if not r.active then raise exception 'El sorteo no está publicado'; end if;
  if r.drawn_at is not null then raise exception 'Este sorteo ya se realizó'; end if;
  if r.ends_at > now() then raise exception 'El sorteo aún no cierra'; end if;

  select count(*) into n from raffle_candidates(p_raffle);
  if n = 0 then raise exception 'No hay compras participantes'; end if;
  select c.order_id, c.buyer_id into pick
    from raffle_candidates(p_raffle) c order by gen_random_uuid() limit 1;

  insert into raffle_draws (raffle_id, order_id, user_id) values (p_raffle, pick.order_id, pick.buyer_id);
  update raffles set entries_count = n, drawn_at = now() where id = p_raffle;
  return query
    select o.reference, u.email::text, n from orders o join auth.users u on u.id = o.buyer_id
     where o.id = pick.order_id;
end $$;

-- Administración: datos del ganador para contactarlo y entregar el premio.
create or replace function public.raffle_winner(p_raffle uuid)
  returns table (order_reference text, winner_email text, winner_name text, winner_phone text)
  language sql stable security definer set search_path = public, auth as $$
  select o.reference, u.email::text, p.full_name, p.phone
    from raffle_draws d
    join orders o on o.id = d.order_id
    join auth.users u on u.id = d.user_id
    join profiles p on p.id = d.user_id
   where d.raffle_id = p_raffle and public.is_admin()
$$;
