-- Grant admin access to a list of e-mail addresses.
--
-- profiles has no email column - addresses live in auth.users - and a profile
-- row only exists once someone has signed in. A plain UPDATE would therefore
-- affect zero rows for anyone who has not logged in yet, and say nothing about
-- it. So the list is stored, applied to everyone who already exists, and the
-- signup trigger applies it to the rest when they first sign in.

-- ---------------------------------------------------------------------------
-- 1. The list.
-- ---------------------------------------------------------------------------
create table if not exists public.admin_emails (
  email      text primary key,
  note       text,
  created_at timestamptz not null default now()
);

alter table public.admin_emails enable row level security;

-- Admin-only, like the other access-control tables. Without a policy the
-- trigger still reads it, because the trigger is security definer.
drop policy if exists "admin read admin_emails"   on public.admin_emails;
drop policy if exists "admin write admin_emails"  on public.admin_emails;
drop policy if exists "admin update admin_emails" on public.admin_emails;
drop policy if exists "admin delete admin_emails" on public.admin_emails;

create policy "admin read admin_emails" on public.admin_emails
  for select to authenticated using (public.is_superadmin());
create policy "admin write admin_emails" on public.admin_emails
  for insert to authenticated with check (public.is_superadmin());
create policy "admin update admin_emails" on public.admin_emails
  for update to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());
create policy "admin delete admin_emails" on public.admin_emails
  for delete to authenticated using (public.is_superadmin());

insert into public.admin_emails (email, note) values
  ('cw3782@columbia.edu', 'Project owner.'),
  ('kt3073@columbia.edu', 'Granted week 7.'),
  ('ma4368@columbia.edu', 'Granted week 7.'),
  ('cy2842@columbia.edu', 'Granted week 7.'),
  ('at3730@barnard.edu',  'Granted week 7.')
on conflict (email) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Apply to everyone who has already signed in.
-- ---------------------------------------------------------------------------
update public.profiles p
   set is_superadmin = true
  from auth.users u
 where u.id = p.id
   and lower(u.email) in (select lower(email) from public.admin_emails)
   and p.is_superadmin = false;

-- ---------------------------------------------------------------------------
-- 3. Apply to anyone who signs in later.
--    Identical to the original trigger except for the is_superadmin value, so
--    ordinary signups behave exactly as before: an address that is not on the
--    list evaluates to false, which is the column default.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, avatar_url, is_superadmin)
  values (
    new.id,
    new.raw_user_meta_data ->> 'avatar_url',
    exists (
      select 1 from public.admin_emails a
       where lower(a.email) = lower(new.email)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Report. "granted" = has access now. "waiting for first sign-in" = on the
--    list, no account yet; they get it automatically when they log in.
-- ---------------------------------------------------------------------------
select
  a.email,
  case
    when p.is_superadmin then 'granted'
    when u.id is null    then 'waiting for first sign-in'
    else                      'FAILED - account exists but flag not set'
  end as status
from public.admin_emails a
left join auth.users u     on lower(u.email) = lower(a.email)
left join public.profiles p on p.id = u.id
order by a.email;
