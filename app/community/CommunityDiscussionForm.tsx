import Link from "next/link";
import { type CommunityCategory } from "@/lib/community";

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
}: {
  action: (formData: FormData) => Promise<void>;
  categories: CommunityCategory[];
  species: SpeciesOption[];
  initialDiscussion?: InitialDiscussion | null;
  selectedCategorySlug?: string;
  selectedSpeciesId?: string;
}) {
  const selectedCategory =
    categories.find((category) => category.slug === selectedCategorySlug) ||
    categories.find((category) => category.id === initialDiscussion?.category_id) ||
    categories[0];
  const isMarketplace = selectedCategory?.slug === "marketplace-connections";
  const imagesEnabled = selectedCategory?.images_enabled ?? true;

  return (
    <form action={action} className="grid gap-5" encType="multipart/form-data">
      {initialDiscussion && (
        <input type="hidden" name="discussion_id" value={initialDiscussion.id} />
      )}

      <label className="grid gap-2">
        <span className="text-sm font-black text-emerald-50/80">Category</span>
        <select
          name="category_slug"
          defaultValue={selectedCategory?.slug || ""}
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
          defaultValue={initialDiscussion?.title || ""}
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
          defaultValue={initialDiscussion?.body || ""}
          required
          minLength={10}
          rows={12}
          className="rounded-lg border border-white/10 bg-[#07130c] px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
          placeholder="Share details, context, photos you plan to add, sources, or what you have tried so far."
        />
      </label>

      {selectedCategory?.species_tagging_enabled && (
        <label className="grid gap-2">
          <span className="text-sm font-black text-emerald-50/80">
            Related Species
          </span>
          <select
            name="species_ids"
            multiple
            defaultValue={selectedSpeciesId ? [selectedSpeciesId] : []}
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
            Add up to 4 JPG, PNG, WEBP, or GIF images. Each image must be under 5MB.
          </span>
        </label>
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
            <Field name="listing_type" label="Listing Type" as="select" />
            <Field name="species_or_product" label="Species or Product" />
            <Field name="quantity" label="Quantity" />
            <Field name="price" label="Price or Range" />
            <Field name="location" label="Location" />
            <Field name="state" label="State" />
            <Field name="expo_name" label="Expo Name" />
            <Field name="preferred_contact_method" label="Preferred Contact" />
          </div>

          <label className="flex items-center gap-3 text-sm font-bold text-yellow-50/85">
            <input name="shipping_available" type="checkbox" className="h-4 w-4" />
            Shipping available
          </label>
          <label className="flex items-center gap-3 text-sm font-bold text-yellow-50/85">
            <input name="local_pickup_available" type="checkbox" className="h-4 w-4" />
            Local pickup available
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-black text-yellow-50/85">
              Permit or Shipping Notes
            </span>
            <textarea
              name="permit_notes"
              rows={3}
              className="rounded-lg border border-yellow-100/10 bg-[#07130c] px-4 py-3 text-white outline-none ring-yellow-300/30 focus:ring-4"
            />
          </label>
        </fieldset>
      )}

      <div className="flex flex-wrap gap-3">
        <button className="rounded-lg bg-emerald-400 px-5 py-3 font-black text-slate-950 hover:bg-emerald-300">
          {initialDiscussion ? "Save Changes" : "Publish"}
        </button>
        <Link
          href="/community"
          className="rounded-lg border border-white/10 px-5 py-3 font-black text-white hover:bg-white/10"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  as = "input",
}: {
  name: string;
  label: string;
  as?: "input" | "select";
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-black text-yellow-50/85">{label}</span>
      {as === "select" ? (
        <select
          name={name}
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
          className="rounded-lg border border-yellow-100/10 bg-[#07130c] px-4 py-3 text-white outline-none ring-yellow-300/30 focus:ring-4"
        />
      )}
    </label>
  );
}
