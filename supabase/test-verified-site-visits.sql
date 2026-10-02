-- Run as database owner after add-verified-site-visits.sql.
-- Every fixture and test mutation is rolled back, including on assertion failure.
begin;
set local statement_timeout = '20s';
do $test$
declare
  u1 uuid := gen_random_uuid();
  u2 uuid := gen_random_uuid();
  unconfirmed uuid := gen_random_uuid();
  anonymous_user uuid := gen_random_uuid();
  b1 uuid := gen_random_uuid();
  b2 uuid := gen_random_uuid();
  s1 uuid := gen_random_uuid();
  s2 uuid := gen_random_uuid();
  s3 uuid := gen_random_uuid();
  s4 uuid := gen_random_uuid();
  s5 uuid := gen_random_uuid();
  guest_key uuid := gen_random_uuid();
  keys uuid[] := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  baseline jsonb;
  result jsonb;
  recent jsonb;
begin
  assert not has_function_privilege('anon', 'public.log_site_visit_v3(uuid,uuid,text,inet,text,uuid,uuid)', 'EXECUTE'), 'Anonymous can forge proof';
  assert not has_function_privilege('authenticated', 'public.log_site_visit_v3(uuid,uuid,text,inet,text,uuid,uuid)', 'EXECUTE'), 'Client can forge proof';
  assert has_function_privilege('service_role', 'public.log_site_visit_v3(uuid,uuid,text,inet,text,uuid,uuid)', 'EXECUTE'), 'Trusted server blocked';
  assert not has_table_privilege('authenticated', 'public.site_visits', 'INSERT'), 'Direct visit forgery';
  assert not has_table_privilege('authenticated', 'public.site_visits', 'SELECT'), 'Raw IP exposure';
  assert not has_function_privilege('anon', 'public.get_recent_site_visits(integer)', 'EXECUTE'), 'Anonymous IP exposure';

  insert into auth.users(id, email, email_confirmed_at, is_anonymous)
  values (u1, u1::text || '@example.invalid', now(), false),
    (u2, u2::text || '@example.invalid', now(), false),
    (unconfirmed, unconfirmed::text || '@example.invalid', null, false),
    (anonymous_user, anonymous_user::text || '@example.invalid', now(), true);
  insert into auth.sessions(id, user_id, created_at, updated_at)
  values (s1, u1, now(), now()), (s2, u1, now(), now()), (s3, u2, now(), now()),
    (s4, unconfirmed, now(), now()), (s5, anonymous_user, now(), now());
  insert into public.allowed_accounts(email) values(u1::text || '@example.invalid');
  perform set_config('request.jwt.claim.sub', u1::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', u1, 'role', 'authenticated')::text, true);
  baseline := public.get_site_visit_stats();

  -- Guest page + sign-in upgrade + request retry count as one page and one login.
  perform public.log_site_visit_v3(b1, keys[1], '/', '192.0.2.11', 'SQL verification');
  perform public.log_site_visit_v3(b1, keys[1], '/', '192.0.2.11', 'SQL verification', u1, s1);
  perform public.log_site_visit_v3(b1, keys[1], '/', '192.0.2.11', 'SQL verification', u1, s1);
  assert (select count(*) = 1 from public.site_visits where visit_key = keys[1]), 'Retry doubled pageview';
  assert (select server_verified and auth_session_id = s1 and user_id = u1 from public.site_visits where visit_key = keys[1]), 'Login upgrade missing';

  -- Reload/token refresh reuses s1. A new sign-in is s2. Shared IP is not identity.
  perform public.log_site_visit_v3(b1, keys[2], '/', '192.0.2.11', 'SQL verification', u1, s1);
  perform public.log_site_visit_v3(b1, keys[3], '/', '192.0.2.11', 'SQL verification', u1, s2);
  perform public.log_site_visit_v3(b2, keys[4], '/', '192.0.2.11', 'SQL verification', u2, s3);
  perform public.log_site_visit_v3(b2, keys[5], '/', '2001:db8::11', 'SQL verification', u2, s3);
  perform public.log_site_visit_v2(b1, keys[6], '/legacy');
  assert (select count(*) = 3 from private.site_login_sessions where user_id in(u1, u2)), 'Refresh or IP change counted as new login';
  assert (select not server_verified and ip_address is null and auth_session_id is null from public.site_visits where visit_key = keys[6]), 'Legacy view gained proof';

  -- Legacy callers cannot overwrite the identity of a trusted guest page.
  perform public.log_site_visit_v3(b1, guest_key, '/guest', '192.0.2.11', 'SQL verification');
  perform public.log_site_visit_v2(b1, guest_key, '/guest');
  assert (select user_id is null and auth_session_id is null from public.site_visits where visit_key = guest_key), 'Legacy call mutated trusted guest';

  result := public.get_site_visit_stats();
  assert (result->>'total_pageviews')::bigint = (baseline->>'total_pageviews')::bigint + 7, 'Pageview count';
  assert (result->>'total_verified_login_sessions')::bigint = (baseline->>'total_verified_login_sessions')::bigint + 3, 'Verified session count';
  assert (result->>'total_repeat_logins')::bigint = (baseline->>'total_repeat_logins')::bigint + 1, 'Repeat sign-in count';
  assert (result->>'total_unique_ips')::bigint >= (baseline->>'total_unique_ips')::bigint, 'IP count decreased';
  assert (select count(distinct ip_address) = 2 from public.site_visits where visitor_id in(b1,b2) and server_verified), 'IPv4/IPv6 grouping';
  assert (result->>'total_unverified_pageviews')::bigint = (baseline->>'total_unverified_pageviews')::bigint + 2, 'Guest/legacy verification count';
  assert (select count(distinct user_id) = 2 from private.site_login_sessions where first_ip_address = '192.0.2.11' and user_id in(u1,u2)), 'Shared IP merged accounts';

  update private.site_login_sessions set first_seen_at = now() - interval '2 days' where auth_session_id = s1;
  result := public.get_site_visit_stats();
  assert (result->>'today_verified_login_sessions')::bigint = (baseline->>'today_verified_login_sessions')::bigint + 2, 'Session periods';
  assert (result->>'today_repeat_logins')::bigint = (baseline->>'today_repeat_logins')::bigint + 1, 'Returning account mislabeled first login';

  begin
    perform public.log_site_visit_v3(b2, keys[1], '/', '192.0.2.11', 'SQL verification', u2, s3);
    raise exception 'EXPECTED_IDENTITY_CONFLICT';
  exception when others then
    assert sqlerrm = 'VISIT_IDENTITY_CONFLICT', 'Page identity reassigned';
  end;
  begin
    perform public.log_site_visit_v3(b1, gen_random_uuid(), '/', '192.0.2.11', 'SQL verification', u1, s3);
    raise exception 'EXPECTED_SESSION_REJECTION';
  exception when others then
    assert sqlerrm = 'INVALID_AUTH_SESSION', 'Session owner not checked';
  end;
  begin
    perform public.log_site_visit_v3(b1, gen_random_uuid(), '/', null, '', unconfirmed, s4);
    raise exception 'EXPECTED_UNCONFIRMED_REJECTION';
  exception when others then
    assert sqlerrm = 'INVALID_AUTH_SESSION', 'Unconfirmed user gained proof';
  end;
  begin
    perform public.log_site_visit_v3(b1, gen_random_uuid(), '/', null, '', anonymous_user, s5);
    raise exception 'EXPECTED_ANONYMOUS_REJECTION';
  exception when others then
    assert sqlerrm = 'INVALID_AUTH_SESSION', 'Anonymous auth gained proof';
  end;
  update auth.sessions set not_after = now() - interval '1 minute' where id = s2;
  begin
    perform public.log_site_visit_v3(b1, gen_random_uuid(), '/', null, '', u1, s2);
    raise exception 'EXPECTED_EXPIRED_REJECTION';
  exception when others then
    assert sqlerrm = 'INVALID_AUTH_SESSION', 'Expired session gained proof';
  end;
  delete from auth.sessions where id = s3;
  begin
    perform public.log_site_visit_v3(b2, gen_random_uuid(), '/', null, '', u2, s3);
    raise exception 'EXPECTED_REVOKED_REJECTION';
  exception when others then
    assert sqlerrm = 'INVALID_AUTH_SESSION', 'Revoked session gained proof';
  end;
  assert (select count(*) = 1 from private.site_login_sessions where auth_session_id = s3), 'Logout erased observed login evidence';

  recent := public.get_recent_site_visits(5);
  assert jsonb_array_length(recent) <= 5, 'Recent limit ignored';
  assert not exists(select 1 from jsonb_array_elements(recent) r where r->>'identity_status' not in('verified','guest','legacy')), 'Recent status contract';
  perform set_config('request.jwt.claim.sub', u2::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', u2, 'role', 'authenticated')::text, true);
  begin
    perform public.get_recent_site_visits(5);
    raise exception 'EXPECTED_NONADMIN_REJECTION';
  exception when others then
    assert sqlerrm = 'FORBIDDEN', 'Customer can read IP history';
  end;
  begin
    perform public.get_site_visit_stats();
    raise exception 'EXPECTED_NONADMIN_REJECTION';
  exception when others then
    assert sqlerrm = 'FORBIDDEN', 'Customer can read admin statistics';
  end;
end;
$test$;
rollback;
