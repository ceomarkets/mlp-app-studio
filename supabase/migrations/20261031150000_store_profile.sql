-- Perfil de tienda: cobertura de envíos y verificación (solo la administración la otorga).

alter table public.stores add column if not exists ships_national boolean not null default true;
alter table public.stores add column if not exists verified boolean not null default false;
alter table public.stores add column if not exists verified_at timestamptz;

-- Solo una persona administradora puede cambiar la verificación.
create or replace function public.protect_store_admin_fields() returns trigger
  language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.verified := false;
      new.verified_at := null;
    else
      new.verified := old.verified;
      new.verified_at := old.verified_at;
    end if;
  elsif tg_op = 'UPDATE' and new.verified is distinct from old.verified then
    new.verified_at := case when new.verified then now() else null end;
  end if;
  return new;
end $$;

drop trigger if exists stores_protect_admin_fields on public.stores;
create trigger stores_protect_admin_fields before insert or update on public.stores
  for each row execute function public.protect_store_admin_fields();

-- La administración puede ver y actualizar cualquier tienda (verificar, suspender).
drop policy if exists "tiendas: administración" on public.stores;
create policy "tiendas: administración" on public.stores for all
  using (public.is_admin()) with check (public.is_admin());
