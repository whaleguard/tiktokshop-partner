-- TikTok Shop KR·JP mall: catalog extensions + orders. Safe to re-run.

alter table public.tts_catalog
  add column if not exists list_price_krw numeric,
  add column if not exists list_price_jpy numeric,
  add column if not exists stock int,
  add column if not exists sold int not null default 0,
  add column if not exists rating numeric,
  add column if not exists tts_url text,
  add column if not exists images jsonb not null default '[]'::jsonb,
  add column if not exists detail text,
  add column if not exists options text,
  add column if not exists mall boolean not null default true,
  add column if not exists live boolean not null default false,
  add column if not exists free_ship boolean not null default false,
  add column if not exists section text;

create table if not exists public.tts_orders (
  id text primary key,
  status text not null default 'new' check (status in ('new','paid','preparing','shipping','delivered','cancelled')),
  lang text,
  currency text not null check (currency in ('KRW','JPY')),
  name text not null, phone text, email text not null, country text, zip text, addr1 text, addr2 text, note text,
  pay_method text not null default 'bank' check (pay_method in ('bank')),
  items jsonb not null,
  subtotal numeric not null default 0,
  shipping numeric not null default 0,
  total numeric not null default 0,
  tracking text not null default '',
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tts_orders_created on public.tts_orders (created_at desc);

-- Server-side pricing: on insert, items are re-priced from tts_catalog; client totals are ignored.
create or replace function public.tts_order_price() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  it jsonb; p record; q int; price numeric; out jsonb := '[]'::jsonb; sub numeric := 0;
  cfg jsonb; ship numeric := 0; free_over numeric;
begin
  if jsonb_typeof(new.items) <> 'array' or jsonb_array_length(new.items) = 0 or jsonb_array_length(new.items) > 50 then
    raise exception 'invalid items';
  end if;
  for it in select * from jsonb_array_elements(new.items) loop
    q := greatest(1, least(999, coalesce((it->>'qty')::int, 1)));
    select * into p from public.tts_catalog where id::text = it->>'id' and active and mall;
    if not found then raise exception 'product unavailable'; end if;
    price := case when new.currency = 'JPY' then p.price_jpy else p.price_krw end;
    if price is null then raise exception 'price unavailable'; end if;
    out := out || jsonb_build_object('id', p.id, 'name', p.name, 'brand', p.brand, 'img', p.img_url,
             'option', left(coalesce(it->>'option',''), 100), 'qty', q, 'price', price);
    sub := sub + price * q;
  end loop;
  select data into cfg from public.tts_config where id = 1;
  if new.currency = 'JPY' then
    ship := coalesce((cfg->>'shipJPY')::numeric, 0); free_over := (cfg->>'freeOverJPY')::numeric;
  else
    ship := coalesce((cfg->>'shipKRW')::numeric, 0); free_over := (cfg->>'freeOverKRW')::numeric;
  end if;
  if free_over is not null and sub >= free_over then ship := 0; end if;
  if coalesce(cfg->>'mallOpen','false') <> 'true' then raise exception 'mall closed'; end if;
  new.items := out; new.subtotal := sub; new.shipping := ship; new.total := sub + ship;
  new.status := 'new'; new.tracking := ''; new.memo := ''; new.pay_method := 'bank';
  new.created_at := now(); new.updated_at := now();
  return new;
end $$;
drop trigger if exists tts_order_price_trg on public.tts_orders;
create trigger tts_order_price_trg before insert on public.tts_orders for each row execute function public.tts_order_price();

-- Customer order lookup: order id + email must both match
create or replace function public.tts_order_status(p_id text, p_email text)
returns table (id text, status text, tracking text, currency text, items jsonb, subtotal numeric, shipping numeric, total numeric, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select o.id, o.status, o.tracking, o.currency, o.items, o.subtotal, o.shipping, o.total, o.created_at
  from public.tts_orders o where o.id = upper(trim(p_id)) and lower(o.email) = lower(trim(p_email));
$$;

alter table public.tts_orders enable row level security;
drop policy if exists tts_ord_insert on public.tts_orders;
create policy tts_ord_insert on public.tts_orders for insert to anon, authenticated
  with check (length(id) between 8 and 40 and length(coalesce(note,'')) < 2000 and length(coalesce(addr1,'')) < 500);
drop policy if exists tts_ord_admin on public.tts_orders;
create policy tts_ord_admin on public.tts_orders for all to authenticated
  using (public.tts_is_admin()) with check (public.tts_is_admin());

grant insert on public.tts_orders to anon;
grant select, insert, update, delete on public.tts_orders to authenticated;
grant execute on function public.tts_order_status(text, text) to anon, authenticated;
