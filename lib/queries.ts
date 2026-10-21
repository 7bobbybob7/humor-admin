import { createClient } from "@/lib/supabase/server";

export type Generation = {
  id: number;
  user_id: string | null;
  author_first_name: string | null;
  prompt: string;
  system_prompt: string;
  model: string;
  caption: string;
  up_votes: number;
  down_votes: number;
  score: number;
  created_at: string;
};

export type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  is_superadmin: boolean;
  updated_at: string;
};

export type VoteRow = {
  id: number;
  generation_id: number;
  user_id: string;
  value: number;
  created_at: string;
  updated_at: string;
};

const GEN_COLUMNS =
  "id, user_id, author_first_name, prompt, system_prompt, model, caption, up_votes, down_votes, score, created_at";

/* ------------------------------------------------------------------ reads */

export async function listProfiles(): Promise<ProfileRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_url, is_superadmin, updated_at")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`profiles: ${error.message}`);
  return (data ?? []) as ProfileRow[];
}

export async function listGenerations(search?: string): Promise<Generation[]> {
  const supabase = await createClient();
  let q = supabase.from("generations").select(GEN_COLUMNS);

  if (search?.trim()) {
    // Escape PostgREST's or() delimiters so a comma or paren cannot alter the filter.
    const safe = search.trim().replace(/[,()]/g, " ");
    q = q.or(`caption.ilike.%${safe}%,prompt.ilike.%${safe}%`);
  }

  const { data, error } = await q
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`generations: ${error.message}`);
  return (data ?? []) as Generation[];
}

export async function getGeneration(id: number): Promise<Generation | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("generations")
    .select(GEN_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  return (data as Generation | null) ?? null;
}

export async function listVotes(): Promise<VoteRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("votes")
    .select("id, generation_id, user_id, value, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`votes: ${error.message}`);
  return (data ?? []) as VoteRow[];
}

/* ------------------------------------------------------------------ stats */

export type Stats = {
  users: number;
  captions: number;
  votes: number;
  upVotes: number;
  downVotes: number;
  avgScore: number;
  unrated: number;
  byDay: { day: string; count: number }[];
  byModel: { model: string; count: number }[];
  topCaptions: Generation[];
  controversial: Generation[];
  quietUsers: number;
};

function utcDayKey(iso: string): string {
  return iso.slice(0, 10);
}

export async function getStats(): Promise<Stats> {
  const supabase = await createClient();

  const [gensRes, profilesRes] = await Promise.all([
    supabase.from("generations").select(GEN_COLUMNS).limit(1000),
    supabase.from("profiles").select("id").limit(1000),
  ]);

  const gens = (gensRes.data ?? []) as Generation[];
  const users = (profilesRes.data ?? []).length;

  const upVotes = gens.reduce((n, g) => n + (g.up_votes ?? 0), 0);
  const downVotes = gens.reduce((n, g) => n + (g.down_votes ?? 0), 0);

  // Last 7 UTC days including today, so the chart always has 7 columns even
  // on quiet days rather than collapsing to however many had activity.
  const today = new Date();
  const days: { day: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i),
    );
    days.push({ day: d.toISOString().slice(0, 10), count: 0 });
  }
  const dayIndex = new Map(days.map((d, i) => [d.day, i]));
  for (const g of gens) {
    const i = dayIndex.get(utcDayKey(g.created_at));
    if (i !== undefined) days[i].count += 1;
  }

  const modelTally = new Map<string, number>();
  for (const g of gens) {
    modelTally.set(g.model, (modelTally.get(g.model) ?? 0) + 1);
  }

  const authorIds = new Set(gens.map((g) => g.user_id).filter(Boolean));

  return {
    users,
    captions: gens.length,
    votes: upVotes + downVotes,
    upVotes,
    downVotes,
    avgScore: gens.length
      ? gens.reduce((n, g) => n + (g.score ?? 0), 0) / gens.length
      : 0,
    unrated: gens.filter((g) => (g.up_votes ?? 0) + (g.down_votes ?? 0) === 0).length,
    byDay: days,
    byModel: [...modelTally.entries()]
      .map(([model, count]) => ({ model, count }))
      .sort((a, b) => b.count - a.count),
    topCaptions: [...gens].sort((a, b) => b.score - a.score).slice(0, 5),
    // Captions people disagree about: both directions present, ranked by the
    // smaller side, so a 5/4 split outranks a 50/1 landslide.
    controversial: [...gens]
      .filter((g) => g.up_votes > 0 && g.down_votes > 0)
      .sort(
        (a, b) =>
          Math.min(b.up_votes, b.down_votes) - Math.min(a.up_votes, a.down_votes),
      )
      .slice(0, 5),
    quietUsers: Math.max(0, users - authorIds.size),
  };
}
