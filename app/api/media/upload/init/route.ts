import { env } from "cloudflare:workers";
import { getMediaAdmin } from "../../../../../lib/media-auth";
import { inferMedia, MAX_FILE_BYTES, safeFileName, validParcelId } from "../../../../../lib/media-validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getMediaAdmin();
  if (!user) return Response.json({ error: "Sign in with the authorized editor account to upload media." }, { status: 403 });
  if (!env.DB || !env.BUCKET) return Response.json({ error: "Media storage is not configured." }, { status: 503 });

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return Response.json({ error: "Invalid upload details." }, { status: 400 }); }

  const parcelId = validParcelId(body.parcelId);
  const fileName = safeFileName(String(body.fileName ?? ""));
  const media = inferMedia(fileName, String(body.mimeType ?? ""));
  const sizeBytes = Number(body.sizeBytes);
  const replaceId = typeof body.replaceId === "string" ? body.replaceId : null;
  if (!parcelId || !media || !Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_FILE_BYTES) {
    return Response.json({ error: "Choose a supported photo or video up to 1 GB." }, { status: 400 });
  }

  if (replaceId) {
    const previous = await env.DB.prepare("SELECT parcel_id, media_type FROM parcel_media WHERE id = ?").bind(replaceId).first<{ parcel_id: number; media_type: string }>();
    if (!previous || previous.parcel_id !== parcelId || previous.media_type !== media.mediaType) {
      return Response.json({ error: "The item to replace does not match this parcel and media type." }, { status: 400 });
    }
  }

  const key = `uploads/${user.userId}/${parcelId}/${crypto.randomUUID()}`;
  try {
    const upload = await env.BUCKET.createMultipartUpload(key, { httpMetadata: { contentType: media.mimeType } });
    return Response.json({ key, uploadId: upload.uploadId, partSize: 8 * 1024 * 1024 });
  } catch {
    return Response.json({ error: "Could not start the upload. Try again." }, { status: 500 });
  }
}
