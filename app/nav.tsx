import Link from "next/link";
import { getAdminProfile } from "@/lib/admin";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/media", label: "Media" },
  { href: "/profiles", label: "Profiles" },
  { href: "/votes", label: "Votes" },
];

export async function Nav() {
  const profile = await getAdminProfile();

  // Hidden entirely for signed-out or non-admin visitors, so /login and
  // /denied do not advertise the admin sections.
  if (!profile?.is_superadmin) return null;

  const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ");

  return (
    <header className="border-b-2 border-ink bg-paper">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-display text-lg font-black tracking-tight">
            Humor Project
          </Link>
          <span className="rounded-full border-2 border-ink bg-comic-red px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
            Admin
          </span>
        </div>

        <nav className="flex flex-wrap items-center gap-1 text-sm">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full px-3 py-1.5 font-semibold transition hover:bg-ink/5"
            >
              {l.label}
            </Link>
          ))}
          <span className="mx-2 hidden text-xs text-ink-soft sm:inline">
            {name || "admin"}
          </span>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-full px-3 py-1.5 text-ink-soft transition hover:bg-ink/5 hover:text-ink"
            >
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
