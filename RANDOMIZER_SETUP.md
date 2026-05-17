# Randomizer setup

## Domains

Add `randomizer.crestedcritters.com` to the same Vercel project that hosts Isopedia.

In GoDaddy DNS, create a CNAME record:

- Type: `CNAME`
- Name: `randomizer`
- Value: `cname.vercel-dns.com`

After Vercel verifies the domain, the app serves:

- `https://randomizer.crestedcritters.com/` -> Randomizer
- `https://randomizer.crestedcritters.com/billing` -> access and credit checkout
- `https://randomizer.crestedcritters.com/results/CODE` -> public result page

## Supabase

Run the migrations:

- `supabase/migrations/20260517_randomizer_results.sql`
- `supabase/migrations/20260517_randomizer_billing.sql`

The billing model is:

- active access or lifetime access: unlimited official results
- no active access: one official result costs one credit
- credits do not expire

## Vercel environment variables

Add these to the Vercel project:

- `RANDOMIZER_PUBLIC_URL=https://randomizer.crestedcritters.com`
- `NEXT_PUBLIC_RANDOMIZER_URL=https://randomizer.crestedcritters.com`
- `SQUARE_ACCESS_TOKEN=...`
- `SQUARE_LOCATION_ID=...`
- `SQUARE_WEBHOOK_SIGNATURE_KEY=...`
- `SQUARE_WEBHOOK_NOTIFICATION_URL=https://randomizer.crestedcritters.com/api/square/webhook`
- `SQUARE_ENVIRONMENT=production`
- `SQUARE_API_VERSION=2026-04-16`

`SUPABASE_SERVICE_ROLE_KEY` must also be present because Square webhooks update account access server-side.

## Square

In the Square Developer Dashboard, configure a webhook subscription pointing to:

`https://randomizer.crestedcritters.com/api/square/webhook`

Enable payment events, especially payment created/updated events. The webhook grants the purchased access or credits after Square confirms the payment.
