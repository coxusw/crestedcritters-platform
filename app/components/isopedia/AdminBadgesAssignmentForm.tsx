"use client";

import { useMemo, useState } from "react";

type ProfileOption = {
  id: string;
  username: string | null;
  display_name: string | null;
  business_name: string | null;
  role: string | null;
};

type BadgeOption = {
  id: string;
  label: string;
  icon: string | null;
  is_active: boolean;
};

type Props = {
  profiles: ProfileOption[];
  badges: BadgeOption[];
};

export default function AdminBadgeAssignmentForm({ profiles, badges }: Props) {
  const [search, setSearch] = useState("");
  const [selectedUsername, setSelectedUsername] = useState("");

  const filteredProfiles = useMemo(() => {
    const term = search.toLowerCase().trim();

    if (!term) return profiles.slice(0, 10);

    return profiles
      .filter((profile) => {
        const combined = [
          profile.username,
          profile.display_name,
          profile.business_name,
          profile.role,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return combined.includes(term);
      })
      .slice(0, 12);
  }, [profiles, search]);

  const selectedProfile = profiles.find(
    (profile) => profile.username === selectedUsername
  );

  return (
    <div className="grid gap-5">
      <input type="hidden" name="username" value={selectedUsername} />

      <label className="grid gap-2">
        <span className="text-sm font-semibold text-emerald-50/80">
          Search User *
        </span>

        <input
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setSelectedUsername("");
          }}
          placeholder="Search username, name, business, or role..."
          className="rounded-xl border border-white/10 bg-[#0b140d] px-4 py-3 text-white outline-none ring-emerald-400/30 placeholder:text-emerald-50/30 focus:ring-4"
        />
      </label>

      <div className="max-h-72 overflow-y-auto rounded-2xl border border-white/10 bg-[#0b140d]/70 p-3">
        {filteredProfiles.length > 0 ? (
          <div className="grid gap-2">
            {filteredProfiles.map((profile) => {
              const publicName =
                profile.display_name ||
                profile.business_name ||
                profile.username ||
                "Unnamed user";

              const username = profile.username || "";

              const isSelected = username === selectedUsername;

              return (
                <button
                  key={profile.id}
                  type="button"
                  disabled={!username}
                  onClick={() => setSelectedUsername(username)}
                  className={
                    isSelected
                      ? "rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-3 text-left"
                      : "rounded-xl border border-white/10 bg-[#142318] p-3 text-left transition hover:bg-[#18291d]"
                  }
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-bold text-white">{publicName}</p>

                      <p className="mt-1 text-sm text-emerald-50/60">
                        {username ? `@${username}` : "No username"}
                      </p>
                    </div>

                    {profile.role && (
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold uppercase tracking-widest text-emerald-100/60">
                        {profile.role}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="p-3 text-sm text-emerald-50/50">No users found.</p>
        )}
      </div>

      {selectedProfile && (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-200/70">
            Selected User
          </p>

          <p className="mt-2 font-black text-white">
            {selectedProfile.display_name ||
              selectedProfile.business_name ||
              selectedProfile.username}
          </p>

          <p className="mt-1 text-sm text-emerald-50/70">
            @{selectedProfile.username}
          </p>
        </div>
      )}

      <label className="grid gap-2">
        <span className="text-sm font-semibold text-emerald-50/80">
          Badge *
        </span>

        <select
          name="badge_id"
          className="rounded-xl border border-white/10 bg-[#0b140d] px-4 py-3 text-white outline-none ring-emerald-400/30 focus:ring-4"
          required
        >
          <option value="">Choose badge</option>
          {badges.map((badge) => (
            <option key={badge.id} value={badge.id}>
              {badge.icon ? `${badge.icon} ` : ""}
              {badge.label}
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        disabled={!selectedUsername}
        className={
          selectedUsername
            ? "rounded-xl bg-emerald-400 px-6 py-3 font-black text-slate-950 transition hover:bg-emerald-300"
            : "cursor-not-allowed rounded-xl bg-slate-700 px-6 py-3 font-black text-slate-400"
        }
      >
        Assign Badge
      </button>
    </div>
  );
}