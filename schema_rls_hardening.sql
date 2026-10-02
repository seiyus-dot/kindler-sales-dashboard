-- =============================================
-- RLS の締め直し（2026-10-02）
-- 調査で、公開用の鍵（ブラウザに埋め込まれる anon / publishable）だけで、ログインなしに
-- aicamp_consultations・line_friends・deals_*・contacts など25テーブルが読めることが分かった。
-- public の全テーブルで RLS を有効にし、既存の許可ポリシーを「ログインした社内メンバーのみ」に置き換える。
-- 代理店アカウントの締め出し（no agency users）も全テーブルに付け直す。
--
-- 例外: product_aicamp_sessions は公開の申込フォーム（/product-aicamp/apply）が日程一覧を読むため、閲覧のみ誰でも可。
-- Webhook・MCP・各APIは Service Role（RLS対象外）で読み書きするので影響しない。
-- allowed_emails（権限表）は、書き込みを admin のみにする（member が自分を admin にできないように）。
-- Supabase SQL Editor で実行（再実行安全）。schema_ad_agencies.sql の後に実行すること。
-- =============================================

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from allowed_emails
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and role = 'admin' and agency_id is null
  );
$$;
grant execute on function public.is_admin_user() to authenticated;

do $$
declare
  t record;
  p record;
begin
  for t in
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('alter table public.%I enable row level security', t.relname);

    -- 既存の許可（permissive）ポリシーをすべて外す（"allow all" や anon 向けのものを残さない）
    for p in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t.relname and permissive = 'PERMISSIVE'
    loop
      execute format('drop policy %I on public.%I', p.policyname, t.relname);
    end loop;

    if t.relname = 'product_aicamp_sessions' then
      execute format('create policy "public select" on public.%I for select using (true)', t.relname);
      execute format('create policy "authenticated write" on public.%I for insert with check (auth.uid() is not null)', t.relname);
      execute format('create policy "authenticated update" on public.%I for update using (auth.uid() is not null) with check (auth.uid() is not null)', t.relname);
      execute format('create policy "authenticated delete" on public.%I for delete using (auth.uid() is not null)', t.relname);
    elsif t.relname = 'allowed_emails' then
      execute format('create policy "authenticated read" on public.%I for select to authenticated using (auth.uid() is not null)', t.relname);
      execute format('create policy "admin write" on public.%I for all to authenticated using (public.is_admin_user()) with check (public.is_admin_user())', t.relname);
    else
      execute format('create policy "authenticated users only" on public.%I for all to authenticated using (auth.uid() is not null) with check (auth.uid() is not null)', t.relname);
    end if;

    -- 代理店アカウントは社内データを読み書きできない（社内メンバーには影響なし）
    -- （未ログインの公開閲覧は is_agency_user() が false なので、product_aicamp_sessions の公開閲覧も妨げない）
    execute format('drop policy if exists "no agency users" on public.%I', t.relname);
    execute format(
      'create policy "no agency users" on public.%I as restrictive for all using (not public.is_agency_user()) with check (not public.is_agency_user())',
      t.relname
    );
  end loop;
end $$;
