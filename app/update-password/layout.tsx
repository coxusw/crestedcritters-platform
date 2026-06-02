import type { Metadata } from "next";
import { noIndexRobots } from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: "Update Password" },
  robots: noIndexRobots,
};

export default function UpdatePasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
