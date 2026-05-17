import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  boundedInteger,
  cleanName,
  generateRandomizerResult,
  makePublicCode,
  normalizeMode,
  parseStringList,
} from "@/lib/randomizer";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in before generating a result." }, { status: 401 });
  }

  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const title = cleanName(body.title) || "Randomizer Wheel";
  const description = cleanName(body.description);
  const rules = cleanName(body.rules);
  const mode = normalizeMode(body.mode);
  const entries = parseStringList(body.entries);
  const spinCount = boundedInteger(body.spinCount, 1, 1, 1000);
  const prizeInterval = boundedInteger(body.prizeInterval, 0, 0, 1000);
  const winnerCount = boundedInteger(body.winnerCount, 1, 1, 1000);
  const prizeList = parseStringList(body.prizeList);
  const preventDuplicateWinners = body.preventDuplicateWinners !== false;
  const logoDataUrl = cleanName(body.logoDataUrl);

  if (entries.length < 2) {
    return NextResponse.json({ error: "Enter at least 2 names." }, { status: 400 });
  }

  const requestedWinners = mode === "multi-prize" ? prizeList.length || winnerCount : 1;

  if (mode === "multi-prize" && requestedWinners > entries.length) {
    return NextResponse.json(
      { error: "You requested more winners/prizes than total entries." },
      { status: 400 }
    );
  }

  const { data: accessCheck, error: accessError } = await supabase.rpc(
    "consume_randomizer_credit_if_needed"
  );

  if (accessError) {
    return NextResponse.json({ error: accessError.message }, { status: 500 });
  }

  if (!accessCheck?.allowed) {
    return NextResponse.json(
      {
        error:
          "Purchase access or credits before generating an official result.",
        billingUrl: "/randomizer/billing",
      },
      { status: 402 }
    );
  }

  let generated;

  try {
    generated = generateRandomizerResult({
      mode,
      entries,
      spinCount,
      prizeInterval,
      winnerCount,
      prizeList,
      preventDuplicateWinners,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not generate result." },
      { status: 400 }
    );
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const publicCode = makePublicCode();
    const { data, error } = await supabase
      .from("randomizer_results")
      .insert({
        public_code: publicCode,
        created_by: user.id,
        title,
        description,
        rules,
        mode,
        spin_count: spinCount,
        prize_interval: prizeInterval,
        winner_count: winnerCount,
        prize_list: prizeList,
        prevent_duplicate_winners: preventDuplicateWinners,
        entries,
        spin_history: generated.spinHistory,
        winners: generated.winners,
        logo_data_url: logoDataUrl || null,
      })
      .select("public_code")
      .single();

    if (!error && data) {
      return NextResponse.json({
        publicCode: data.public_code,
        resultUrl: `/randomizer/results/${data.public_code}`,
      });
    }

    if (error && error.code !== "23505") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Could not create a unique result code." }, { status: 500 });
}
