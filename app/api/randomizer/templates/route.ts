import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { cleanName } from "@/lib/randomizer";

const STANDARD_TEMPLATE_LIMIT = 5;
const LIFETIME_TEMPLATE_LIMIT = 10;

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to view templates." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("randomizer_templates")
    .select("id, name, title, description, rules, logo_data_url, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ templates: data || [] });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to save templates." }, { status: 401 });
  }

  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const name = cleanName(body.name) || "Randomizer Template";
  const title = cleanName(body.title);
  const description = cleanName(body.description);
  const rules = cleanName(body.rules);
  const logoDataUrl = cleanName(body.logoDataUrl);
  const { data: account, error: accountError } = await supabase
    .from("randomizer_accounts")
    .select("lifetime_access")
    .eq("user_id", user.id)
    .maybeSingle<{ lifetime_access: boolean }>();

  if (accountError) {
    return NextResponse.json({ error: accountError.message }, { status: 500 });
  }

  const templateLimit = account?.lifetime_access
    ? LIFETIME_TEMPLATE_LIMIT
    : STANDARD_TEMPLATE_LIMIT;
  const { count, error: countError } = await supabase
    .from("randomizer_templates")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  if ((count || 0) >= templateLimit) {
    return NextResponse.json(
      {
        error: `You can save up to ${templateLimit} templates${
          account?.lifetime_access ? " with lifetime access" : ""
        }. Delete an old template before saving a new one.`,
      },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("randomizer_templates")
    .insert({
      user_id: user.id,
      name,
      title,
      description,
      rules,
      logo_data_url: logoDataUrl || null,
    })
    .select("id, name, title, description, rules, logo_data_url, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ template: data });
}

export async function DELETE(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to delete templates." }, { status: 401 });
  }

  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const templateId = typeof body.id === "string" ? body.id : "";

  if (!templateId) {
    return NextResponse.json({ error: "Choose a template to delete." }, { status: 400 });
  }

  const { error } = await supabase
    .from("randomizer_templates")
    .delete()
    .eq("id", templateId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
