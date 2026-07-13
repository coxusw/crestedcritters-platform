"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { type CommunityCategory, type CommunityImage, type MarketplaceDetails } from "@/lib/community";
import CommunityFormShell from "@/app/community/CommunityFormShell";
import LinkifiedText from "@/app/community/LinkifiedText";

type SpeciesOption = {
  id: number;
  common_name: string;
  scientific_name: string | null;
};

type InitialDiscussion = {
  id: string;
  title: string;
  body: string;
  category_id: string;
};

export default function CommunityDiscussionForm({
  action,
  categories,
  species,
  initialDiscussion = null,
  selectedCategorySlug = "",
  selectedSpeciesId = "",
  selectedSpeciesIds = selectedSpeciesId ? [selectedSpeciesId] : [],
  formError = "",
  initialMarketplace = null,
  initialImages = [],
}: {
  action: (formData: FormData) => Promise<void>;
  categories: CommunityCategory[];
  species: SpeciesOption[];
  initialDiscussion?: InitialDiscussion | null;
  selectedCategorySlug?: string;
  selectedSpeciesId?: string;
  selectedSpeciesIds?: string[];
  formError?: string;
  initialMarketplace?: MarketplaceDetails | null;
  initialImages?: CommunityImage[];
}) {
  const initialCategory =
    categories.find((category) => category.slug === selectedCategorySlug) ||
    categories.find((category) => category.id === initialDiscussion?.category_id) ||
    categories[0];
  const [activeCategorySlug, setActiveCategorySlug] = useState(initialCategory?.slug || "");
  const [title, setTitle] = useState(initialDiscussion?.title || "");
  const [body, setBody] = useState(initialDiscussion?.body || "");
  const [showPreview, setShowPreview] = useState(false);
  const selectedCategory = useMemo(
    () => categories.find((category) => category.slug === activeCategorySlug) || initialCategory,
    [activeCategorySlug, categories, initialCategory]
  );
  const isMarketplace = selectedCategory?.slug === "marketplace-connections";
  const imagesEnabled = selectedCategory?.images_enabled ?? true;

  return (
    <CommunityFormShell action={action} className="grid gap-5">
      {initialDiscussion && (
        <input type="hidden" name="discussion_id" value={initialDiscussion.id} />
      )}

      {formError && (
        <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-4 text-sm font-bold text-amber-50">
          {formError}
        </div>
      )}

      <label className="grid gap-2">
        <span className="text-sm font-black text-emerald-50/80">Category</span>
        <select
          name="category_slug"
          value={activeCategorySlug}
          onChange={(event) => setActiveCategorySlug(event.target.value)}
          className="rounded-lg border border-white/10 bg-[#07130c] px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
          disabled={Boolean(initialDiscussion)}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
        {initialDiscussion && selectedCategory && (
          <input type="hidden" name="category_slug" value={selectedCategory.slug} />
        )}
      </label>

      {selectedCategory?.posting_guidelines && (
        <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50/80">
          {selectedCategory.posting_guidelines}
        </div>
      )}

      <label className="grid gap-2">
        <span className="text-sm font-black text-emerald-50/80">Title</span>
        <input
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          minLength={4}
          maxLength={140}
          className="rounded-lg border border-white/10 bg-[#07130c] px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
          placeholder="What would you like to discuss?"
        />
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-black text-emerald-50/80">Body</span>
        <textarea
          name="body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          required
          minLength={10}
          rows={12}
          className="rounded-lg border border-white/10 bg-[#07130c] px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
          placeholder="Share details, context, photos you plan to add, sources, or what you have tried so far."
        />
      </label>

      <section className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-black uppercase tracking-wide text-emerald-50/70">
            Post Preview
          </h2>
          <button
            type="button"
            onClick={() => setShowPreview((value) => !value)}
            className="rounded-lg border border-emerald-400/25 px-4 py-2 text-sm font-black text-emerald-100 hover:bg-emerald-400/10"
          >
            {showPreview ? "Hide Preview" : "Show Preview"}
          </button>
        </div>

        {showPreview && (
          <article className="mt-4 rounded-lg border border-white/10 bg-[#07130c] p-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
              {selectedCategory?.name || "Community"}
            </p>
            <h3 className="mt-2 text-2xl font-black text-white">
              {title.trim() || "Untitled discussion"}
            </h3>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-emerald-50/80">
              {body.trim() ? (
                <LinkifiedText text={body.trim()} />
              ) : (
                "Your post body will appear here."
              )}
            </p>
          </article>
        )}
      </section>

      {selectedCategory?.species_tagging_enabled && (
        <label className="grid gap-2">
          <span className="text-sm font-black text-emerald-50/80">
            Related Species
          </span>
          <select
            name="species_ids"
            multiple
            defaultValue={selectedSpeciesIds}
            className="min-h-40 rounded-lg border border-white/10 bg-[#07130c] px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
          >
            {species.map((item) => (
              <option key={item.id} value={item.id}>
                {item.common_name}
                {item.scientific_name ? ` - ${item.scientific_name}` : ""}
              </option>
            ))}
          </select>
          <span className="text-xs text-emerald-50/45">
            Hold Ctrl or Cmd to select multiple species.
          </span>
        </label>
      )}

      <label className="grid gap-2">
        <span className="text-sm font-black text-emerald-50/80">Tags</span>
        <input
          name="tags"
          className="rounded-lg border border-white/10 bg-[#07130c] px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
          placeholder="substrate, breeding, duckies"
        />
      </label>

      {imagesEnabled && (
        <div className="grid gap-4">
          {initialImages.length > 0 && (
            <fieldset className="grid gap-3 rounded-lg border border-white/10 bg-[#07130c]/70 p-4">
              <legend className="px-2 text-sm font-black text-emerald-50/80">
                Current Images
              </legend>
              <div className="grid gap-3 sm:grid-cols-3">
                {initialImages.map((image) => (
                  <label
                    key={image.id}
                    className="grid gap-2 rounded-lg border border-white/10 bg-black/20 p-2 text-xs font-bold text-emerald-50/75"
                  >
                    <span className="aspect-square overflow-hidden rounded-md bg-black/30">
                      <Image
                        src={image.image_url}
                        alt={image.alt_text || image.caption || "Community image"}
                        width={240}
                        height={240}
                        className="h-full w-full object-cover"
                      />
                    </span>
                    <span className="flex items-center gap-2">
                      <input name="remove_image_ids" type="checkbox" value={image.id} />
                      Remove image
                    </span>
                    <span className="grid gap-1">
                      <span>Caption</span>
                      <input
                        name={`image_caption_${image.id}`}
                        defaultValue={image.caption || ""}
                        maxLength={180}
                        className="rounded-md border border-white/10 bg-[#07130c] px-3 py-2 text-xs text-white outline-none ring-emerald-400/30 placeholder:text-emerald-50/30 focus:ring-4"
                        placeholder="Optional caption"
                      />
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <label className="grid gap-2">
            <span className="text-sm font-black text-emerald-50/80">Images</span>
            <input
              name="image_files"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="rounded-lg border border-white/10 bg-[#07130c] px-4 py-3 text-sm text-emerald-50/80 outline-none file:mr-4 file:rounded-md file:border-0 file:bg-emerald-400 file:px-4 file:py-2 file:font-black file:text-slate-950 hover:file:bg-emerald-300"
            />
            <span className="text-xs text-emerald-50/45">
              Add up to 5 JPG, PNG, WEBP, or GIF images. Each image must be under 10MB.
            </span>
          </label>
        </div>
      )}

      {isMarketplace && (
        <fieldset className="grid gap-4 rounded-lg border border-yellow-300/20 bg-yellow-300/10 p-4">
          <legend className="px-2 text-sm font-black text-yellow-100">
            Marketplace Connection
          </legend>
          <p className="text-sm leading-6 text-yellow-50/80">
            Isopedia only provides a space for community members to connect. Isopedia
            does not process payments, verify transactions, guarantee products, or
            participate in sales. Users are responsible for laws, permits, shipping
            restrictions, weather decisions, payment arrangements, and transaction terms.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              name="listing_type"
              label="Listing Type"
              as="select"
              defaultValue={initialMarketplace?.listing_type || "available"}
            />
            <Field
              name="species_or_product"
              label="Species or Product"
              defaultValue={initialMarketplace?.species_or_product || ""}
            />
            <Field
              name="quantity"
              label="Quantity"
              defaultValue={initialMarketplace?.quantity || ""}
            />
            <Field
              name="price"
              label="Price or Range"
              defaultValue={initialMarketplace?.price || ""}
            />
            <Field
              name="location"
              label="Location"
              defaultValue={initialMarketplace?.location || ""}
            />
            <Field
              name="state"
              label="State"
              defaultValue={initialMarketplace?.state || ""}
            />
            <Field
              name="expo_name"
              label="Expo Name"
              defaultValue={initialMarketplace?.expo_name || ""}
            />
            <Field
              name="preferred_contact_method"
              label="Preferred Contact"
              defaultValue={initialMarketplace?.preferred_contact_method || ""}
            />
          </div>

          <label className="flex items-center gap-3 text-sm font-bold text-yellow-50/85">
            <input
              name="shipping_available"
              type="checkbox"
              defaultChecked={initialMarketplace?.shipping_available || false}
              className="h-4 w-4"
            />
            Shipping available
          </label>
          <label className="flex items-center gap-3 text-sm font-bold text-yellow-50/85">
            <input
              name="local_pickup_available"
              type="checkbox"
              defaultChecked={initialMarketplace?.local_pickup_available || false}
              className="h-4 w-4"
            />
            Local pickup available
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-black text-yellow-50/85">
              Permit or Shipping Notes
            </span>
            <textarea
              name="permit_notes"
              defaultValue={initialMarketplace?.permit_notes || ""}
              rows={3}
              className="rounded-lg border border-yellow-100/10 bg-[#07130c] px-4 py-3 text-white outline-none ring-yellow-300/30 focus:ring-4"
            />
          </label>
        </fieldset>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          data-submitting-label={initialDiscussion ? "Saving..." : "Submitting..."}
          className="rounded-lg bg-emerald-400 px-5 py-3 font-black text-slate-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {initialDiscussion ? "Save Changes" : "Publish"}
        </button>
        <Link
          href="/community"
          className="rounded-lg border border-white/10 px-5 py-3 font-black text-white hover:bg-white/10"
        >
          Cancel
        </Link>
      </div>
    </CommunityFormShell>
  );
}

function Field({
  name,
  label,
  as = "input",
  defaultValue = "",
}: {
  name: string;
  label: string;
  as?: "input" | "select";
  defaultValue?: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-black text-yellow-50/85">{label}</span>
      {as === "select" ? (
        <select
          name={name}
          defaultValue={defaultValue}
          className="rounded-lg border border-yellow-100/10 bg-[#07130c] px-4 py-3 text-white outline-none ring-yellow-300/30 focus:ring-4"
        >
          <option value="available">Available</option>
          <option value="wanted">Wanted</option>
          <option value="trade">Trade</option>
          <option value="local_pickup">Local pickup</option>
          <option value="expo_availability">Expo availability</option>
          <option value="supplies">Supplies</option>
          <option value="plants">Plants or bioactive materials</option>
          <option value="enclosures">Enclosures</option>
          <option value="cultures">Cultures</option>
          <option value="cleanup_crew">Cleanup crew</option>
          <option value="other">Other</option>
        </select>
      ) : (
        <input
          name={name}
          defaultValue={defaultValue}
          className="rounded-lg border border-yellow-100/10 bg-[#07130c] px-4 py-3 text-white outline-none ring-yellow-300/30 focus:ring-4"
        />
      )}
    </label>
  );
}
