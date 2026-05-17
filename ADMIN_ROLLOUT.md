# Crested Critters Admin Rollout

This rollout keeps the existing admin routes in place while adding
`admin.crestedcritters.com` as a parallel admin entry point.

## What is implemented

- `admin.crestedcritters.com/` rewrites to the existing Next.js `/admin` app.
- `admin.crestedcritters.com/login` rewrites to `/admin/login`.
- Existing `/admin` routes remain available and have not been deleted.
- The admin dashboard now includes tabs/cards for:
  - Isopedia tools
  - Facebook content agent
  - Randomizer
  - Bookkeeping
  - IsoTracker
  - Shop
- Placeholder planning pages are in place for Randomizer, Bookkeeping,
  IsoTracker, and Shop so those tools can be built without changing the public
  site first.

## DNS updates needed

Add a DNS record for:

```text
admin.crestedcritters.com
```

Point it at the same Vercel project that currently serves the platform app.
If Vercel gives you a CNAME target, use that target. Common Vercel setup:

```text
Type: CNAME
Name: admin
Value: cname.vercel-dns.com
```

Also add the domain inside the Vercel project domains list so Vercel issues SSL.

Future subdomains likely needed:

```text
isotracker.crestedcritters.com
shop.crestedcritters.com
```

`randomizer.crestedcritters.com` already has host routing in this app.

## Access and credentials needed later

Bookkeeping:

- Square developer application credentials.
- Square access token and environment choice: sandbox or production.
- Square webhook signing secret.
- Permission to read the current bookkeeping Google Sheet, or an export of it.
- Email access method for receipts, such as Gmail/Outlook connector permission
  or forwarded receipt mailbox details.

Shop:

- Decision between Square hosted checkout and embedded Square Web Payments SDK.
- Square catalog and inventory API access.
- Shipping, pickup, taxes, and local delivery rules.
- Product source of truth: existing markdown products, Square catalog, or a new
  database table.

IsoTracker:

- Decision on whether the first subdomain release is the current static app
  copied as-is or rebuilt inside the platform app.
- Confirmation that all user data must remain local-only until paid backup is
  deliberately added.

Admin security:

- Confirm which Supabase users should be in `admin_profiles`.
- Consider enabling MFA in Supabase for admin users before using this for shop
  and bookkeeping operations.
