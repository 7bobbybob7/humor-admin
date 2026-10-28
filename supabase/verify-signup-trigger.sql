-- Proves the signup trigger still works after the admin-grant change.
--
-- The trigger runs on every new account, so a mistake here does not degrade
-- gracefully - it stops anyone signing up. This creates two throwaway users
-- inside a transaction that is ROLLED BACK, so nothing survives the run.

begin;

create temp table results(n int, scenario text, expected text, actual text, verdict text)
  on commit drop;

do $$
declare
  listed_id   uuid := gen_random_uuid();
  unlisted_id uuid := gen_random_uuid();
  flag        boolean;
  made        boolean;
begin
  -- 1. An address on the admin list should arrive as an admin.
  begin
    insert into auth.users (id, email, aud, role, instance_id)
    values (listed_id, 'kt3073@columbia.edu', 'authenticated', 'authenticated',
            '00000000-0000-0000-0000-000000000000');
  exception when others then
    insert into results values
      (1, 'signup with a listed address', 'profile created',
       'ERROR: ' || sqlerrm, 'FAIL - signups are broken');
    return;
  end;

  select true, p.is_superadmin into made, flag
    from public.profiles p where p.id = listed_id;

  insert into results values
    (1, 'signup creates a profile', 'yes', coalesce(made, false)::text,
     case when made then 'PASS' else 'FAIL - signups are broken' end);
  insert into results values
    (2, 'listed address becomes admin', 'true', coalesce(flag, false)::text,
     case when flag then 'PASS' else 'FAIL' end);

  -- 2. Everyone else must still arrive as an ordinary user.
  insert into auth.users (id, email, aud, role, instance_id)
  values (unlisted_id, 'someone-random@example.com', 'authenticated',
          'authenticated', '00000000-0000-0000-0000-000000000000');

  made := null; flag := null;
  select true, p.is_superadmin into made, flag
    from public.profiles p where p.id = unlisted_id;

  insert into results values
    (3, 'ordinary signup still works', 'yes', coalesce(made, false)::text,
     case when made then 'PASS' else 'FAIL - signups are broken' end);
  insert into results values
    (4, 'unlisted address is NOT admin', 'false', coalesce(flag, false)::text,
     case when coalesce(flag, false) = false then 'PASS' else 'FAIL - everyone is an admin' end);
end $$;

select n, scenario, expected, actual, verdict from results order by n;

rollback;
