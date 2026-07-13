"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

const COMMUNITY_IMAGE_BUCKET = "isopedia-images";
const MAX_COMMUNITY_IMAGE_FILES = 5;
const MAX_COMMUNITY_IMAGE_BYTES = 10 * 1024 * 1024;
const COMMUNITY_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

type UploadedCommunityImage = {
  image_url: string;
  storage_path: string;
  alt_text: string | null;
  position: number;
};

function safeImageExtension(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (extension === "jpeg") return "jpg";
  if (["jpg", "png", "webp", "gif"].includes(extension)) return extension;
  return "jpg";
}

function setSubmitButtons(form: HTMLFormElement, disabled: boolean) {
  const buttons = Array.from(form.querySelectorAll<HTMLButtonElement>("button[type='submit'], button:not([type])"));
  for (const button of buttons) {
    if (disabled) {
      button.dataset.originalText = button.textContent || "";
      button.textContent = button.dataset.submittingLabel || "Submitting...";
    } else if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
    }
    button.disabled = disabled;
  }
}

function upsertUploadsInput(form: HTMLFormElement, uploads: UploadedCommunityImage[]) {
  let input = form.querySelector<HTMLInputElement>("input[name='community_image_uploads']");
  if (!input) {
    input = document.createElement("input");
    input.type = "hidden";
    input.name = "community_image_uploads";
    form.appendChild(input);
  }
  input.value = JSON.stringify(uploads);
}

function nextRedirectDestination(error: unknown) {
  if (typeof error !== "object" || error === null || !("digest" in error)) return null;

  const digest = String((error as { digest?: unknown }).digest);
  if (!digest.startsWith("NEXT_REDIRECT")) return null;

  const [, , destination] = digest.split(";");
  return destination || null;
}

export default function CommunityFormShell({
  action,
  className,
  children,
  draftStorageKey,
}: {
  action: (formData: FormData) => Promise<void>;
  className: string;
  children: ReactNode;
  draftStorageKey?: string;
}) {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = createSupabaseBrowserClient();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const form = event.currentTarget;
    setError("");
    setIsSubmitting(true);
    setSubmitButtons(form, true);

    if (!form.reportValidity()) {
      setIsSubmitting(false);
      setSubmitButtons(form, false);
      return;
    }

    const fileInputs = Array.from(
      form.querySelectorAll<HTMLInputElement>("input[type='file'][name='image_files']")
    );
    const files = fileInputs.flatMap((input) => Array.from(input.files || []));

    if (files.length > MAX_COMMUNITY_IMAGE_FILES) {
      setIsSubmitting(false);
      setSubmitButtons(form, false);
      setError(`Please upload ${MAX_COMMUNITY_IMAGE_FILES} images or fewer.`);
      return;
    }

    for (const file of files) {
      if (!COMMUNITY_IMAGE_TYPES.has(file.type)) {
        setIsSubmitting(false);
        setSubmitButtons(form, false);
        setError("Images must be JPG, PNG, WEBP, or GIF.");
        return;
      }

      if (file.size > MAX_COMMUNITY_IMAGE_BYTES) {
        setIsSubmitting(false);
        setSubmitButtons(form, false);
        setError("Each image must be smaller than 10MB.");
        return;
      }
    }

    try {
      const uploads: UploadedCommunityImage[] = [];

      if (files.length) {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setIsSubmitting(false);
          setSubmitButtons(form, false);
          setError("Please sign in before uploading images.");
          return;
        }

        for (const [index, file] of files.entries()) {
          const storagePath = `community/${user.id}/pending/${crypto.randomUUID()}.${safeImageExtension(file)}`;
          const { error: uploadError } = await supabase.storage
            .from(COMMUNITY_IMAGE_BUCKET)
            .upload(storagePath, file, {
              cacheControl: "3600",
              upsert: false,
              contentType: file.type || "image/jpeg",
            });

          if (uploadError) throw new Error(uploadError.message);

          const { data } = supabase.storage.from(COMMUNITY_IMAGE_BUCKET).getPublicUrl(storagePath);
          uploads.push({
            image_url: data.publicUrl,
            storage_path: storagePath,
            alt_text: file.name || null,
            position: index + 1,
          });
        }
      }

      upsertUploadsInput(form, uploads);
      for (const input of fileInputs) input.value = "";

      await action(new FormData(form));
      setIsSubmitting(false);
      setSubmitButtons(form, false);
    } catch (submitError) {
      const redirectDestination = nextRedirectDestination(submitError);
      if (redirectDestination) {
        if (draftStorageKey) window.localStorage.removeItem(draftStorageKey);
        window.location.assign(redirectDestination);
        return;
      }
      setIsSubmitting(false);
      setSubmitButtons(form, false);
      setError(submitError instanceof Error ? submitError.message : "This could not be submitted.");
    }
  }

  return (
    <form
      action={action}
      aria-busy={isSubmitting}
      className={className}
      encType="multipart/form-data"
      onSubmit={handleSubmit}
    >
      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
          {error}
        </div>
      )}
      {children}
    </form>
  );
}
