import Link from "next/link";
import { requireSuperadmin } from "@/lib/admin";
import { CreateForm } from "./create-form";

export const dynamic = "force-dynamic";

// The model call runs in this page's Server Action; Vercel's default function
// timeout is 10s and the fallback chain can spend a few seconds on a 503.
export const maxDuration = 30;

export default async function NewMediaPage() {
  await requireSuperadmin();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
      <Link
        href="/media"
        className="text-sm font-semibold text-ink-soft underline underline-offset-2 hover:text-ink"
      >
        ← Back to media
      </Link>
      <h1 className="mt-3 font-display text-3xl font-black">Generate captions</h1>
      <div className="panel mt-6 p-6">
        <CreateForm />
      </div>
    </main>
  );
}
