export type ContentAgentPage = {
  id: string;
  page_key: string;
  page_name: string;
  active: boolean;
  auto_publish_enabled: boolean;
  auto_approve_generated: boolean;
  meta_page_id: string | null;
  token_env_key: string | null;
  target_buffer_days: number;
  schedule_slots: Array<{ time: string; postType: string }>;
  content_cycle: string[];
  default_hashtags: string | null;
  brand_rules: string | null;
  text_style: string | null;
  meme_style: string | null;
  website_url: string | null;
};

export type ContentAgentTopic = {
  id: string;
  page_key: string;
  topic: string;
  post_type: string;
  notes: string | null;
  active: boolean;
  last_used_at: string | null;
  use_count: number;
};

export type ContentAgentPost = {
  id: string;
  page_key: string;
  scheduled_at: string;
  post_type: string;
  topic_id: string | null;
  topic: string | null;
  caption: string | null;
  hashtags: string | null;
  meme_top_text: string | null;
  meme_bottom_text: string | null;
  image_prompt: string | null;
  image_url: string | null;
  image_storage_path: string | null;
  status: "Draft" | "Needs Edit" | "Approved" | "Rejected" | "Posted" | "Error";
  approval_notes: string | null;
  posted_at: string | null;
  facebook_post_id: string | null;
  facebook_post_url: string | null;
  error: string | null;
  source_type: string;
  source_ref_id: string | null;
  raw_payload: Record<string, unknown>;
};

export type GeneratedPostPayload = {
  topic: string;
  caption: string;
  hashtags: string;
  memeTopText?: string;
  memeBottomText?: string;
  imagePrompt?: string;
};

export type NextSlot = {
  pageKey: string;
  pageName: string;
  scheduledAt: Date;
  postType: string;
};
