"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

function textValue(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/notifications");
  return { supabase, user };
}

export async function markNotificationRead(formData: FormData) {
  const { supabase, user } = await requireUser();
  const notificationId = textValue(formData.get("notification_id"));
  const destinationUrl = textValue(formData.get("destination_url"));

  if (!notificationId) throw new Error("Missing notification.");

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("recipient_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/notifications");
  if (destinationUrl) redirect(destinationUrl);
  redirect("/notifications");
}

export async function markAllNotificationsRead() {
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", user.id)
    .is("read_at", null);

  if (error) throw new Error(error.message);

  revalidatePath("/notifications");
  redirect("/notifications");
}

export async function deleteNotification(formData: FormData) {
  const { user } = await requireUser();
  const notificationId = textValue(formData.get("notification_id"));

  if (!notificationId) throw new Error("Missing notification.");

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("notifications")
    .delete()
    .eq("id", notificationId)
    .eq("recipient_id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/notifications");
  redirect("/notifications");
}

export async function clearReadNotifications() {
  const { user } = await requireUser();
  const admin = createSupabaseAdminClient();

  const { error } = await admin
    .from("notifications")
    .delete()
    .eq("recipient_id", user.id)
    .not("read_at", "is", null);

  if (error) throw new Error(error.message);

  revalidatePath("/notifications");
  redirect("/notifications");
}
