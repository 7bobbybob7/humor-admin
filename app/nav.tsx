import Link from "next/link";
import { getAdminProfile } from "@/lib/admin";

const GROUPS: { label: string; links: { href: string; label: string }[] }[] = [
  {
    label: "Content",
    links: [
      { href: "/media", label: "AI media" },
      { href: "/images", label: "Images" },
      { href: "/votes", label: "Votes" },
    ],
  },
  {
    label: "Observability",
    links: [
      { href: "/requests", label: "Requests" },
      { href: "/responses", label: "LLM responses" },
    ],
  },
  {
    label: "Prompting",
    links: [
      { href: "/resources/prompt-chains", label: "Chains" },
      { href: "/resources/prompt-chain-steps", label: "Steps" },
      { href: "/resources/prompt-chain-mix", label: "Mix" },
      { href: "/resources/terms", label: "Terms" },
      { href: "/resources/examples", label: "Examples" },
    ],
  },
  {
    label: "Models",
    links: [
      { href: "/resources/llm-providers", label: "Providers" },
      { href: "/resources/llm-models", label: "Models" },
    ],
  },
  {
    label: "Access",
    links: [
      { href: "/profiles", label: "Profiles" },
      { href: "/resources/signup-domains", label: "Signup domains" },
      { href: "/resources/whitelisted-emails", label: "Whitelist" },
    ],
  },
];

export async function Nav() {
  const profile = await getAdminProfile();

  // Renders nothing for signed-out or non-admin visitors, so /login and
  // /denied do not advertise what the admin contains.
  if (!profile?.is_superadmin) return null;

  const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ");

  return (
    <header className="border-b-2 border-ink bg-paper">
      <div className="mx-auto w-full max-w-6xl px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-display text-lg font-black tracking-tight">
              Humor Project
            </Link>
            <span className="rounded-full border-2 border-ink bg-comic-red px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
              Admin
            </span>
            <Link
              href="/"
              className="rounded-full px-3 py-1.5 text-sm font-semibold transition hover:bg-ink/5"
            >
              Dashboard
            </Link>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-xs text-ink-soft sm:inline">
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
          </div>
        </div>

        <nav
          aria-label="Admin sections"
          className="mt-3 flex flex-wrap gap-x-5 gap-y-2 border-t border-rule pt-3"
        >
          {GROUPS.map((group) => (
            <div key={group.label} className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wide text-ink-soft">
                {group.label}
              </span>
              {group.links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-full bg-ink/[0.04] px-2.5 py-1 text-xs font-semibold transition hover:bg-ink/10"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </div>
    </header>
  );
}
