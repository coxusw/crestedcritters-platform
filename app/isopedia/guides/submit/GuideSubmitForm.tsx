"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

type SelectedImage = {
  file: File;
  position: number;
  caption: string;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

function insertAtCursor(
  textarea: HTMLTextAreaElement | null,
  value: string,
  fallback: (updater: (current: string) => string) => void
) {
  if (!textarea) {
    fallback((current) => `${current}\n\n${value}\n\n`);
    return;
  }

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;

  fallback((current) => {
    const before = current.slice(0, start);
    const after = current.slice(end);
    return `${before}${value}${after}`;
  });

  requestAnimationFrame(() => {
    textarea.focus();
    const nextPosition = start + value.length;
    textarea.setSelectionRange(nextPosition, nextPosition);
  });
}

export default function GuideSubmitForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const supabase = useMemo(() => {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }, []);

  function handleImageSelection(files: FileList | null) {
    const selected = Array.from(files || []).slice(0, 10);

    setImages(
      selected.map((file, index) => ({
        file,
        position: index + 1,
        caption: "",
      }))
    );

    if ((files?.length || 0) > 10) {
      setNotice("Only the first 10 pictures will be used.");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (title.trim().length < 3) {
      setError("Please add a guide title.");
      return;
    }

    if (body.trim().length < 20) {
      setError("Please add more guide text before publishing.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("You must be logged in to add a guide.");
        setSaving(false);
        return;
      }

      const baseSlug = slugify(title) || "guide";
      const slug = `${baseSlug}-${Date.now().toString(36)}`;

      const { data: guide, error: guideError } = await supabase
        .from("isopedia_guides")
        .insert({
          slug,
          title: title.trim(),
          body: body.trim(),
          author_user_id: user.id,
          status: "published",
        })
        .select("id, slug")
        .single<{ id: string; slug: string }>();

      if (guideError || !guide) {
        throw new Error(guideError?.message || "Could not create guide.");
      }

      const imageRows = [];

      for (const image of images) {
        const extension = image.file.name.split(".").pop()?.toLowerCase() || "jpg";
        const storagePath = `guides/${user.id}/${guide.id}/${image.position}-${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from("isopedia-images")
          .upload(storagePath, image.file, {
            cacheControl: "3600",
            upsert: false,
            contentType: image.file.type,
          });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        const { data: publicUrlData } = supabase.storage
          .from("isopedia-images")
          .getPublicUrl(storagePath);

        imageRows.push({
          guide_id: guide.id,
          position: image.position,
          image_url: publicUrlData.publicUrl,
          storage_path: storagePath,
          caption: image.caption.trim() || null,
        });
      }

      if (imageRows.length > 0) {
        const { error: imageError } = await supabase
          .from("isopedia_guide_images")
          .insert(imageRows);

        if (imageError) {
          throw new Error(imageError.message);
        }
      }

      router.push(`/guides/${guide.slug}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish guide.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 p-5 sm:p-8">
      <label className="grid gap-2">
        <span className="text-xs font-black uppercase tracking-widest text-emerald-100/60">
          Guide Title
        </span>

        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={120}
          required
          placeholder="Example: How to set up a Cubaris bin"
          className="rounded-2xl border border-white/10 bg-[#07130c] px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-emerald-400/40"
        />
      </label>

      <label className="grid gap-2">
        <span className="text-xs font-black uppercase tracking-widest text-emerald-100/60">
          Guide Text
        </span>

        <textarea
          id="guide-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          required
          rows={18}
          placeholder={"Write your guide here. Add picture markers like [[image:1]] wherever images should appear."}
          className="rounded-2xl border border-white/10 bg-[#07130c] px-4 py-4 text-white outline-none placeholder:text-white/30 focus:border-emerald-400/40"
        />

        <span className="text-sm leading-6 text-emerald-50/55">
          Use the picture buttons below to insert markers where the images should
          appear. You can move those markers around in the text.
        </span>
      </label>

      <section className="rounded-3xl border border-white/10 bg-[#07130c]/70 p-4 sm:p-5">
        <div className="mb-4">
          <h2 className="text-xl font-black text-white">Pictures</h2>
          <p className="mt-2 text-sm leading-6 text-emerald-50/55">
            Add up to 10 pictures. Photos should be yours or shared with clear
            permission.
          </p>
        </div>

        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => handleImageSelection(event.target.files)}
          className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-400 file:px-4 file:py-2 file:font-bold file:text-slate-950"
        />

        <div className="mt-4 grid gap-3">
          {images.length === 0 ? (
            <p className="text-sm text-emerald-50/45">No pictures selected.</p>
          ) : (
            images.map((image, index) => (
              <div
                key={`${image.file.name}-${image.position}`}
                className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/70 p-4 md:grid-cols-[1fr_auto]"
              >
                <div>
                  <p className="font-bold text-white">
                    Picture {image.position}: {image.file.name}
                  </p>

                  <input
                    value={image.caption}
                    onChange={(event) => {
                      const caption = event.target.value;
                      setImages((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, caption } : item
                        )
                      );
                    }}
                    placeholder="Optional caption"
                    className="mt-3 rounded-xl border border-white/10 bg-[#07130c] px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-emerald-400/40"
                  />
                </div>

                <button
                  type="button"
                  onClick={() =>
                    insertAtCursor(
                      document.getElementById("guide-body") as HTMLTextAreaElement | null,
                      `\n\n[[image:${image.position}]]\n\n`,
                      setBody
                    )
                  }
                  className="h-fit rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
                >
                  Insert Picture {image.position}
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {notice && (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm font-bold text-amber-100">
          {notice}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm font-bold text-red-100">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="rounded-2xl bg-emerald-400 px-6 py-4 text-sm font-black text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "Publishing..." : "Publish Guide"}
      </button>
    </form>
  );
}
