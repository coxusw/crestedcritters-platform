import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type PushSubscriptionPayload = {
  endpoint?: unknown;
  keys?: unknown;
};

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before enabling notifications." }, { status: 401 });
  }

  let body: PushSubscriptionPayload;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid subscription payload." }, { status: 400 });
  }

  if (typeof body.endpoint !== "string" || body.endpoint.length < 10 || !body.keys) {
    return NextResponse.json({ error: "Browser subscription is missing required fields." }, { status: 400 });
  }

  const { error } = await supabase.from("isopedia_push_subscriptions").upsert(
    {
      profile_id: user.id,
      endpoint: body.endpoint,
      subscription: body,
      user_agent: request.headers.get("user-agent"),
      active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id,endpoint" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("isopedia_notification_preferences").upsert(
    {
      profile_id: user.id,
      push_enabled: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id" }
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before changing notifications." }, { status: 401 });
  }

  let endpoint = "";

  try {
    const body = await request.json();
    endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  } catch {
    endpoint = "";
  }

  if (endpoint) {
    await supabase
      .from("isopedia_push_subscriptions")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("profile_id", user.id)
      .eq("endpoint", endpoint);
  }

  const { error } = await supabase
    .from("isopedia_notification_preferences")
    .upsert(
      {
        profile_id: user.id,
        push_enabled: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "profile_id" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
