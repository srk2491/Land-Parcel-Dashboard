import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

type MediaRow = { object_key: string; file_name: string; mime_type: string; size_bytes: number };

async function findMedia(id: string) {
  if (!env.DB || !env.BUCKET) return null;
  return env.DB.prepare("SELECT object_key, file_name, mime_type, size_bytes FROM parcel_media WHERE id = ?").bind(id).first<MediaRow>();
}

function responseHeaders(media: MediaRow) {
  const headers = new Headers();
  headers.set("Content-Type", media.mime_type);
  headers.set("Content-Disposition", `inline; filename="${media.file_name.replace(/["\\\r\n]/g, "_")}"`);
  headers.set("Cache-Control", "public, max-age=3600");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Accept-Ranges", "bytes");
  return headers;
}

export async function HEAD(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!env.BUCKET) return new Response(null, { status: 503 });
  const { id } = await context.params;
  const media = await findMedia(id);
  if (!media) return new Response(null, { status: 404 });
  const object = await env.BUCKET.head(media.object_key);
  if (!object) return new Response(null, { status: 404 });
  const headers = responseHeaders(media);
  headers.set("Content-Length", String(object.size));
  return new Response(null, { headers });
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!env.DB || !env.BUCKET) return new Response("Media storage is not configured.", { status: 503 });
  const { id } = await context.params;
  const media = await findMedia(id);
  if (!media) return new Response("Media item not found.", { status: 404 });
  const rangeHeader = request.headers.get("range");
  const object = await env.BUCKET.get(media.object_key, rangeHeader ? { range: request.headers } : undefined);
  if (!object || !object.body) return new Response("Media file not found.", { status: 404 });
  const headers = responseHeaders(media);
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", media.mime_type);
  if (object.range) {
    const start = object.range.offset ?? Math.max(0, object.size - (object.range.suffix ?? 0));
    const length = object.range.length ?? Math.min(object.range.suffix ?? object.size, object.size);
    headers.set("Content-Range", `bytes ${start}-${start + length - 1}/${object.size}`);
    headers.set("Content-Length", String(length));
    return new Response(object.body, { status: 206, headers });
  }
  headers.set("Content-Length", String(object.size));
  return new Response(object.body, { headers });
}
