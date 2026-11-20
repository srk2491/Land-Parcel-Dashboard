import { env } from "cloudflare:workers";
import { validParcelId } from "../../../lib/media-validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!env.DB) return Response.json({ error: "Media storage is not configured." }, { status: 503 });
  const parcelId = validParcelId(new URL(request.url).searchParams.get("parcelId"));
  if (!parcelId) return Response.json({ error: "Invalid parcel number." }, { status: 400 });
  const result = await env.DB.prepare(
    "SELECT id, parcel_id, media_type, file_name, mime_type, size_bytes, uploaded_at FROM parcel_media WHERE parcel_id = ? ORDER BY uploaded_at DESC",
  ).bind(parcelId).all();
  const media = (result.results ?? []).map((row: Record<string, unknown>) => ({
    id: row.id,
    parcelId: row.parcel_id,
    mediaType: row.media_type,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    uploadedAt: row.uploaded_at,
    url: `/api/media/file/${encodeURIComponent(String(row.id))}`,
  }));
  return Response.json({ media }, { headers: { "Cache-Control": "no-store" } });
}
