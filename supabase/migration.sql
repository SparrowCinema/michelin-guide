-- Applied to Supabase project dclxhxxjktegyiwafmsv as migration "sync_code_storage" (2026-10-27).
create extension if not exists pgcrypto with schema extensions;

-- One row per sync code. The code itself is never stored, only its SHA-256.
create table public.mg_sync (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  rev integer not null default 0,
  updated_at timestamptz not null default now()
);
create table public.mg_photos (
  sync_id text not null references public.mg_sync(id) on delete cascade,
  photo_id text not null,
  data text not null,
  created_at timestamptz not null default now(),
  primary key (sync_id, photo_id)
);
alter table public.mg_sync enable row level security;
alter table public.mg_photos enable row level security;
-- No policies: the tables are reachable only through the functions below.
revoke all on public.mg_sync, public.mg_photos from anon, authenticated;

create or replace function public.mg_key(code text) returns text
language plpgsql immutable set search_path = '' as $$
begin
  if code is null or length(code) < 20 or length(code) > 100 or code !~ '^[A-Z0-9-]+$' then
    raise exception 'invalid sync code' using errcode = '22023';
  end if;
  return encode(extensions.digest(code, 'sha256'), 'hex');
end $$;

create or replace function public.mg_pull(code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k text := public.mg_key(code); r public.mg_sync;
begin
  select * into r from public.mg_sync where id = k;
  if not found then return jsonb_build_object('rev', 0, 'data', null); end if;
  return jsonb_build_object('rev', r.rev, 'data', r.data, 'updated_at', r.updated_at,
    'photos', coalesce((select jsonb_agg(photo_id) from public.mg_photos where sync_id = k), '[]'::jsonb));
end $$;

-- Optimistic concurrency: only writes when the caller saw the latest revision.
create or replace function public.mg_push(code text, data jsonb, base_rev integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k text := public.mg_key(code); cur integer;
begin
  if octet_length(data::text) > 5000000 then raise exception 'sync data too large' using errcode = '22023'; end if;
  insert into public.mg_sync(id) values (k) on conflict (id) do nothing;
  select rev into cur from public.mg_sync where id = k for update;
  if cur <> base_rev then return jsonb_build_object('ok', false, 'rev', cur); end if;
  update public.mg_sync set data = mg_push.data, rev = cur + 1, updated_at = now() where id = k;
  return jsonb_build_object('ok', true, 'rev', cur + 1);
end $$;

create or replace function public.mg_photo_put(code text, photo_id text, data text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare k text := public.mg_key(code);
begin
  if photo_id !~ '^p-[a-z0-9-]{4,60}$' then raise exception 'invalid photo id' using errcode = '22023'; end if;
  if data !~ '^data:image/(jpeg|png|webp);base64,' or length(data) > 4000000 then raise exception 'invalid photo' using errcode = '22023'; end if;
  if not exists (select 1 from public.mg_sync where id = k) then raise exception 'unknown sync code' using errcode = '22023'; end if;
  if (select count(*) from public.mg_photos where sync_id = k) >= 3000 then raise exception 'photo limit reached' using errcode = '22023'; end if;
  insert into public.mg_photos(sync_id, photo_id, data) values (k, photo_id, data) on conflict do nothing;
  return true;
end $$;

create or replace function public.mg_photo_get(code text, ids text[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k text := public.mg_key(code);
begin
  return coalesce((select jsonb_object_agg(photo_id, data) from public.mg_photos
    where sync_id = k and photo_id = any(ids[1:20])), '{}'::jsonb);
end $$;

create or replace function public.mg_photo_delete(code text, ids text[]) returns integer
language plpgsql security definer set search_path = '' as $$
declare k text := public.mg_key(code); n integer;
begin
  delete from public.mg_photos where sync_id = k and photo_id = any(ids);
  get diagnostics n = row_count; return n;
end $$;

revoke all on function public.mg_key(text) from public, anon, authenticated;
revoke all on function public.mg_pull(text), public.mg_push(text, jsonb, integer), public.mg_photo_put(text, text, text),
  public.mg_photo_get(text, text[]), public.mg_photo_delete(text, text[]) from public;
grant execute on function public.mg_pull(text), public.mg_push(text, jsonb, integer), public.mg_photo_put(text, text, text),
  public.mg_photo_get(text, text[]), public.mg_photo_delete(text, text[]) to anon, authenticated;
