import { env } from "cloudflare:workers";
import { getMediaAdmin } from "../../../../../lib/media-auth";
import { inferMedia, MAX_FILE_BYTES, PART_BYTES, safeFileName, validParcelId } from "../../../../../lib/media-validation";

export const dynamic = "force-dynamic";

type Part = { partNumber: number; etag: string };

export async function POST(request: Request) {
  const user = await getMediaAdmin();
  if (!user) return Response.json({ error: "Not authorized." }, { status: 403 });
  if (!env.DB || !env.BUCKET) return Response.json({ error: "Media storage is not configured." }, { status: 503 });

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return Response.json({ error: "Invalid completion details." }, { status: 400 }); }
  const key = String(body.key ?? "");
  const uploadId = String(body.uploadId ?? "");
  const parcelId = validParcelId(body.parcelId);
  const fileName = safeFileName(String(body.fileName ?? ""));
  const media = inferMedia(fileName, String(body.mimeType ?? ""));
  const sizeBytes = Number(body.sizeBytes);
  const replaceId = typeof body.replaceId === "string" ? body.replaceId : null;
  const parts = Array.isArray(body.parts) ? body.parts as Part[] : [];
  const expectedParts = Math.ceil(sizeBytes / PART_BYTES);
  const validParts = parts.length === expectedParts && parts.length > 0 && parts.every((part, index) =>
    Number.isInteger(part?.partNumber) && part.partNumber === index + 1 && typeof part.etag === "string" && part.etag.length > 0,
  );

  if (!key.startsWith(`uploads/${user.userId}/`) || !uploadId || !parcelId || !media || !Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_FILE_BYTES || !validParts) {
    return Response.json({ error: "Upload details could not be verified." }, { status: 400 });
  }

  let previous: { id: string; object_key: string; parcel_id: number; media_type: string } | null = null;
  if (replaceId) {
    previous = await env.DB.prepare("SELECT id, object_key, parcel_id, media_type FROM parcel_media WHERE id = ?").bind(replaceId).first<typeof previous>();
    if (!previous || previous.parcel_id !== parcelId || previous.media_type !== media.mediaType) {
      return Response.json({ error: "The item to replace no longer matches this parcel." }, { status: 400 });
    }
  }

  let completed: Awaited<ReturnType<ReturnType<typeof env.BUCKET.resumeMultipartUpload>["complete"]>>;
  try {
    completed = await env.BUCKET.resumeMultipartUpload(key, uploadId).complete(parts);
  } catch {
    return Response.json({ error: "Could not finish uploading this file." }, { status: 500 });
  }
  if (completed.size !== sizeBytes || completed.size > MAX_FILE_BYTES) {
    await env.BUCKET.delete(key);
    return Response.json({ error: "Uploaded file size did not match the selected file." }, { status: 400 });
  }

  const id = previous?.id ?? crypto.randomUUID();
  const uploadedAt = new Date().toISOString();
  try {
    if (previous) {
      await env.DB.prepare("UPDATE parcel_media SET file_name = ?, mime_type = ?, size_bytes = ?, object_key = ?, uploaded_by = ?, uploaded_at = ? WHERE id = ?")
        .bind(fileName, media.mimeType, completed.size, key, user.userId, uploadedAt, id).run();
    } else {
      await env.DB.prepare("INSERT INTO parcel_media (id, parcel_id, media_type, file_name, mime_type, size_bytes, object_key, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(id, parcelId, media.mediaType, fileName, media.mimeType, completed.size, key, user.userId, uploadedAt).run();
    }
  } catch {
    await env.BUCKET.delete(key);
    return Response.json({ error: "Could not save the media record." }, { status: 500 });
  }
  if (previous) {
    try { await env.BUCKET.delete(previous.object_key); } catch { /* The new version is already live; an old orphan can be cleaned up later. */ }
  }
  return Response.json({ media: { id, parcelId, mediaType: media.mediaType, fileName, mimeType: media.mimeType, sizeBytes: completed.size, uploadedAt, url: `/api/media/file/${id}` } });
}
