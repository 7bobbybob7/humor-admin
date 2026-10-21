import Link from "next/link";
import { requireSuperadmin } from "@/lib/admin";
import { getStats, type Generation } from "@/lib/queries";

export const dynamic = "force-dynamic";

function StatTile({
  label,
  value,
  note,
  tint,
}: {
  label: string;
  value: string | number;
  note?: string;
  tint: string;
}) {
  return (
    <div className={`panel-sm ${tint} px-4 py-3`}>
      <p className="text-[11px] font-black uppercase tracking-wide text-ink-soft">
        {label}
      </p>
      <p className="font-display text-3xl font-black tabular-nums">{value}</p>
      {note && <p className="mt-0.5 text-xs text-ink-soft">{note}</p>}
    </div>
  );
}

/** Captions per day, last 7 UTC days. One series, so no legend - the title names it. */
function DayBars({ data }: { data: { day: string; count: number }[] }) {
  const peak = Math.max(1, ...data.map((d) => d.count));

  return (
    <section className="panel p-5">
      <h2 className="font-display text-lg font-black">Captions per day</h2>
      <p className="mt-0.5 text-xs text-ink-soft">Last 7 days, UTC</p>

      <div className="mt-5 flex h-36 items-end gap-2" role="img"
           aria-label={`Captions per day: ${data.map((d) => `${d.day}, ${d.count}`).join("; ")}`}>
        {data.map((d) => {
          const pct = (d.count / peak) * 100;
          return (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="text-[11px] font-bold tabular-nums text-ink-soft">
                {d.count > 0 ? d.count : ""}
              </span>
              <div className="flex h-full w-full items-end">
                <div
                  className="bar-mark w-full bg-series-up"
                  style={{ height: `${Math.max(pct, d.count > 0 ? 4 : 0)}%` }}
                  title={`${d.day}: ${d.count} caption${d.count === 1 ? "" : "s"}`}
                />
              </div>
              <span className="text-[10px] font-semibold text-ink-soft">
                {new Date(d.day + "T00:00:00Z").toLocaleDateString("en-US", {
                  weekday: "short",
                  timeZone: "UTC",
                })}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Vote polarity. Two series, so a legend is present and both are direct-labelled. */
function VoteSplit({ up, down }: { up: number; down: number }) {
  const total = up + down;
  const upPct = total ? (up / total) * 100 : 0;

  return (
    <section className="panel p-5">
      <h2 className="font-display text-lg font-black">Vote split</h2>
      <p className="mt-0.5 text-xs text-ink-soft">
        {total} vote{total === 1 ? "" : "s"} cast all time
      </p>

      {total === 0 ? (
        <p className="mt-5 text-sm text-ink-soft">No votes yet.</p>
      ) : (
        <>
          <div className="mt-5 flex h-8 w-full gap-[2px] overflow-hidden">
            <div
              className="bar-mark-h bg-series-up"
              style={{ width: `${upPct}%` }}
              title={`${up} upvotes`}
            />
            <div
              className="bar-mark-h bg-series-down"
              style={{ width: `${100 - upPct}%` }}
              title={`${down} downvotes`}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-series-up" aria-hidden />
              <span className="font-semibold">▲ Up</span>
              <span className="tabular-nums text-ink-soft">
                {up} ({Math.round(upPct)}%)
              </span>
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-series-down" aria-hidden />
              <span className="font-semibold">▼ Down</span>
              <span className="tabular-nums text-ink-soft">
                {down} ({100 - Math.round(upPct)}%)
              </span>
            </span>
          </div>
        </>
      )}
    </section>
  );
}

function ModelMix({ data }: { data: { model: string; count: number }[] }) {
  const peak = Math.max(1, ...data.map((d) => d.count));
  return (
    <section className="panel p-5">
      <h2 className="font-display text-lg font-black">Which model answered</h2>
      <p className="mt-0.5 text-xs text-ink-soft">
        The app falls back when a model is overloaded
      </p>
      {data.length === 0 ? (
        <p className="mt-5 text-sm text-ink-soft">No captions yet.</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {data.map((d) => (
            <li key={d.model}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-mono text-xs">{d.model}</span>
                <span className="shrink-0 font-bold tabular-nums">{d.count}</span>
              </div>
              <div className="mt-1 h-2 w-full bg-grid">
                <div
                  className="bar-mark-h h-full bg-series-up"
                  style={{ width: `${(d.count / peak) * 100}%` }}
                  title={`${d.model}: ${d.count}`}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CaptionList({
  title,
  note,
  rows,
  empty,
}: {
  title: string;
  note: string;
  rows: Generation[];
  empty: string;
}) {
  return (
    <section className="panel p-5">
      <h2 className="font-display text-lg font-black">{title}</h2>
      <p className="mt-0.5 text-xs text-ink-soft">{note}</p>
      {rows.length === 0 ? (
        <p className="mt-5 text-sm text-ink-soft">{empty}</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {rows.map((g) => (
            <li key={g.id} className="flex gap-3">
              <span className="w-10 shrink-0 text-right font-display text-base font-black tabular-nums">
                {g.score > 0 ? `+${g.score}` : g.score}
              </span>
              <span className="min-w-0">
                <Link
                  href={`/media/${g.id}`}
                  className="block break-words text-sm font-medium underline-offset-2 hover:underline"
                >
                  {g.caption}
                </Link>
                <span className="mt-0.5 block text-xs text-ink-soft">
                  ▲{g.up_votes} ▼{g.down_votes} · {g.author_first_name ?? "someone"}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default async function Dashboard() {
  await requireSuperadmin();
  const s = await getStats();

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
      <h1 className="font-display text-3xl font-black">Dashboard</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Live figures from the Humor Project database.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Profiles" value={s.users} tint="bg-blue-tint"
          note={s.quietUsers > 0 ? `${s.quietUsers} have posted nothing` : "all have posted"} />
        <StatTile label="Captions" value={s.captions} tint="bg-yellow-tint"
          note={`${s.unrated} still unrated`} />
        <StatTile label="Votes cast" value={s.votes} tint="bg-green-tint"
          note={`${s.upVotes} up · ${s.downVotes} down`} />
        <StatTile label="Average score" value={s.avgScore.toFixed(2)} tint="bg-red-tint"
          note="points per caption" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <DayBars data={s.byDay} />
        <VoteSplit up={s.upVotes} down={s.downVotes} />
        <ModelMix data={s.byModel} />
        <CaptionList
          title="Highest rated"
          note="Top five by score"
          rows={s.topCaptions}
          empty="Nothing rated yet."
        />
        <CaptionList
          title="Most divisive"
          note="Ranked by the smaller side, so a 5/4 split beats a 50/1 landslide"
          rows={s.controversial}
          empty="Nothing has votes in both directions yet."
        />
      </div>
    </main>
  );
}
