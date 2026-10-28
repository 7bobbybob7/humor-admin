-- Week 7: observability schema. Paste into the Supabase SQL Editor and Run.
-- Safe to re-run.
--
-- These tables are not decorative: the caption generator reads its models,
-- prompt chain, examples and terms from here, and writes a generation_request
-- plus one llm_response per model attempt. The admin panel is therefore a
-- window onto real traffic rather than a CRUD demo over empty tables.

-- ===========================================================================
-- Providers and models. The generator walks active models by priority.
-- ===========================================================================
create table if not exists public.llm_providers (
  id         bigint generated always as identity primary key,
  name       text not null,
  slug       text not null unique,
  docs_url   text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.llm_models (
  id           bigint generated always as identity primary key,
  provider_id  bigint not null references public.llm_providers(id) on delete cascade,
  model_key    text not null unique,
  display_name text not null,
  priority     int  not null default 100,
  is_active    boolean not null default true,
  notes        text,
  created_at   timestamptz not null default now()
);

-- ===========================================================================
-- Prompt chains. A chain is an ordered list of steps whose templates are
-- concatenated to build the prompt. The mix decides which chain a request uses.
-- ===========================================================================
create table if not exists public.prompt_chains (
  id          bigint generated always as identity primary key,
  name        text not null,
  slug        text not null unique,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.prompt_chain_steps (
  id         bigint generated always as identity primary key,
  chain_id   bigint not null references public.prompt_chains(id) on delete cascade,
  step_order int  not null,
  label      text not null,
  template   text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (chain_id, step_order)
);

-- Read/update only per the brief: rows arrive with their chain, the admin
-- tunes the weights. Weight 0 retires a chain without deleting it.
create table if not exists public.prompt_chain_mix (
  id         bigint generated always as identity primary key,
  chain_id   bigint not null unique references public.prompt_chains(id) on delete cascade,
  weight     int not null default 1 check (weight >= 0),
  updated_at timestamptz not null default now()
);

-- ===========================================================================
-- Prompt ingredients: vocabulary steering and few-shot examples.
-- ===========================================================================
create table if not exists public.terms (
  id         bigint generated always as identity primary key,
  term       text not null,
  kind       text not null default 'avoid' check (kind in ('avoid', 'prefer')),
  note       text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_generation_examples (
  id              bigint generated always as identity primary key,
  chain_id        bigint references public.prompt_chains(id) on delete set null,
  topic           text not null,
  example_caption text not null,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

-- ===========================================================================
-- Observability: one request per user submission, one response per attempt.
-- ===========================================================================
create table if not exists public.generation_requests (
  id               bigint generated always as identity primary key,
  user_id          uuid references auth.users(id) on delete set null,
  topic            text not null,
  chain_id         bigint references public.prompt_chains(id) on delete set null,
  status           text not null default 'pending'
                     check (status in ('pending', 'succeeded', 'failed')),
  error            text,
  captions_created int not null default 0,
  duration_ms      int,
  created_at       timestamptz not null default now()
);

create table if not exists public.llm_responses (
  id           bigint generated always as identity primary key,
  request_id   bigint references public.generation_requests(id) on delete cascade,
  model_id     bigint references public.llm_models(id) on delete set null,
  model_key    text not null,
  ok           boolean not null,
  status_code  int,
  latency_ms   int,
  raw_response text,
  error        text,
  created_at   timestamptz not null default now()
);

create index if not exists llm_responses_request_idx on public.llm_responses (request_id);
create index if not exists generation_requests_created_idx on public.generation_requests (created_at desc);

-- Tie produced captions back to the request that produced them.
alter table public.generations
  add column if not exists request_id bigint
  references public.generation_requests(id) on delete set null;

-- ===========================================================================
-- Signup gating.
-- ===========================================================================
create table if not exists public.allowed_signup_domains (
  id         bigint generated always as identity primary key,
  domain     text not null unique,
  note       text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.whitelisted_emails (
  id         bigint generated always as identity primary key,
  email      text not null unique,
  note       text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ===========================================================================
-- Images. Bytes live in Storage; this table holds only the pointer.
-- ===========================================================================
create table if not exists public.images (
  id          bigint generated always as identity primary key,
  bucket      text not null default 'images',
  path        text not null,
  public_url  text not null,
  alt_text    text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (bucket, path)
);

insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do update set public = true;

drop policy if exists "Images are publicly readable" on storage.objects;
create policy "Images are publicly readable"
  on storage.objects for select to public
  using (bucket_id in ('avatars', 'images'));

drop policy if exists "Admins write images" on storage.objects;
create policy "Admins write images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'images' and public.is_superadmin());

drop policy if exists "Admins replace images" on storage.objects;
create policy "Admins replace images"
  on storage.objects for update to authenticated
  using (bucket_id = 'images' and public.is_superadmin());

drop policy if exists "Admins remove images" on storage.objects;
create policy "Admins remove images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'images' and public.is_superadmin());

-- ===========================================================================
-- RLS. Every new table is protected.
--
-- Config tables are readable by any signed-in user because the caption
-- generator in the main app reads them at request time, but writable only by
-- an admin. The two gating lists and the raw LLM responses are admin-only.
-- ===========================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'llm_providers','llm_models','prompt_chains','prompt_chain_steps',
    'prompt_chain_mix','terms','ai_generation_examples','generation_requests',
    'llm_responses','allowed_signup_domains','whitelisted_emails','images'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Readable by any signed-in user, writable by admins.
do $$
declare t text;
begin
  foreach t in array array[
    'llm_providers','llm_models','prompt_chains','prompt_chain_steps',
    'prompt_chain_mix','terms','ai_generation_examples','images'
  ] loop
    execute format('drop policy if exists "read %1$s" on public.%1$I', t);
    execute format(
      'create policy "read %1$s" on public.%1$I for select to authenticated using (true)', t);

    execute format('drop policy if exists "admin write %1$s" on public.%1$I', t);
    execute format(
      'create policy "admin write %1$s" on public.%1$I for insert to authenticated
         with check (public.is_superadmin())', t);

    execute format('drop policy if exists "admin update %1$s" on public.%1$I', t);
    execute format(
      'create policy "admin update %1$s" on public.%1$I for update to authenticated
         using (public.is_superadmin()) with check (public.is_superadmin())', t);

    execute format('drop policy if exists "admin delete %1$s" on public.%1$I', t);
    execute format(
      'create policy "admin delete %1$s" on public.%1$I for delete to authenticated
         using (public.is_superadmin())', t);
  end loop;
end $$;

-- Gating lists: admin-only, including reads.
do $$
declare t text;
begin
  foreach t in array array['allowed_signup_domains','whitelisted_emails'] loop
    execute format('drop policy if exists "admin read %1$s" on public.%1$I', t);
    execute format(
      'create policy "admin read %1$s" on public.%1$I for select to authenticated
         using (public.is_superadmin())', t);

    execute format('drop policy if exists "admin write %1$s" on public.%1$I', t);
    execute format(
      'create policy "admin write %1$s" on public.%1$I for insert to authenticated
         with check (public.is_superadmin())', t);

    execute format('drop policy if exists "admin update %1$s" on public.%1$I', t);
    execute format(
      'create policy "admin update %1$s" on public.%1$I for update to authenticated
         using (public.is_superadmin()) with check (public.is_superadmin())', t);

    execute format('drop policy if exists "admin delete %1$s" on public.%1$I', t);
    execute format(
      'create policy "admin delete %1$s" on public.%1$I for delete to authenticated
         using (public.is_superadmin())', t);
  end loop;
end $$;

-- Telemetry: a user writes their own request, an admin reads everything.
drop policy if exists "own or admin read requests" on public.generation_requests;
create policy "own or admin read requests"
  on public.generation_requests for select to authenticated
  using (auth.uid() = user_id or public.is_superadmin());

drop policy if exists "insert own requests" on public.generation_requests;
create policy "insert own requests"
  on public.generation_requests for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "update own requests" on public.generation_requests;
create policy "update own requests"
  on public.generation_requests for update to authenticated
  using (auth.uid() = user_id or public.is_superadmin())
  with check (auth.uid() = user_id or public.is_superadmin());

-- Raw model output can contain anything the model returned, so only admins read it.
drop policy if exists "admin read responses" on public.llm_responses;
create policy "admin read responses"
  on public.llm_responses for select to authenticated
  using (public.is_superadmin());

drop policy if exists "insert responses for own request" on public.llm_responses;
create policy "insert responses for own request"
  on public.llm_responses for insert to authenticated
  with check (
    exists (
      select 1 from public.generation_requests r
       where r.id = request_id and r.user_id = auth.uid()
    )
  );

-- Two of the seeded tables had no natural key, so their ON CONFLICT clauses
-- matched nothing and a second run would have duplicated their rows. These
-- indexes give those clauses something to conflict on, and they are the right
-- constraint anyway: the admin CRUD should not accept the same term twice.
create unique index if not exists terms_term_key
  on public.terms (term);
create unique index if not exists ai_generation_examples_chain_topic_key
  on public.ai_generation_examples (chain_id, topic);

-- ===========================================================================
-- Seed. Mirrors what the code used to hardcode, so behaviour is unchanged
-- on day one and every table has something to show.
-- ===========================================================================
insert into public.llm_providers (name, slug, docs_url) values
  ('Google AI Studio', 'google', 'https://ai.google.dev/gemini-api/docs')
on conflict (slug) do nothing;

insert into public.llm_models (provider_id, model_key, display_name, priority, notes)
select p.id, m.key, m.label, m.prio, m.note
  from public.llm_providers p,
       (values
         ('gemini-flash-latest',      'Gemini Flash (latest)',      10,
          'Best quality. Frequently 503 on the free tier, hence the fallbacks.'),
         ('gemini-3.5-flash-lite',    'Gemini 3.5 Flash Lite',      20,
          'Fast and reliable; answers in about a second.'),
         ('gemini-flash-lite-latest', 'Gemini Flash Lite (latest)', 30,
          'Final fallback.')
       ) as m(key, label, prio, note)
 where p.slug = 'google'
on conflict (model_key) do nothing;

insert into public.prompt_chains (name, slug, description) values
  ('House style', 'house-style',
   'Dry, observational NYC-student voice. The original hand-written prompt.'),
  ('Absurdist', 'absurdist',
   'Leans surreal and deadpan-literal rather than observational.')
on conflict (slug) do nothing;

insert into public.prompt_chain_steps (chain_id, step_order, label, template)
select c.id, s.ord, s.label, s.tmpl
  from public.prompt_chains c,
       (values
         (1, 'Persona',
          'You write short, punchy joke captions for a humor site run by and for college students in New York City. The audience is chronically online, so the voice is dry, observational and self-aware - never corny, never a dad joke, never explaining itself.'),
         (2, 'Task',
          'Write {{count}} distinct joke captions about this topic:
"{{topic}}"'),
         (3, 'Rules',
          'Rules:
- One sentence each, under 140 characters.
- Each caption must take a genuinely different angle on the topic.
- No emoji, no hashtags, no quotation marks around the caption.
- Keep it good-natured. Nothing cruel, sexual, or aimed at a real person.'),
         (4, 'Vocabulary', '{{terms}}'),
         (5, 'Examples', '{{examples}}'),
         (6, 'Format', 'Return a JSON array of strings and nothing else.')
       ) as s(ord, label, tmpl)
 where c.slug = 'house-style'
on conflict (chain_id, step_order) do nothing;

insert into public.prompt_chain_steps (chain_id, step_order, label, template)
select c.id, s.ord, s.label, s.tmpl
  from public.prompt_chains c,
       (values
         (1, 'Persona',
          'You write surreal, deadpan joke captions. You take figures of speech literally and answer questions with the wrong kind of correct answer.'),
         (2, 'Task',
          'Write {{count}} absurd joke captions about this topic:
"{{topic}}"'),
         (3, 'Rules',
          'Rules:
- One sentence each, under 140 characters.
- Stay completely straight-faced; never wink at the reader.
- No emoji, no hashtags, no quotation marks around the caption.
- Nothing cruel, sexual, or aimed at a real person.'),
         (4, 'Vocabulary', '{{terms}}'),
         (5, 'Examples', '{{examples}}'),
         (6, 'Format', 'Return a JSON array of strings and nothing else.')
       ) as s(ord, label, tmpl)
 where c.slug = 'absurdist'
on conflict (chain_id, step_order) do nothing;

-- House style carries the traffic until an admin changes the weights.
insert into public.prompt_chain_mix (chain_id, weight)
select id, case slug when 'house-style' then 4 else 1 end
  from public.prompt_chains
on conflict (chain_id) do nothing;

insert into public.terms (term, kind, note) values
  ('literally',  'avoid',  'Overused filler.'),
  ('unhinged',   'avoid',  'Played out online.'),
  ('rizz',       'avoid',  'Dates the writing badly.'),
  ('bodega',     'prefer', 'Reads as genuinely local.'),
  ('the 1 train','prefer', 'Specific beats generic.')
on conflict (term) do nothing;

insert into public.ai_generation_examples (chain_id, topic, example_caption)
select c.id, e.topic, e.caption
  from public.prompt_chains c,
       (values
         ('the printer in the library basement',
          'The basement printer only accepts jobs submitted with profound spiritual dread.'),
         ('dining hall food on a Sunday night',
          'Sunday dinner is less a meal than an archaeological dig through the week.')
       ) as e(topic, caption)
 where c.slug = 'house-style'
on conflict (chain_id, topic) do nothing;

insert into public.allowed_signup_domains (domain, note) values
  ('columbia.edu', 'Primary campus audience.'),
  ('gmail.com',    'Most testers sign in with a personal Google account.')
on conflict (domain) do nothing;

insert into public.whitelisted_emails (email, note) values
  ('cw3782@columbia.edu', 'Admin account.')
on conflict (email) do nothing;

-- Final check: every new table should report rowsecurity = true.
select tablename, rowsecurity
  from pg_tables
 where schemaname = 'public'
 order by tablename;
