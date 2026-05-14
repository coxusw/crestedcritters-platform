import Link from "next/link";
import SpeciesForm from "../SpeciesForm";
import { createSpecies } from "../actions";

export default function NewSpeciesPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <Link
          href="/admin/isopedia"
          className="text-sm font-semibold text-emerald-700"
        >
          ← Back to Isopedia Admin
        </Link>

        <h1 className="mt-3 text-3xl font-bold">Add New Species</h1>
      </div>

      <SpeciesForm action={createSpecies} submitLabel="Create Species" />
    </main>
  );
}