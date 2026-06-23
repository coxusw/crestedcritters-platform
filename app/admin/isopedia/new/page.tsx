import Link from "next/link";
import SpeciesForm from "../SpeciesForm";
import { createSpecies } from "../actions";

export default function NewSpeciesPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <Link
          href="/admin/isopedia"
          className="rounded-xl border border-emerald-900/20 bg-white px-4 py-2 text-sm font-bold text-emerald-900 shadow-sm transition hover:bg-emerald-50"
        >
          ← Back to Isopedia Admin
        </Link>

        <h1 className="mt-3 text-3xl font-bold">Add New Species</h1>
      </div>

      <SpeciesForm action={createSpecies} submitLabel="Create Species" />
    </main>
  );
}
