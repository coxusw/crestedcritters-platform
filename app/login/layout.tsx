import type { Metadata } from "next";
import { noIndexRobots } from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: "Sign In" },
  robots: noIndexRobots,
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
