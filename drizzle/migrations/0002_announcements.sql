-- =====================================================================
-- Plaza X · anuncios de la plataforma (idempotente)
--   * admins: quién administra Plaza X. El primer administrador se agrega
--     a mano (ver README): insert into public.admins (user_id) values ('<uuid>');
--   * announcements: mensajes que aparecen en el leaderboard y la banda.
--     Públicos solo mientras están activos y dentro de sus fechas.
--   * Los enlaces solo pueden ser rutas internas (/...) o https://,
--     nunca javascript: ni otros esquemas.
-- =====================================================================

create table if not exists public.admins (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now()
);
--> statement-breakpoint
alter table public.admins enable row level security;
--> statement-breakpoint
-- Sin políticas: nadie puede leer ni escribir la tabla desde la app.

create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid())
$$;
--> statement-breakpoint
grant execute on function public.is_admin() to anon, authenticated;
--> statement-breakpoint
create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 3 and 80),
  body        text not null default '' check (char_length(body) <= 160),
  emoji       text not null default '📣' check (char_length(emoji) <= 8),
  image       text check (image is null or image ~ '^https://'),
  link        text check (link is null or link ~ '^(/[^/]|/$|https://)'),
  cta         text not null default 'Ver más' check (char_length(cta) between 2 and 24),
  tone        text not null default 'promo' check (tone in ('promo', 'news', 'event', 'info')),
  priority    integer not null default 0 check (priority between 0 and 100),
  active      boolean not null default true,
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz,
  created_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
--> statement-breakpoint
create index if not exists announcements_live_idx on public.announcements (active, starts_at, ends_at);
--> statement-breakpoint
drop trigger if exists announcements_touch on public.announcements;
--> statement-breakpoint
create trigger announcements_touch before update on public.announcements
  for each row execute function public.touch_updated_at();
--> statement-breakpoint
alter table public.announcements enable row level security;
--> statement-breakpoint
drop policy if exists "anuncios: leer vigentes" on public.announcements;
--> statement-breakpoint
create policy "anuncios: leer vigentes" on public.announcements for select using (
  (active and starts_at <= now() and (ends_at is null or ends_at > now()))
  or public.is_admin()
);
--> statement-breakpoint
drop policy if exists "anuncios: crear (admin)" on public.announcements;
--> statement-breakpoint
create policy "anuncios: crear (admin)" on public.announcements for insert with check (public.is_admin());
--> statement-breakpoint
drop policy if exists "anuncios: editar (admin)" on public.announcements;
--> statement-breakpoint
create policy "anuncios: editar (admin)" on public.announcements for update
  using (public.is_admin()) with check (public.is_admin());
--> statement-breakpoint
drop policy if exists "anuncios: borrar (admin)" on public.announcements;
--> statement-breakpoint
create policy "anuncios: borrar (admin)" on public.announcements for delete using (public.is_admin());
