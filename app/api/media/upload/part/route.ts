import { env } from "cloudflare:workers";
import { getMediaAdmin } from "../../../../../lib/media-auth";
import { PART_BYTES } from "../../../../../lib/media-validation";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const user = await getMediaAdmin();
  if (!user) return Response.json({ error: "Not authorized." }, { status: 403 });
  if (!env.BUCKET) return Response.json({ error: "Media storage is not configured." }, { status: 503 });
  const url = new URL(request.url);
  const key = url.searchParams.get("key") ?? "";
  const uploadId = url.searchParams.get("uploadId") ?? "";
  const partNumber = Number(url.searchParams.get("partNumber"));
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (!key.startsWith(`uploads/${user.userId}/`) || !uploadId || !Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000 || !request.body || contentLength > PART_BYTES) {
    return Response.json({ error: "Invalid upload part." }, { status: 400 });
  }
  try {
    const part = await env.BUCKET.resumeMultipartUpload(key, uploadId).uploadPart(partNumber, request.body);
    return Response.json({ partNumber, etag: part.etag });
  } catch {
    return Response.json({ error: "A file part failed to upload. Retry the upload." }, { status: 500 });
  }
}
