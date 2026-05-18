import { createSupabaseAdminClient } from "./supabase-admin";
import type { ContentAgentPage, NextSlot } from "./types";

function startOfDay(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
function addDays(date: Date, days: number) { const out = new Date(date); out.setDate(out.getDate() + days); return out; }
function toDateTime(date: Date, time: string) { const [h, m] = time.split(":").map(Number); const out = new Date(date); out.setHours(h || 0, m || 0, 0, 0); return out; }

export function buildSlots(page: ContentAgentPage, start: Date, days: number): NextSlot[] {
  const slots: NextSlot[] = [];
  const cycle = page.content_cycle || [];
  let cycleIndex = 0;
  for (let d = 0; d < days; d += 1) {
    const date = addDays(start, d);
    for (const scheduleSlot of page.schedule_slots || []) {
      const postType = cycle.length ? cycle[cycleIndex % cycle.length] : scheduleSlot.postType;
      slots.push({ pageKey: page.page_key, pageName: page.page_name, scheduledAt: toDateTime(date, scheduleSlot.time), postType });
      cycleIndex += 1;
    }
  }
  return slots;
}

export async function findNextMissingSlot(page: ContentAgentPage) {
  const supabase = createSupabaseAdminClient();
  const tomorrow = addDays(startOfDay(new Date()), 1);
  const slots = buildSlots(page, tomorrow, Math.max(page.target_buffer_days || 14, 7));
  const { data, error } = await supabase.from("content_agent_posts").select("scheduled_at, page_key, status").eq("page_key", page.page_key).not("status", "in", '("Rejected","Error")').gte("scheduled_at", tomorrow.toISOString());
  if (error) throw new Error(error.message);
  const occupied = new Set((data || []).map((row) => `${row.page_key}|${new Date(row.scheduled_at).toISOString().slice(0, 16)}`));
  for (const slot of slots) {
    const key = `${slot.pageKey}|${slot.scheduledAt.toISOString().slice(0, 16)}`;
    if (!occupied.has(key)) return slot;
  }
  return null;
}

export function isImagePostTypeForPage(...args: unknown[]) {
  void args;
  // Normal content-agent generation is text-only. Isopedia smart posts may
  // still attach existing uploaded images, but they do not wait for generated
  // image creation.
  return false;
}
