import { requireSuperadmin } from "@/lib/admin";
import { listProfiles } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ProfilesPage() {
  await requireSuperadmin();
  const profiles = await listProfiles();

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
      <h1 className="font-display text-3xl font-black">Profiles</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {profiles.length} account{profiles.length === 1 ? "" : "s"}. Read-only —
        admin access is granted in Supabase, never from here.
      </p>

      <div className="panel mt-6 overflow-x-auto">
        <table className="w-full min-w-[46rem] text-sm">
          <thead className="border-b-2 border-ink text-left">
            <tr className="text-[11px] uppercase tracking-wide text-ink-soft">
              <th className="px-4 py-3 font-black">User</th>
              <th className="px-4 py-3 font-black">Name</th>
              <th className="px-4 py-3 font-black">Role</th>
              <th className="px-4 py-3 font-black">User ID</th>
              <th className="px-4 py-3 font-black">Updated</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => {
              const name = [p.first_name, p.last_name].filter(Boolean).join(" ");
              return (
                <tr key={p.id} className="border-b border-rule last:border-0">
                  <td className="px-4 py-3">
                    <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border-2 border-ink bg-comic-blue text-xs font-bold text-white">
                      {p.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- user-supplied Storage URL
                        <img
                          src={p.avatar_url}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        (p.first_name?.[0] ?? "?").toUpperCase()
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {name || <span className="text-ink-soft">— not set —</span>}
                  </td>
                  <td className="px-4 py-3">
                    {p.is_superadmin ? (
                      <span className="rounded-full border-2 border-ink bg-comic-red px-2 py-0.5 text-[10px] font-black uppercase text-white">
                        Admin
                      </span>
                    ) : (
                      <span className="text-ink-soft">member</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-soft">
                    {p.id.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-soft">
                    {new Date(p.updated_at).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
