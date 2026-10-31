-- Disputas, reportes de fraude, despacho con transportadora y confirmación de recibido.
-- Modelo: el pago por el carrito queda en custodia; una disputa abierta congela el dinero del
-- vendedor y del afiliado hasta que la administración la resuelva (reembolso o rechazo).
-- Los tratos por fuera de la plataforma no tienen reembolso: solo bloqueo de la cuenta
-- denunciada y conservación de registros para las autoridades.

-- Días tras el despacho en que la entrega se da por confirmada si el comprador no responde.
create or replace function public.auto_confirm_days() returns integer language sql immutable as $$ select 10 $$;
--> statement-breakpoint
-- Días tras la entrega para abrir una disputa (igual a la retención).
create or replace function public.dispute_window_days() returns integer language sql immutable as $$ select 7 $$;
--> statement-breakpoint
alter table public.order_items add column if not exists carrier text;
--> statement-breakpoint
alter table public.order_items add column if not exists shipped_at timestamptz;
--> statement-breakpoint
alter table public.order_items add column if not exists refunded_at timestamptz;
--> statement-breakpoint
-- Cuentas suspendidas (solo la administración las marca).
alter table public.profiles add column if not exists banned_at timestamptz;
--> statement-breakpoint
alter table public.profiles add column if not exists ban_reason text;
--> statement-breakpoint
create or replace function public.protect_profile_ban() returns trigger
  language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    new.banned_at := old.banned_at;
    new.ban_reason := old.ban_reason;
  end if;
  return new;
end $$;
--> statement-breakpoint
drop trigger if exists profiles_protect_ban on public.profiles;
--> statement-breakpoint
create trigger profiles_protect_ban before update on public.profiles
  for each row execute function public.protect_profile_ban();
--> statement-breakpoint
create or replace function public.is_banned(p_user uuid default auth.uid()) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = p_user and banned_at is not null)
$$;
--> statement-breakpoint
-- Una cuenta suspendida no puede tener la tienda activa.
create or replace function public.store_owner_not_banned() returns trigger
  language plpgsql set search_path = public as $$
begin
  if new.active and public.is_banned(new.owner_id) then new.active := false; end if;
  return new;
end $$;
--> statement-breakpoint
drop trigger if exists stores_owner_not_banned on public.stores;
--> statement-breakpoint
create trigger stores_owner_not_banned before insert or update on public.stores
  for each row execute function public.store_owner_not_banned();
--> statement-breakpoint
-- ---------------------------------------------------------------------
-- Disputas y reportes
-- ---------------------------------------------------------------------
create table if not exists public.disputes (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null check (kind in ('plazax_pay', 'external_deal')),
  reporter_id     uuid not null references public.profiles (id) on delete cascade,
  order_id        uuid references public.orders (id) on delete set null,
  item_id         uuid references public.order_items (id) on delete set null,
  store_id        uuid references public.stores (id) on delete set null,
  -- Trato externo: a quién se denuncia (tienda o contacto usado por fuera).
  reported_contact text check (reported_contact is null or char_length(reported_contact) <= 120),
  reason          text not null check (reason in ('different', 'damaged', 'not_received', 'fraud', 'other')),
  details         text not null check (char_length(details) between 20 and 2000),
  evidence        text[] not null default '{}' check (cardinality(evidence) <= 8),
  status          text not null default 'open' check (status in ('open', 'refunded', 'rejected', 'closed')),
  seller_response text check (seller_response is null or char_length(seller_response) <= 2000),
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 1000),
  banned_user     uuid references public.profiles (id),
  created_at      timestamptz not null default now(),
  responded_at    timestamptz,
  resolved_at     timestamptz,
  resolved_by     uuid references public.profiles (id),
  constraint dispute_target check (
    (kind = 'plazax_pay' and item_id is not null) or (kind = 'external_deal' and item_id is null)
  )
);
--> statement-breakpoint
create index if not exists disputes_status_idx on public.disputes (status, created_at desc);
--> statement-breakpoint
create index if not exists disputes_store_idx on public.disputes (store_id, created_at desc);
--> statement-breakpoint
-- Una sola disputa abierta por artículo.
create unique index if not exists disputes_one_open_per_item on public.disputes (item_id) where status = 'open';
--> statement-breakpoint
alter table public.disputes enable row level security;
--> statement-breakpoint
create or replace function public.is_store_owner(p_store uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from stores where id = p_store and owner_id = auth.uid())
$$;
--> statement-breakpoint
drop policy if exists "disputas: leer" on public.disputes;
--> statement-breakpoint
create policy "disputas: leer" on public.disputes for select using (
  reporter_id = auth.uid() or public.is_admin()
  or (kind = 'plazax_pay' and public.is_store_owner(store_id))
);
--> statement-breakpoint
-- Escritura solo por funciones (no hay políticas de insert/update/delete).

-- Registro para autoridades (IP y navegador de quien reporta): tabla aparte, sin políticas,
-- solo legible por la administración mediante dispute_audit().
create table if not exists public.dispute_logs (
  dispute_id  uuid primary key references public.disputes (id) on delete cascade,
  ip          text,
  agent       text,
  created_at  timestamptz not null default now()
);
--> statement-breakpoint
alter table public.dispute_logs enable row level security;
--> statement-breakpoint
create or replace function public.has_open_dispute(p_item uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from disputes where item_id = p_item and status = 'open')
$$;
--> statement-breakpoint
-- IP y navegador de la solicitud (PostgREST expone los encabezados).
create or replace function public.request_ip() returns text language sql stable as $$
  select nullif(trim(split_part(coalesce(
    current_setting('request.headers', true)::json ->> 'x-forwarded-for',
    current_setting('request.headers', true)::json ->> 'cf-connecting-ip', ''), ',', 1)), '')
$$;
--> statement-breakpoint
create or replace function public.request_agent() returns text language sql stable as $$
  select left(current_setting('request.headers', true)::json ->> 'user-agent', 300)
$$;
--> statement-breakpoint
create or replace function public.clean_evidence(p text[]) returns text[]
  language plpgsql immutable as $$
declare e text; out text[] := '{}';
begin
  foreach e in array coalesce(p, '{}') loop
    e := trim(e);
    if e = '' then continue; end if;
    if e !~ '^(https://|evidence:)' or char_length(e) > 500 then
      raise exception 'Evidencia inválida: usa enlaces https o archivos subidos';
    end if;
    out := out || e;
  end loop;
  if cardinality(out) > 8 then raise exception 'Máximo 8 evidencias'; end if;
  return out;
end $$;
--> statement-breakpoint
-- Comprador: abre una disputa sobre un artículo pagado por el carrito.
create or replace function public.open_dispute(
  p_item_id uuid, p_reason text, p_details text, p_evidence text[] default '{}'
) returns uuid language plpgsql security definer set search_path = public as $$
declare it record; did uuid;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select oi.*, o.buyer_id into it
    from order_items oi join orders o on o.id = oi.order_id
   where oi.id = p_item_id;
  if not found or it.buyer_id <> auth.uid() then raise exception 'Este artículo no es de tus pedidos'; end if;
  if it.paid_at is null then raise exception 'El pedido no está pagado'; end if;
  if it.fulfillment = 'cancelled' then raise exception 'Este artículo ya fue cancelado o reembolsado'; end if;
  if it.fulfillment = 'delivered'
     and it.delivered_at < now() - make_interval(days => dispute_window_days()) then
    raise exception 'Pasaron más de % días desde la entrega', dispute_window_days();
  end if;
  if has_open_dispute(p_item_id) then raise exception 'Ya hay una disputa abierta para este artículo'; end if;

  insert into disputes (kind, reporter_id, order_id, item_id, store_id, reason, details, evidence)
  values ('plazax_pay', auth.uid(), it.order_id, it.id, it.store_id, p_reason, trim(p_details),
          clean_evidence(p_evidence))
  returning id into did;
  insert into dispute_logs (dispute_id, ip, agent) values (did, request_ip(), request_agent());
  return did;
end $$;
--> statement-breakpoint
-- Cualquiera con cuenta: denuncia un trato externo (sin reembolso posible).
create or replace function public.report_external(
  p_store_slug text, p_contact text, p_reason text, p_details text, p_evidence text[] default '{}'
) returns uuid language plpgsql security definer set search_path = public as $$
declare sid uuid; did uuid;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if coalesce(trim(p_store_slug), '') <> '' then
    select id into sid from stores where slug = trim(p_store_slug);
  end if;
  if sid is null and coalesce(trim(p_contact), '') = '' then
    raise exception 'Indica la tienda o el contacto que denuncias';
  end if;
  insert into disputes (kind, reporter_id, store_id, reported_contact, reason, details, evidence)
  values ('external_deal', auth.uid(), sid, nullif(trim(p_contact), ''), p_reason, trim(p_details),
          clean_evidence(p_evidence))
  returning id into did;
  insert into dispute_logs (dispute_id, ip, agent) values (did, request_ip(), request_agent());
  return did;
end $$;
--> statement-breakpoint
-- Vendedora: responde con su versión (una vez, mientras está abierta).
create or replace function public.respond_dispute(p_id uuid, p_response text)
  returns void language plpgsql security definer set search_path = public as $$
begin
  update disputes set seller_response = trim(p_response), responded_at = now()
   where id = p_id and kind = 'plazax_pay' and status = 'open' and is_store_owner(store_id);
  if not found then raise exception 'No puedes responder esta disputa'; end if;
end $$;
--> statement-breakpoint
-- Administración: resuelve. 'refund' cancela el artículo (sale de las billeteras) y devuelve el
-- stock; el dinero se devuelve desde el panel de la pasarela. p_ban suspende al vendedor.
create or replace function public.resolve_dispute(
  p_id uuid, p_outcome text, p_note text, p_ban boolean default false
) returns void language plpgsql security definer set search_path = public as $$
declare d record; owner uuid;
begin
  if not is_admin() then raise exception 'Solo administración'; end if;
  if p_outcome not in ('refund', 'reject', 'close') then raise exception 'Resultado inválido'; end if;
  select * into d from disputes where id = p_id for update;
  if not found or d.status <> 'open' then raise exception 'La disputa no está abierta'; end if;
  if p_outcome = 'refund' and d.kind <> 'plazax_pay' then
    raise exception 'Los tratos externos no tienen reembolso por Plaza X';
  end if;

  if p_outcome = 'refund' then
    update order_items set fulfillment = 'cancelled', refunded_at = now() where id = d.item_id;
    update products pr set stock = pr.stock + oi.qty, sold_count = greatest(pr.sold_count - oi.qty, 0)
      from order_items oi where oi.id = d.item_id and pr.id = oi.product_id;
  end if;

  if p_ban then
    select owner_id into owner from stores where id = d.store_id;
    if owner is null then raise exception 'No hay una tienda que suspender'; end if;
    update profiles set banned_at = now(), ban_reason = left(coalesce(p_note, 'Disputa'), 300)
     where id = owner;
    update stores set active = false where owner_id = owner;
  end if;

  update disputes
     set status = case p_outcome when 'refund' then 'refunded' when 'reject' then 'rejected' else 'closed' end,
         resolution_note = nullif(trim(p_note), ''),
         banned_user = case when p_ban then owner else null end,
         resolved_at = now(), resolved_by = auth.uid()
   where id = p_id;
end $$;
--> statement-breakpoint
-- Administración: datos de registro para una solicitud judicial.
create or replace function public.dispute_audit(p_id uuid)
  returns table (reporter_email text, reporter_ip text, reporter_agent text, created_at timestamptz,
                 owner_email text, owner_banned_at timestamptz)
  language sql stable security definer set search_path = public, auth as $$
  select ru.email::text, l.ip, l.agent, d.created_at, ou.email::text, op.banned_at
    from disputes d
    join auth.users ru on ru.id = d.reporter_id
    left join dispute_logs l on l.dispute_id = d.id
    left join stores s on s.id = d.store_id
    left join auth.users ou on ou.id = s.owner_id
    left join profiles op on op.id = s.owner_id
   where d.id = p_id and public.is_admin()
$$;
--> statement-breakpoint
-- ---------------------------------------------------------------------
-- Despacho y recepción
-- ---------------------------------------------------------------------
drop function if exists public.set_fulfillment(uuid, text, text);
--> statement-breakpoint
create or replace function public.set_fulfillment(
  p_item_id uuid, p_status text, p_tracking text default null, p_carrier text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  -- La entrega la confirma el comprador (o se confirma sola tras auto_confirm_days()).
  if p_status not in ('preparing', 'shipped', 'cancelled') then raise exception 'Estado inválido'; end if;
  perform 1
    from order_items oi join stores s on s.id = oi.store_id
   where oi.id = p_item_id and s.owner_id = auth.uid() and oi.paid_at is not null
     and oi.fulfillment not in ('delivered', 'cancelled');
  if not found then raise exception 'No puedes modificar este pedido'; end if;
  if p_status = 'cancelled' and has_open_dispute(p_item_id) then
    raise exception 'Hay una disputa abierta: la resuelve la administración';
  end if;

  update order_items
     set fulfillment = p_status,
         tracking = coalesce(nullif(trim(p_tracking), ''), tracking),
         carrier = coalesce(nullif(trim(p_carrier), ''), carrier),
         shipped_at = case when p_status = 'shipped' then coalesce(shipped_at, now()) else shipped_at end
   where id = p_item_id;
end $$;
--> statement-breakpoint
create or replace function public.confirm_receipt(p_item_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
begin
  update order_items oi set fulfillment = 'delivered', delivered_at = now()
    from orders o
   where oi.id = p_item_id and o.id = oi.order_id and o.buyer_id = auth.uid()
     and oi.paid_at is not null and oi.fulfillment in ('preparing', 'shipped');
  if not found then raise exception 'No puedes confirmar este artículo'; end if;
end $$;
--> statement-breakpoint
-- Fecha efectiva de entrega: confirmada por el comprador o automática tras el despacho.
create or replace function public.effective_delivery(oi public.order_items) returns timestamptz
  language sql stable as $$
  select case
    when oi.fulfillment = 'delivered' then oi.delivered_at
    when oi.fulfillment = 'shipped' and oi.shipped_at is not null
      then oi.shipped_at + make_interval(days => auto_confirm_days())
  end
$$;
--> statement-breakpoint
-- Billetera: lo congelado por disputas no se libera ni se puede retirar.
drop function if exists public.my_wallet();
--> statement-breakpoint
create or replace function public.my_wallet()
  returns table (pending integer, available integer, withdrawn integer, frozen integer)
  language sql stable security definer set search_path = public as $$
  with mine as (
    select (case when s.owner_id = auth.uid() then oi.seller_amount else 0 end
          + case when oi.affiliate_id = auth.uid() then oi.affiliate_amount else 0 end) as amount,
           has_open_dispute(oi.id) as is_frozen,
           coalesce(effective_delivery(oi) <= now() - make_interval(days => hold_days()), false) as released
      from order_items oi join stores s on s.id = oi.store_id
     where oi.paid_at is not null and oi.fulfillment <> 'cancelled'
       and (s.owner_id = auth.uid() or oi.affiliate_id = auth.uid())
  ), wd as (
    select coalesce(sum(amount), 0)::int as w from withdrawals where user_id = auth.uid() and status <> 'rejected'
  )
  select coalesce(sum(amount) filter (where not is_frozen and not released), 0)::int,
         (coalesce(sum(amount) filter (where not is_frozen and released), 0) - (select w from wd))::int,
         (select w from wd),
         coalesce(sum(amount) filter (where is_frozen), 0)::int
    from mine
$$;
--> statement-breakpoint
create or replace function public.request_withdrawal(p_amount integer, p_method text, p_account text)
  returns uuid language plpgsql security definer set search_path = public as $$
declare avail integer; wid uuid;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if is_banned() then raise exception 'Tu cuenta está suspendida. Escríbenos a soporte'; end if;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  select available into avail from my_wallet();
  if p_amount < min_withdrawal() then raise exception 'El retiro mínimo es $50.000'; end if;
  if p_amount > avail then raise exception 'Saldo disponible insuficiente'; end if;
  insert into withdrawals (user_id, amount, method, account)
  values (auth.uid(), p_amount, p_method, trim(p_account)) returning id into wid;
  return wid;
end $$;
--> statement-breakpoint
-- ---------------------------------------------------------------------
-- Evidencias: archivos privados (solo quien los sube y la administración)
-- Ruta: <user_id>/<nombre>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dispute-evidence', 'dispute-evidence', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'application/pdf'])
on conflict (id) do nothing;
--> statement-breakpoint
drop policy if exists "evidencias: subir propias" on storage.objects;
--> statement-breakpoint
create policy "evidencias: subir propias" on storage.objects for insert to authenticated
  with check (bucket_id = 'dispute-evidence' and (storage.foldername(name))[1] = auth.uid()::text);
--> statement-breakpoint
drop policy if exists "evidencias: leer" on storage.objects;
--> statement-breakpoint
create policy "evidencias: leer" on storage.objects for select to authenticated
  using (bucket_id = 'dispute-evidence'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
