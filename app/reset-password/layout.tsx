import type { Metadata } from "next";
import { noIndexRobots } from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: "Reset Password" },
  robots: noIndexRobots,
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
