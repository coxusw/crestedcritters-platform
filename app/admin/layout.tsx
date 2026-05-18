import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    absolute: "Crested Critters Admin",
    default: "Crested Critters Admin",
    template: "%s | Crested Critters Admin",
  },
  description: "Private Crested Critters admin dashboard.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-shell">
      {children}
      <style>{`
        @media (max-width: 640px) {
          .admin-shell main {
            padding-left: 0.75rem !important;
            padding-right: 0.75rem !important;
            padding-top: 1rem !important;
            padding-bottom: 1rem !important;
          }

          .admin-shell h1 {
            font-size: 1.75rem !important;
            line-height: 2.1rem !important;
          }

          .admin-shell h2 {
            font-size: 1.05rem !important;
            line-height: 1.45rem !important;
          }

          .admin-shell :where(header, section, article, details, form, .rounded-3xl) {
            border-radius: 0.75rem !important;
          }

          .admin-shell :where(.p-8, .p-6, .p-5) {
            padding: 1rem !important;
          }

          .admin-shell :where(.px-6, .px-5, .px-4) {
            padding-left: 0.75rem !important;
            padding-right: 0.75rem !important;
          }

          .admin-shell :where(.py-8, .py-6) {
            padding-top: 1rem !important;
            padding-bottom: 1rem !important;
          }

          .admin-shell :where(button, a) {
            min-height: 2.5rem;
          }

          .admin-shell :where(input, select, textarea) {
            font-size: 16px !important;
          }

          .admin-shell table {
            font-size: 0.8125rem !important;
          }
        }
      `}</style>
    </div>
  );
}
