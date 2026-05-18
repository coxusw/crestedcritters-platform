import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
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
  return children;
}
