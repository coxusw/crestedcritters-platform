import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import EditCollectionItemModal from "@/app/components/isopedia/EditCollectionItemModal";
import CollectionQrButton from "@/app/components/isopedia/CollectionQrButton";

type PageProps = {
  params: Promise<{
    username: string;
  }>;
};

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  business_name: string | null;
  bio: string | null;
};

type CollectionItem = {
  id: string;
  status: "owned" | "wishlist";
  quantity: string | null;
  price: string | null;
  price_is_na: boolean;
  notes: string | null;
  is_public: boolean;
  is_favorite: boolean;
  is_most_wanted: boolean;
  isopedia_species: {
    id: number;
    common_name: string;
    scientific_name: string | null;
    slug: string;
    organism_type: string | null;
    genus: string | null;
    species: string | null;
    morph: string | null;
    image_url: string | null;
    difficulty: string | null;
  } | null;
};

function collectionSummary(items: CollectionItem[]) {
  const priced = items.filter((item) => item.price || item.price_is_na).length;
  const withQty = items.filter((item) => item.quantity).length;

  return {
    priced,
    withQty,
  };
}

function sortFeatured(items: CollectionItem[]) {
  return [...items].sort((a, b) => {
    if (a.is_favorite !== b.is_favorite) return a.is_favorite ? -1 : 1;
    if (a.is_most_wanted !== b.is_most_wanted) {
      return a.is_most_wanted ? -1 : 1;
    }

    const aName = a.isopedia_species?.common_name || "";
    const bName = b.isopedia_species?.common_name || "";

    return aName.localeCompare(bName);
  });
}

export default async function PublicCollectionPage({ params }: PageProps) {
  const { username } = await params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const cleanUsername = username.toLowerCase().trim();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      `
      id,
      username,
      display_name,
      business_name,
      bio
    `
    )
    .eq("username", cleanUsername)
    .maybeSingle<Profile>();

  if (profileError || !profile) {
    notFound();
  }

  const isOwner = user?.id === profile.id;

  let collectionQuery = supabase
    .from("isopedia_user_species")
    .select(
      `
      id,
      status,
      quantity,
      price,
      price_is_na,
      notes,
      is_public,
      is_favorite,
      is_most_wanted,
      isopedia_species:species_id (
        id,
        common_name,
        scientific_name,
        slug,
        organism_type,
        genus,
        species,
        morph,
        image_url,
        difficulty
      )
    `
    )
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  if (!isOwner) {
    collectionQuery = collectionQuery.eq("is_public", true);
  }

  const { data: collectionItems, error: collectionError } =
    await collectionQuery.returns<CollectionItem[]>();

  if (collectionError) {
    throw new Error(collectionError.message);
  }

  const items = collectionItems || [];

  const owned = sortFeatured(items.filter((item) => item.status === "owned"));
  const wishlist = sortFeatured(
    items.filter((item) => item.status === "wishlist")
  );
  const favorites = sortFeatured(items.filter((item) => item.is_favorite));
  const mostWanted = sortFeatured(
    items.filter((item) => item.status === "wishlist" && item.is_most_wanted)
  );

  const ownedSummary = collectionSummary(owned);

  const publicName =
    profile.display_name || profile.username || "Isopedia Contributor";

  const usernameForLinks = profile.username || cleanUsername;

  return (
    <main className="min-h-screen bg-[#0c1710] px-4 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/"
            className="text-sm font-medium text-emerald-300 hover:text-emerald-200"
          >
            ← Back to Isopedia
          </Link>

          <div className="flex flex-wrap gap-2">
            <CollectionQrButton title={publicName} username={usernameForLinks} />

            <Link
              href={`/profile/${usernameForLinks}`}
              className="rounded-xl border border-white/10 bg-[#142318] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#18291d]"
            >
              View Profile
            </Link>

            {isOwner && (
              <Link
                href="/account"
                className="rounded-xl border border-white/10 bg-[#142318] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#18291d]"
              >
                Edit Profile
              </Link>
            )}

            <Link
              href="/"
              className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
            >
              Browse Species
            </Link>
          </div>
        </div>

        <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#142318] shadow-2xl shadow-black/30">
          <div className="bg-gradient-to-br from-emerald-500/20 via-[#142318] to-[#0c1710] p-6 sm:p-10">
            <div className="grid gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.35em] text-emerald-300">
                  Public Collection
                </p>

                <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">
                  {publicName}
                </h1>

                {profile.business_name && (
                  <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs font-black uppercase tracking-widest text-emerald-100/45">
                      Business Name
                    </p>

                    <p className="mt-2 text-lg font-bold text-emerald-50">
                      {profile.business_name}
                    </p>
                  </div>
                )}

                {isOwner && (
                  <div className="mt-5 inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-200">
                    You are viewing your collection
                  </div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <StatCard label="Owned" value={owned.length} />
                <StatCard label="Wishlist" value={wishlist.length} />
                <StatCard label="Favorites" value={favorites.length} />
                <StatCard label="Most Wanted" value={mostWanted.length} />
              </div>
            </div>
          </div>

          <div className="grid gap-6 p-6 sm:p-10 lg:grid-cols-[1fr_340px]">
            <div>
              <h2 className="text-2xl font-bold text-white">About</h2>

              {profile.bio ? (
                <p className="mt-4 whitespace-pre-wrap leading-7 text-emerald-50/75">
                  {profile.bio}
                </p>
              ) : (
                <p className="mt-4 text-emerald-50/50">
                  This keeper has not added a bio yet.
                </p>
              )}

              {owned.length > 0 && (
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <MiniInfo
                    label="Items with quantity"
                    value={ownedSummary.withQty}
                  />

                  <MiniInfo
                    label="Items with pricing"
                    value={ownedSummary.priced}
                  />
                </div>
              )}
            </div>

            <aside className="rounded-3xl border border-white/10 bg-[#0b140d]/70 p-5">
              <h2 className="text-lg font-bold text-white">Collection Tools</h2>

              <div className="mt-4 grid gap-3">
                <Link
                  href={`/profile/${usernameForLinks}`}
                  className="rounded-xl border border-white/10 bg-[#142318] px-4 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-[#18291d]"
                >
                  Contributor Profile
                </Link>

                <Link
                  href="/"
                  className="rounded-xl border border-white/10 bg-[#142318] px-4 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-[#18291d]"
                >
                  Browse Database
                </Link>
              </div>
            </aside>
          </div>
        </section>

        {favorites.length > 0 && (
          <CollectionSection
            title="Favorite Species"
            label="Favorites"
            description="Species this keeper has highlighted as favorites."
            emptyText="No favorites listed yet."
            items={favorites}
            isOwner={isOwner}
          />
        )}

        {mostWanted.length > 0 && (
          <CollectionSection
            title="Most Wanted"
            label="Wishlist Priority"
            description="High-priority species this keeper is hoping to add."
            emptyText="No most wanted species listed yet."
            items={mostWanted}
            isOwner={isOwner}
          />
        )}

        {owned.length > 0 ? (
          <CollectionSection
            title="Owned Species"
            label="Collection"
            description="Species this keeper has marked as owned."
            emptyText="No owned species listed yet."
            items={owned}
            isOwner={isOwner}
          />
        ) : isOwner ? (
          <EmptyOwnerSection
            title="Owned Species"
            text="You have not added any owned species yet. Browse the database and use + Owned on a species page."
            href="/"
            buttonText="Browse Species"
          />
        ) : null}

        {wishlist.length > 0 ? (
          <CollectionSection
            title="Wishlist"
            label="Wishlist"
            description="Species this keeper is interested in keeping."
            emptyText="No wishlist species listed yet."
            items={wishlist}
            isOwner={isOwner}
          />
        ) : isOwner ? (
          <EmptyOwnerSection
            title="Wishlist"
            text="You have not added anything to your wishlist yet. Use the gift box button on species pages."
            href="/"
            buttonText="Find Species"
          />
        ) : null}

        {!isOwner && items.length === 0 && (
          <section className="mt-8 rounded-3xl border border-white/10 bg-[#142318] p-8 text-center shadow-xl shadow-black/20">
            <h2 className="text-2xl font-bold text-white">
              No public collection items yet
            </h2>

            <p className="mt-3 text-emerald-50/60">
              This keeper has not made any collection items public yet.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-center">
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-100/50">
        {label}
      </p>

      <p className="mt-2 text-3xl font-black text-white">{value}</p>
    </div>
  );
}

function MiniInfo({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b140d]/70 p-4">
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-100/40">
        {label}
      </p>

      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function EmptyOwnerSection({
  title,
  text,
  href,
  buttonText,
}: {
  title: string;
  text: string;
  href: string;
  buttonText: string;
}) {
  return (
    <section className="mt-8 rounded-3xl border border-white/10 bg-[#142318] p-8 shadow-xl shadow-black/20">
      <p className="text-sm font-semibold uppercase tracking-widest text-emerald-300">
        Collection
      </p>

      <h2 className="mt-2 text-3xl font-black text-white">{title}</h2>

      <p className="mt-3 max-w-2xl text-emerald-50/60">{text}</p>

      <Link
        href={href}
        className="mt-5 inline-flex rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
      >
        {buttonText}
      </Link>
    </section>
  );
}

function CollectionSection({
  title,
  label,
  description,
  emptyText,
  items,
  isOwner,
}: {
  title: string;
  label: string;
  description: string;
  emptyText: string;
  items: CollectionItem[];
  isOwner: boolean;
}) {
  return (
    <section className="mt-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-300">
            {label}
          </p>

          <h2 className="mt-2 text-3xl font-black text-white">{title}</h2>

          <p className="mt-2 text-emerald-50/60">{description}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#142318] px-4 py-3 text-sm font-bold text-emerald-100/70">
          {items.length} {items.length === 1 ? "item" : "items"}
        </div>
      </div>

      {items.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const species = item.isopedia_species;

            if (!species) return null;

            const priceText = item.price_is_na
              ? "N/A"
              : item.price
                ? item.price
                : null;

            return (
              <div
                key={item.id}
                className="overflow-hidden rounded-3xl border border-emerald-900/40 bg-[#142318] shadow-xl shadow-black/20 transition hover:border-emerald-400/40"
              >
                <Link href={`/${species.slug}`} className="group block">
                  <div className="flex h-48 w-full items-center justify-center bg-[#0b140d] p-3">
                    {species.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={species.image_url}
                        alt={species.common_name}
                        className="h-full w-full object-contain transition group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center rounded-2xl border border-dashed border-emerald-900/60 text-sm text-emerald-100/40">
                        No image
                      </div>
                    )}
                  </div>
                </Link>

                <div className="p-5">
                  <div className="mb-3 flex flex-wrap gap-2">
                    {item.is_favorite && (
                      <span className="rounded-full bg-rose-400/10 px-3 py-1 text-xs font-bold text-rose-200">
                        Favorite
                      </span>
                    )}

                    {item.is_most_wanted && (
                      <span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-200">
                        Most Wanted
                      </span>
                    )}

                    {species.organism_type && (
                      <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-200">
                        {species.organism_type}
                      </span>
                    )}

                    {species.difficulty && (
                      <span className="rounded-full bg-sky-400/10 px-3 py-1 text-xs font-bold text-sky-200">
                        {species.difficulty}
                      </span>
                    )}

                    {isOwner && !item.is_public && (
                      <span className="rounded-full bg-slate-400/10 px-3 py-1 text-xs font-bold text-slate-300">
                        Private
                      </span>
                    )}
                  </div>

                  <Link href={`/${species.slug}`}>
                    <h3 className="text-2xl font-black text-white transition hover:text-emerald-300">
                      {species.common_name}
                    </h3>
                  </Link>

                  {species.scientific_name && (
                    <p className="mt-1 italic text-emerald-50/70">
                      {species.scientific_name}
                    </p>
                  )}

                  {(species.genus || species.species || species.morph) && (
                    <p className="mt-3 text-sm text-emerald-50/70">
                      {[species.genus, species.species, species.morph]
                        .filter(Boolean)
                        .join(" ")}
                    </p>
                  )}

                  {(item.quantity || priceText) && (
                    <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-[#0b140d]/70 p-4">
                      {item.quantity && (
                        <DetailPill label="Quantity" value={item.quantity} />
                      )}

                      {priceText && (
                        <DetailPill label="Price" value={priceText} />
                      )}
                    </div>
                  )}

                  {item.notes && (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-[#0b140d]/70 p-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-emerald-100/40">
                        Notes
                      </p>

                      <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-emerald-50/65">
                        {item.notes}
                      </p>
                    </div>
                  )}

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <Link
                      href={`/${species.slug}`}
                      className="text-sm font-bold text-emerald-300 hover:text-emerald-200"
                    >
                      View Species →
                    </Link>

                    {isOwner && (
                      <EditCollectionItemModal
                        itemId={item.id}
                        initialQuantity={item.quantity}
                        initialPrice={item.price}
                        initialPriceIsNa={item.price_is_na}
                        initialNotes={item.notes}
                        initialPublic={item.is_public}
                        initialFavorite={item.is_favorite}
                        initialMostWanted={item.is_most_wanted}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-3xl border border-emerald-900/40 bg-[#142318] p-8 text-center shadow-xl shadow-black/20">
          <p className="text-emerald-50/60">{emptyText}</p>
        </div>
      )}
    </section>
  );
}

function DetailPill({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-100/40">
        {label}
      </p>

      <p className="mt-1 text-base font-bold text-white">{value}</p>
    </div>
  );
}
