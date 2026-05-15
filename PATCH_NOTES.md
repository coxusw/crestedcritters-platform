# Optional patch notes

Your existing `/app/admin/page.tsx` already shows `Facebook Agent`.
If it is not linked yet, point it to:

```text
/admin/content-agent
```

For v1, edit Page IDs, schedules, and topics in Supabase Table Editor:
- `content_agent_pages`
- `content_agent_topics`

Set `auto_publish_enabled = true` only after posting tests work.
