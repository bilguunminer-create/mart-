set local lock_timeout='5s';
alter table public.site_visits add column if not exists user_id uuid;
alter table public.site_visits add column if not exists visit_key uuid;
create unique index if not exists site_visits_visit_key_idx on public.site_visits(visit_key);
create or replace function public.log_site_visit_v2(p_visitor_id uuid,p_visit_key uuid,p_path text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_visitor_id is null or p_visit_key is null then raise exception 'INVALID_VISITOR'; end if;
 insert into public.site_visits(visitor_id,user_id,visit_key,path)
 values(p_visitor_id,auth.uid(),p_visit_key,left(coalesce(p_path,''),200))
 on conflict(visit_key) do update set user_id=coalesce(public.site_visits.user_id,excluded.user_id)
 where public.site_visits.visitor_id=excluded.visitor_id
 and (public.site_visits.user_id is null or public.site_visits.user_id=excluded.user_id);
end;
$$;
revoke all on function public.log_site_visit_v2(uuid,uuid,text) from public;
grant execute on function public.log_site_visit_v2(uuid,uuid,text) to anon,authenticated;
create or replace function public.log_site_visit(p_visitor_id uuid,p_path text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.log_site_visit_v2(p_visitor_id,gen_random_uuid(),p_path);
end;
$$;
create or replace function public.get_site_visit_stats()
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; today_start timestamptz:=date_trunc('day',now() at time zone 'Asia/Ulaanbaatar') at time zone 'Asia/Ulaanbaatar';
begin
 if not private.is_store_admin() then raise exception 'FORBIDDEN'; end if;
 with identities as (
 select id,created_at,case when user_id is not null then 'account:'||user_id::text else 'browser:'||visitor_id::text end as identity
 from public.site_visits
 ), ranked as (
 select *,row_number() over(partition by identity order by created_at,id) as visit_number from identities
 ), periods(label,since) as (
 values ('total','-infinity'::timestamptz),('today',today_start),('last7days',now()-interval '7 days'),('last30days',now()-interval '30 days')
 ), counts as (
 select p.label,count(r.id) as views,count(distinct r.identity) as visitors,
 count(r.id) filter(where r.visit_number=1) as new_visitors,
 count(r.id) filter(where r.visit_number>1) as repeat_visits
 from periods p left join ranked r on r.created_at>=p.since group by p.label
 )
 select jsonb_object_agg(key,value) into result from counts c cross join lateral (
 values(c.label||'_pageviews',c.views),(c.label||'_unique_visitors',c.visitors),
 (c.label||'_new_visitors',c.new_visitors),(c.label||'_repeat_visits',c.repeat_visits)
 ) fields(key,value);
 return result;
end;
$$;
do $test$
declare u uuid:=gen_random_uuid(); v uuid:=gen_random_uuid(); b1 uuid:=gen_random_uuid(); b2 uuid:=gen_random_uuid();
 k1 uuid:=gen_random_uuid(); k2 uuid:=gen_random_uuid(); k3 uuid:=gen_random_uuid(); baseline jsonb; result jsonb;
begin
 begin
 insert into auth.users(id,email,email_confirmed_at,is_anonymous) values(u,u::text||'@example.invalid',now(),false);
 insert into public.allowed_accounts(email) values(u::text||'@example.invalid');
 perform set_config('request.jwt.claim.sub',u::text,true);
 baseline:=public.get_site_visit_stats();
 perform set_config('request.jwt.claim.sub','',true);
 perform public.log_site_visit_v2(b1,k1,'/');
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform public.log_site_visit_v2(b1,k1,'/');
 perform public.log_site_visit_v2(b1,k1,'/');
 assert (select count(*)=1 from public.site_visits where visit_key=k1),'Login/retry doubled view';
 assert (select user_id=u from public.site_visits where visit_key=k1),'Login identity missing';
 perform public.log_site_visit_v2(b2,k2,'/');
 perform set_config('request.jwt.claim.sub',v::text,true);
 perform public.log_site_visit_v2(b2,k3,'/');
 perform public.log_site_visit_v2(b1,k1,'/');
 assert (select user_id=u from public.site_visits where visit_key=k1),'Identity reassigned';
 perform set_config('request.jwt.claim.sub',u::text,true);
 result:=public.get_site_visit_stats();
 assert (result->>'total_pageviews')::bigint=(baseline->>'total_pageviews')::bigint+3,'Pageviews';
 assert (result->>'total_unique_visitors')::bigint=(baseline->>'total_unique_visitors')::bigint+2,'Cross-device account deduplication';
 assert (result->>'total_new_visitors')::bigint=(baseline->>'total_new_visitors')::bigint+2,'New visitors';
 assert (result->>'total_repeat_visits')::bigint=(baseline->>'total_repeat_visits')::bigint+1,'Repeat visits';
 update public.site_visits set created_at=now()-interval '2 days' where visit_key=k1;
 result:=public.get_site_visit_stats();
 assert (result->>'today_new_visitors')::bigint=(baseline->>'today_new_visitors')::bigint+1,'Returning visitor counted new today';
 assert (result->>'today_repeat_visits')::bigint=(baseline->>'today_repeat_visits')::bigint+1,'Returning visit today';
 perform set_config('request.jwt.claim.sub','',true);
 begin perform public.get_site_visit_stats(); raise exception 'ANON_STATS_ALLOWED';
 exception when others then assert sqlerrm='FORBIDDEN','Statistics access'; end;
 raise exception using errcode='ZX003',message='ROLLBACK_VISIT_FIXTURES';
 exception when sqlstate 'ZX003' then null;
 end;
 assert not exists(select 1 from public.site_visits where visit_key in(k1,k2,k3)),'Fixtures survived';
end;
$test$;
