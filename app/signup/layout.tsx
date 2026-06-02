import type { Metadata } from "next";
import { noIndexRobots } from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: "Create Account" },
  robots: noIndexRobots,
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
