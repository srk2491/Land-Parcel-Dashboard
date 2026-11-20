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

## Local photo/video uploads

Media editing uses local D1/R2 emulation and the local preview identity. To enable it, create a `.dev.vars` file in the project root containing:

```dotenv
MEDIA_ADMIN_USER_IDS=local_seedy
```

Then build once and create the local metadata table:

```bash
npm run build
npx wrangler d1 execute site-creator-d1 --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_steep_adam_warlock.sql
npm run dev
```

The local preview stores uploaded media on your computer under Wrangler's local state. `.dev.vars` is ignored by Git; never commit real secrets.

## GitHub and hosting

Upload the project files to a GitHub repository. Do not upload `node_modules`, `.git`, `.next`, `.wrangler`, `.sites-runtime`, or `dist`; those are local or generated files. After cloning the repository on another computer, run `npm install` and `npm run dev`.

GitHub stores the source. The media API needs the Cloudflare Worker runtime, D1 for media records, and R2 for original files; GitHub Pages alone serves only static files and cannot run these upload routes. For the existing ChatGPT Site deployment, configure the `DB` and `BUCKET` bindings and set the secret `MEDIA_ADMIN_USER_IDS` to the authorized Site user ID. The Site is public, so uploaded media can be viewed by anyone with the dashboard link; editing is owner-only.

## Media behavior

- The PDF-embedded GPS photo remains unchanged as source evidence.
- Add, replace, or delete high-resolution field photos and videos from each parcel drawer.
- Accepted formats: JPG/JPEG, PNG, WebP, HEIC/HEIF, MP4, MOV/QuickTime, and WebM.
- Uploads use 8 MiB multipart chunks and accept files up to 1 GiB each.
- R2 stores the original media; D1 stores its parcel association and metadata.

## Project layout

- `public/`: dashboard UI, data, source PDF, and parcel image crops.
- `app/`: Site routes, sign-in page, and media APIs.
- `db/` and `drizzle/`: D1 schema and migration.
- `lib/`: media authorization and validation.
- `worker/`: Worker entry point.
- `extract_parcels.py`: rebuilds the 79-record dataset and source crops from the PDF.

The PDF contains GPS-labelled photographs but no machine-readable coordinates, so parcels are not plotted on a map.
