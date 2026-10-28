-- Week 7 verification. Read-only: everything runs inside a transaction that is
-- ROLLED BACK at the end, so no rows are created, changed or deleted.
--
-- Checks ROW COUNTS, not just exceptions. Under RLS a SELECT, UPDATE or DELETE
-- the policy forbids does not raise - it silently returns or affects zero rows.
-- A harness that only catches exceptions reports that as success.

begin;

create or replace function pg_temp.run(stmt text) returns text
language plpgsql as $$
declare n bigint;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n::text || ' rows';
exception when others then
  return 'ERROR';
end $$;

create temp table results(
  n int, scenario text, expected text, actual text, verdict text
) on commit drop;

grant all on results to public;
grant execute on function pg_temp.run(text) to public;

-- ---------------------------------------------------------------------------
-- A. Seed data landed.
-- ---------------------------------------------------------------------------
do $$
declare
  t    text;
  want int;
  got  int;
  i    int := 0;
begin
  for t, want in
    select * from (values
      ('llm_providers', 1), ('llm_models', 3), ('prompt_chains', 2),
      ('prompt_chain_steps', 12), ('prompt_chain_mix', 2), ('terms', 5),
      ('ai_generation_examples', 2), ('allowed_signup_domains', 2),
      ('whitelisted_emails', 1)
    ) as v(t, want)
  loop
    execute format('select count(*) from public.%I', t) into got;
    i := i + 1;
    insert into results values (
      i, 'seed: ' || t, want || ' rows', got || ' rows',
      case when got = want then 'PASS'
           when got > want then 'FAIL (duplicated)'
           else 'FAIL' end);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- B. An ordinary signed-in user: can read config, cannot read gating lists,
--    cannot write anything. This is exactly what the caption generator does.
-- ---------------------------------------------------------------------------
reset role;
do $$
declare
  plain uuid;
  r     text;
begin
  select id into plain from public.profiles
   where coalesce(is_superadmin, false) = false order by id limit 1;

  if plain is null then
    insert into results values (20, 'need a non-admin profile', '-', '-', 'SKIPPED');
    return;
  end if;

  execute 'set local role authenticated';
  execute format('set local request.jwt.claims = %L',
                 format('{"sub":"%s","role":"authenticated"}', plain));

  -- should be able to read every table the generator needs
  r := pg_temp.run('select 1 from public.llm_models');
  insert into results values (20, 'user reads llm_models', '3 rows', r,
    case when r = '3 rows' then 'PASS' else 'FAIL' end);

  r := pg_temp.run('select 1 from public.prompt_chains');
  insert into results values (21, 'user reads prompt_chains', '2 rows', r,
    case when r = '2 rows' then 'PASS' else 'FAIL' end);

  r := pg_temp.run('select 1 from public.prompt_chain_steps');
  insert into results values (22, 'user reads prompt_chain_steps', '12 rows', r,
    case when r = '12 rows' then 'PASS' else 'FAIL' end);

  r := pg_temp.run('select 1 from public.prompt_chain_mix');
  insert into results values (23, 'user reads prompt_chain_mix', '2 rows', r,
    case when r = '2 rows' then 'PASS' else 'FAIL' end);

  r := pg_temp.run('select 1 from public.terms');
  insert into results values (24, 'user reads terms', '5 rows', r,
    case when r = '5 rows' then 'PASS' else 'FAIL' end);

  r := pg_temp.run('select 1 from public.ai_generation_examples');
  insert into results values (25, 'user reads examples', '2 rows', r,
    case when r = '2 rows' then 'PASS' else 'FAIL' end);

  -- should NOT be able to read the gating lists or raw model output
  r := pg_temp.run('select 1 from public.allowed_signup_domains');
  insert into results values (26, 'user reads signup domains', '0 rows', r,
    case when r = '0 rows' then 'PASS' else 'FAIL (leaked)' end);

  r := pg_temp.run('select 1 from public.whitelisted_emails');
  insert into results values (27, 'user reads whitelisted emails', '0 rows', r,
    case when r = '0 rows' then 'PASS' else 'FAIL (leaked)' end);

  r := pg_temp.run('select 1 from public.llm_responses');
  insert into results values (28, 'user reads raw llm_responses', '0 rows', r,
    case when r = '0 rows' then 'PASS' else 'FAIL (leaked)' end);

  -- should NOT be able to write config
  r := pg_temp.run($q$insert into public.terms(term,kind) values ('harness','avoid')$q$);
  insert into results values (29, 'user inserts a term', 'ERROR', r,
    case when r = 'ERROR' then 'PASS' else 'FAIL (wrote)' end);

  r := pg_temp.run('update public.llm_models set priority = 99');
  insert into results values (30, 'user edits llm_models', '0 rows', r,
    case when r = '0 rows' then 'PASS' else 'FAIL (wrote)' end);

  r := pg_temp.run('delete from public.prompt_chains');
  insert into results values (31, 'user deletes a chain', '0 rows', r,
    case when r = '0 rows' then 'PASS' else 'FAIL (deleted)' end);

  -- should be able to log its own request, but not one attributed to someone else
  r := pg_temp.run(format(
    'insert into public.generation_requests(user_id,topic) values (%L,''harness'')', plain));
  insert into results values (32, 'user logs own request', '1 rows', r,
    case when r = '1 rows' then 'PASS' else 'FAIL' end);

  r := pg_temp.run(
    'insert into public.generation_requests(user_id,topic) '
    'values (''00000000-0000-0000-0000-000000000001''::uuid,''spoofed'')');
  insert into results values (33, 'user logs request as someone else', 'ERROR', r,
    case when r = 'ERROR' then 'PASS' else 'FAIL (spoofed)' end);
end $$;

-- ---------------------------------------------------------------------------
-- C. The admin: can read the gating lists and write config.
-- ---------------------------------------------------------------------------
reset role;
do $$
declare
  boss uuid;
  r    text;
begin
  select id into boss from public.profiles
   where coalesce(is_superadmin, false) = true order by id limit 1;

  if boss is null then
    insert into results values (40, 'need a superadmin profile', '-', '-', 'SKIPPED');
    return;
  end if;

  execute 'set local role authenticated';
  execute format('set local request.jwt.claims = %L',
                 format('{"sub":"%s","role":"authenticated"}', boss));

  r := pg_temp.run('select 1 from public.allowed_signup_domains');
  insert into results values (40, 'admin reads signup domains', '2 rows', r,
    case when r = '2 rows' then 'PASS' else 'FAIL' end);

  r := pg_temp.run('select 1 from public.whitelisted_emails');
  insert into results values (41, 'admin reads whitelisted emails', '1 rows', r,
    case when r = '1 rows' then 'PASS' else 'FAIL' end);

  r := pg_temp.run($q$insert into public.terms(term,kind) values ('harness','avoid')$q$);
  insert into results values (42, 'admin inserts a term', '1 rows', r,
    case when r = '1 rows' then 'PASS' else 'FAIL' end);

  r := pg_temp.run($q$delete from public.terms where term = 'harness'$q$);
  insert into results values (43, 'admin deletes that term', '1 rows', r,
    case when r = '1 rows' then 'PASS' else 'FAIL' end);

  r := pg_temp.run('update public.prompt_chain_mix set weight = weight');
  insert into results values (44, 'admin edits the chain mix', '2 rows', r,
    case when r = '2 rows' then 'PASS' else 'FAIL' end);

  r := pg_temp.run('select 1 from public.generation_requests');
  insert into results values (45, 'admin reads all requests', '1+ rows', r,
    case when r <> 'ERROR' then 'PASS' else 'FAIL' end);
end $$;

reset role;
select n, scenario, expected, actual, verdict from results order by n;

rollback;
