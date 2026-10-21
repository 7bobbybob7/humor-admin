-- Week 6: admin access. Paste into the Supabase SQL Editor and Run.
-- Safe to re-run. This grants superadmins read access across the database
-- and full control over generations, without weakening anything for
-- ordinary users.

-- ---------------------------------------------------------------------------
-- 1. The flag itself. Defaults to false, so nobody is an admin until you say so.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_superadmin boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. The check, as a SECURITY DEFINER function.
--    This is not optional styling: a policy ON profiles that reads FROM
--    profiles re-triggers the same policy and Postgres raises
--    "infinite recursion detected in policy". A security definer function
--    runs as its owner and skips RLS, breaking the cycle.
-- ---------------------------------------------------------------------------
create or replace function public.is_superadmin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(
    (select p.is_superadmin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_superadmin() from public;
grant execute on function public.is_superadmin() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Read access for admins. Ordinary users keep exactly what they had.
-- ---------------------------------------------------------------------------
drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = id or public.is_superadmin());

drop policy if exists "Users read own votes" on public.votes;
create policy "Users read own votes"
  on public.votes for select to authenticated
  using (auth.uid() = user_id or public.is_superadmin());

-- ---------------------------------------------------------------------------
-- 4. Full control over generations for admins (the CRUD requirement).
--    Note this is the only UPDATE policy on generations - ordinary users still
--    cannot touch a row, so they cannot inflate their own score.
-- ---------------------------------------------------------------------------
drop policy if exists "Users create own generations" on public.generations;
create policy "Users create own generations"
  on public.generations for insert to authenticated
  with check (auth.uid() = user_id or public.is_superadmin());

drop policy if exists "Users delete own generations" on public.generations;
create policy "Users delete own generations"
  on public.generations for delete to authenticated
  using (auth.uid() = user_id or public.is_superadmin());

drop policy if exists "Admins update generations" on public.generations;
create policy "Admins update generations"
  on public.generations for update to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- ---------------------------------------------------------------------------
-- 5. Bootstrap. This is the answer to the assignment's question: the flag is
--    required to use the admin area, so it cannot be granted from inside it.
--    It is granted here instead - the SQL Editor connects as the database
--    owner, which bypasses RLS entirely.
--
--    Run this SELECT first to find your account:
-- ---------------------------------------------------------------------------
select u.email,
       u.id,
       p.first_name,
       p.is_superadmin,
       u.created_at
  from auth.users u
  left join public.profiles p on p.id = u.id
 order by u.created_at;

-- Then put YOUR email in the line below, uncomment it, and run it:
--
-- update public.profiles p
--    set is_superadmin = true
--   from auth.users u
--  where u.id = p.id
--    and u.email = 'your-google-email@gmail.com';
