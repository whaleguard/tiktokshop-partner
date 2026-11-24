-- KJ SHOPLINK (TikTok Shop 입점 파트너 사이트) — Supabase 스키마
-- 접두사 tts_ 로 다른 서비스 테이블과 분리. 여러 번 실행해도 안전.

create table if not exists public.tts_requests (
  id text primary key,
  type text not null check (type in ('brand','creator','shop','buy','studio')),
  status text not null default 'new' check (status in ('new','review','progress','done','hold','rejected')),
  lang text, market text, name text, company text, email text, phone text, messenger text, country text,
  fields jsonb not null default '{}'::jsonb,
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tts_requests_created on public.tts_requests (created_at desc);

create table if not exists public.tts_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null, brand text, category text, sort int not null default 0,
  price_krw numeric, price_jpy numeric, commission numeric, moq numeric,
  descr text, img_url text,
  sample boolean not null default true, active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.tts_config (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.tts_config (id, data) values (1, '{}'::jsonb) on conflict (id) do nothing;

create table if not exists public.tts_admins (
  email text primary key,
  created_at timestamptz not null default now()
);

create or replace function public.tts_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tts_admins where email = lower(coalesce(auth.jwt() ->> 'email','')));
$$;

-- 첫 관리자 등록: 관리자가 한 명도 없을 때만, 로그인한 본인을 관리자로 등록
create or replace function public.tts_claim_admin() returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not exists (select 1 from public.tts_admins) then
    insert into public.tts_admins (email) values (lower(auth.jwt() ->> 'email')) on conflict do nothing;
  end if;
  return public.tts_is_admin();
end $$;

-- 신청자 본인 조회: 접수번호 + 신청 이메일이 모두 맞을 때만 상태 반환
create or replace function public.tts_status(p_ids text[], p_email text)
returns table (id text, type text, status text, company text, name text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, r.type, r.status, r.company, r.name, r.created_at
  from public.tts_requests r
  where r.id = any (p_ids[1:50]) and lower(r.email) = lower(trim(p_email));
$$;

alter table public.tts_requests enable row level security;
alter table public.tts_catalog  enable row level security;
alter table public.tts_config   enable row level security;
alter table public.tts_admins   enable row level security;

drop policy if exists tts_req_insert on public.tts_requests;
create policy tts_req_insert on public.tts_requests for insert to anon, authenticated
  with check (status = 'new' and memo = '' and length(id) between 8 and 40 and length(fields::text) < 20000);
drop policy if exists tts_req_admin on public.tts_requests;
create policy tts_req_admin on public.tts_requests for all to authenticated
  using (public.tts_is_admin()) with check (public.tts_is_admin());

drop policy if exists tts_cat_read on public.tts_catalog;
create policy tts_cat_read on public.tts_catalog for select to anon, authenticated using (active or public.tts_is_admin());
drop policy if exists tts_cat_admin on public.tts_catalog;
create policy tts_cat_admin on public.tts_catalog for all to authenticated
  using (public.tts_is_admin()) with check (public.tts_is_admin());

drop policy if exists tts_cfg_read on public.tts_config;
create policy tts_cfg_read on public.tts_config for select to anon, authenticated using (true);
drop policy if exists tts_cfg_admin on public.tts_config;
create policy tts_cfg_admin on public.tts_config for all to authenticated
  using (public.tts_is_admin()) with check (public.tts_is_admin());

drop policy if exists tts_adm_admin on public.tts_admins;
create policy tts_adm_admin on public.tts_admins for all to authenticated
  using (public.tts_is_admin()) with check (public.tts_is_admin());

grant insert on public.tts_requests to anon;
grant select, insert, update, delete on public.tts_requests to authenticated;
grant select on public.tts_catalog, public.tts_config to anon;
grant select, insert, update, delete on public.tts_catalog, public.tts_config, public.tts_admins to authenticated;
grant execute on function public.tts_is_admin(), public.tts_status(text[], text) to anon, authenticated;
grant execute on function public.tts_claim_admin() to authenticated;

-- 이미지 저장소 (로고·파트너 배지·상품 이미지): 공개 읽기, 관리자만 업로드/삭제
insert into storage.buckets (id, name, public) values ('tts-assets', 'tts-assets', true) on conflict (id) do nothing;
drop policy if exists tts_assets_admin_ins on storage.objects;
create policy tts_assets_admin_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'tts-assets' and public.tts_is_admin());
drop policy if exists tts_assets_admin_upd on storage.objects;
create policy tts_assets_admin_upd on storage.objects for update to authenticated
  using (bucket_id = 'tts-assets' and public.tts_is_admin());
drop policy if exists tts_assets_admin_del on storage.objects;
create policy tts_assets_admin_del on storage.objects for delete to authenticated
  using (bucket_id = 'tts-assets' and public.tts_is_admin());
