import { env } from "cloudflare:workers";
import { getMediaAdmin } from "../../../../lib/media-auth";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getMediaAdmin();
  if (!user) return Response.json({ error: "Not authorized." }, { status: 403 });
  if (!env.DB || !env.BUCKET) return Response.json({ error: "Media storage is not configured." }, { status: 503 });
  const { id } = await context.params;
  const media = await env.DB.prepare("SELECT object_key FROM parcel_media WHERE id = ?").bind(id).first<{ object_key: string }>();
  if (!media) return Response.json({ error: "Media item not found." }, { status: 404 });
  await env.BUCKET.delete(media.object_key);
  await env.DB.prepare("DELETE FROM parcel_media WHERE id = ?").bind(id).run();
  return Response.json({ ok: true });
}
