begin;

-- The contraction timer is used one-handed during labour, so the guarantees
-- that matter are about bad taps and bad connections, not about happy paths.

do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'pregnancy_contractions'
  ) then
    raise exception 'pregnancy_contractions table is missing';
  end if;

  -- A retried tap must not create a second contraction and skew the interval.
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    where t.relname = 'pregnancy_contractions'
      and c.contype = 'u'
      and pg_get_constraintdef(c) like '%client_operation_id%'
  ) then
    raise exception 'pregnancy_contractions needs a unique client_operation_id per profile';
  end if;

  -- A contraction that ends before it starts would poison every average.
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    where t.relname = 'pregnancy_contractions'
      and c.contype = 'c'
      and pg_get_constraintdef(c) like '%ended_at%'
  ) then
    raise exception 'pregnancy_contractions must reject an end before its start';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'pregnancy_contractions'
      and qual like '%can_access_profile%'
  ) then
    raise exception 'pregnancy_contractions must be scoped by can_access_profile';
  end if;
end;
$$;

do $$
declare
  v_expected text[] := array[
    'start_pregnancy_contraction',
    'stop_pregnancy_contraction',
    'list_pregnancy_contractions',
    'delete_pregnancy_contraction'
  ];
  v_name text;
begin
  foreach v_name in array v_expected loop
    if not exists (
      select 1 from information_schema.routines
      where routine_schema = 'public' and routine_name = v_name
    ) then
      raise exception 'Missing function %', v_name;
    end if;

    -- Anonymous callers must never reach a maternal-health record.
    if has_function_privilege('anon', format('public.%I', v_name) || '(' ||
      (select pg_get_function_identity_arguments(p.oid)
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = v_name
       limit 1) || ')', 'execute') then
      raise exception 'anon must not execute %', v_name;
    end if;
  end loop;
end;
$$;

rollback;
