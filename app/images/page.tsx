import { requireSuperadmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { ImageCard, type ImageRow } from "./image-card";
import { Upload } from "./upload";

export const dynamic = "force-dynamic";

export default async function ImagesPage({
  searchParams,
}: PageProps<"/images">) {
  await requireSuperadmin();
  const { deleted, failed } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("images")
    .select("id, path, public_url, alt_text, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const images = (data ?? []) as ImageRow[];

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
      <h1 className="font-display text-3xl font-black">Images</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {images.length} image{images.length === 1 ? "" : "s"}. Bytes live in
        Supabase Storage; this table holds only the pointer, so deleting a row
        removes the stored object too.
      </p>

      {deleted && (
        <p className="panel-sm mt-4 bg-red-tint px-4 py-3 text-sm font-semibold">
          Deleted.
        </p>
      )}
      {failed && (
        <p className="panel-sm mt-4 bg-red-tint px-4 py-3 text-sm font-semibold">
          {failed === "nothing-deleted"
            ? "Nothing was deleted — the row may already be gone."
            : failed === "gone"
              ? "That image no longer exists."
              : `Could not delete: ${failed}`}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[22rem_1fr]">
        <section className="panel h-fit p-5">
          <h2 className="font-display text-lg font-black">Upload</h2>
          <div className="mt-4">
            <Upload />
          </div>
        </section>

        <section>
          {images.length === 0 ? (
            <div className="panel p-8 text-center text-sm text-ink-soft">
              No images yet. Upload one on the left.
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {images.map((img) => (
                <ImageCard key={img.id} image={img} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
