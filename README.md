# Land Parcel Dashboard

An interactive dashboard for the primary land register in the PDF dated 20 November 2026. The project includes the corrected 79-parcel data, Kannada source-row images, PDF photo crops, and per-parcel high-resolution photo/video uploads.

## Register totals

- 79 parcels in the primary register.
- Normalized parcel area: **496 acres 34 guntas**. The PDF subtotal is 479 acres 714 guntas; 40 guntas normalize to one acre.
- Rows 80–103 are under the separate Kannada heading `ಉಳಿಕೆ` (remaining) and are excluded from these dashboard totals.
- Locality labels are English transliterations. Each parcel drawer keeps a crop of the Kannada source row and a link to the original PDF page.

## Run the dashboard locally

Requirements: Node.js 22.13 or later and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by the dev server. The dashboard and its parcel data run locally. The dev sign-in is simulated by the preview server.

To build and run the local Worker preview:

```bash
npm run build
npm run start
```

## Cloudflare Pages and online media setup

The GitHub repository holds the app and the parcel register. Cloudflare Pages serves the static dashboard and deploys each push. Supabase stores uploaded media separately, so photos and videos appear online without a GitHub commit.

This setup reuses the OLH Supabase project, its `official_media_uploaders` allowlist, and the `is_olh_media_uploader()` policy function. Run `supabase/land-parcel-media.sql` in that project's SQL Editor. It creates a separate `land_parcel_media` table and public `land-parcel-media` bucket, with uploads restricted to approved OLH media editors. This is additive; do not rerun the OLH base media schema.

In `public/media-config.js`, fill in the existing Supabase Project URL and publishable/anon key, and keep the bucket name `land-parcel-media`. The publishable/anon key is designed for browser use only because row-level security is enabled. **Never put a Supabase service-role key in this file or the GitHub repository.**

In Supabase **Authentication → URL Configuration**, add the Cloudflare Pages URL, such as `https://land-parcel-dashboard.pages.dev/**`, to **Redirect URLs**. Keep the OLH URL there too; leave the existing **Site URL** unchanged because OLH uses that default for its invite links. Existing approved OLH media editors can sign in to this app. For a new editor, create the Auth account using your existing OLH invite process, then activate their lower-case email in `public.official_media_uploaders` before they sign in. Keep public sign-ups disabled.

In Cloudflare, create a **Pages** project connected to `srk2491/Land-Parcel-Dashboard`. Use production branch `main`, build command `exit 0`, and output directory `public`. After the first deploy, copy its `pages.dev` URL into Supabase Redirect URLs, then commit and push `public/media-config.js`. Cloudflare automatically redeploys the update.

For local dashboard use, run `npm install` and `npm run dev`. If `public/media-config.js` has valid Supabase settings, media uploads go to the online Supabase project from local testing too.

## Media behavior

- The dashboard shows PDF source photos and row crops separately from uploaded field media.
- An approved editor opens a parcel, chooses **Manage photos and videos for this parcel**, signs in, then uploads, replaces, or deletes media in the manager.
- Accepted upload formats: JPG/JPEG, PNG, WebP, MP4 and WebM. The current bucket limit is 90 MB per file.
- Supabase Storage holds the files; `land_parcel_media` stores each file's parcel number and metadata. The bucket is public for viewing, while RLS restricts changes to approved editors.
- Uploads appear after the dashboard is refreshed. They do not require a scraper run, GitHub commit, or Cloudflare redeploy.

## Project layout

- `public/`: dashboard UI, data, source PDF, and parcel image crops.
- `app/`: Site routes, sign-in page, and media APIs.
- `db/` and `drizzle/`: D1 schema and migration.
- `lib/`: media authorization and validation.
- `worker/`: Worker entry point.
- `extract_parcels.py`: rebuilds the 79-record dataset and source crops from the PDF.

The PDF contains GPS-labelled photographs but no machine-readable coordinates, so parcels are not plotted on a map.
