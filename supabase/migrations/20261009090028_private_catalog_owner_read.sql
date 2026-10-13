create schema if not exists studio_private;
revoke all on schema studio_private from public,anon;
grant usage on schema studio_private to authenticated;
create function studio_private.is_owner() returns boolean language sql stable security definer set search_path = '' as $$
select exists(select 1 from auth.users u where u.id=(select auth.uid()) and lower(u.email)='bilguunminer@gmail.com' and u.email_confirmed_at is not null and u.deleted_at is null);
$$;
revoke all on function studio_private.is_owner() from public,anon;
grant execute on function studio_private.is_owner() to authenticated;
create policy studio_owner_read on storage.objects for select to authenticated using (bucket_id='dtf-catalog' and (select studio_private.is_owner()));
