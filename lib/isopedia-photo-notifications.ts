import { createSupabaseAdminClient } from "@/lib/content-agent/supabase-admin";
import { publicSpeciesSlug } from "@/lib/isopedia-slugs";

type SpeciesPhotoNotificationInput = {
  speciesId: number;
  speciesName: string;
  speciesSlug: string;
  imageId: string;
  actorId: string | null;
};

export async function createSpeciesPhotoNotifications({
  speciesId,
  speciesName,
  speciesSlug,
  imageId,
  actorId,
}: SpeciesPhotoNotificationInput) {
  if (!actorId) return;

  const admin = createSupabaseAdminClient();
  const { data: follows, error } = await admin
    .from("species_follows")
    .select("profile_id")
    .eq("species_id", speciesId)
    .eq("notify_photos", true)
    .returns<Array<{ profile_id: string }>>();

  if (error) {
    console.error("Failed to load species photo followers:", error.message);
    return;
  }

  const recipientIds = [
    ...new Set(
      (follows || [])
        .map((follow) => follow.profile_id)
        .filter((profileId) => profileId !== actorId)
    ),
  ];

  if (!recipientIds.length) return;

  const { data: existingNotifications, error: existingError } = await admin
    .from("notifications")
    .select("recipient_id")
    .eq("type", "followed_species_photo")
    .eq("metadata->>image_id", imageId)
    .in("recipient_id", recipientIds)
    .returns<Array<{ recipient_id: string }>>();

  if (existingError) {
    console.error("Failed to check existing species photo notifications:", existingError.message);
    return;
  }

  const existingRecipientIds = new Set(
    (existingNotifications || []).map((notification) => notification.recipient_id)
  );
  const newRecipientIds = recipientIds.filter(
    (recipientId) => !existingRecipientIds.has(recipientId)
  );

  if (!newRecipientIds.length) return;

  const destinationUrl = `/${publicSpeciesSlug(speciesSlug)}`;
  const { error: notificationError } = await admin.from("notifications").insert(
    newRecipientIds.map((recipientId) => ({
      recipient_id: recipientId,
      actor_id: actorId,
      type: "followed_species_photo",
      destination_url: destinationUrl,
      metadata: {
        title: `New photo for ${speciesName}`,
        species_id: speciesId,
        species_name: speciesName,
        species_slug: publicSpeciesSlug(speciesSlug),
        image_id: imageId,
      },
    }))
  );

  if (notificationError) {
    console.error("Failed to create species photo notifications:", notificationError.message);
  }
}
