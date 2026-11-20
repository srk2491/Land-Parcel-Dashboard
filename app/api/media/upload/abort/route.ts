import { env } from "cloudflare:workers";
import { getMediaAdmin } from "../../../../../lib/media-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getMediaAdmin();
  if (!user) return Response.json({ error: "Not authorized." }, { status: 403 });
  if (!env.BUCKET) return Response.json({ ok: true });
  try {
    const body = await request.json() as { key?: string; uploadId?: string };
    const key = body.key ?? "";
    const uploadId = body.uploadId ?? "";
    if (key.startsWith(`uploads/${user.userId}/`) && uploadId) {
      await env.BUCKET.resumeMultipartUpload(key, uploadId).abort();
    }
  } catch { /* The upload may already have expired or completed. */ }
  return Response.json({ ok: true });
}
