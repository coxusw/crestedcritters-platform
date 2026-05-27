import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{
    username: string;
  }>;
};

export default async function IsopediaProfileRedirect({ params }: PageProps) {
  const { username } = await params;
  redirect(`/profile/${username}`);
}
