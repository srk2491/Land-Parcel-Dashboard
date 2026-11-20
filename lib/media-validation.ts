export const MAX_FILE_BYTES = 1024 * 1024 * 1024;
export const PART_BYTES = 8 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm"]);

export function inferMedia(filename: string, mimeType: string) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const normalizedMime = mimeType.toLowerCase() || MIME_BY_EXTENSION[ext] || "";
  if (ALLOWED_IMAGE_TYPES.has(normalizedMime)) return { mediaType: "image" as const, mimeType: normalizedMime };
  if (ALLOWED_VIDEO_TYPES.has(normalizedMime)) return { mediaType: "video" as const, mimeType: normalizedMime };
  return null;
}

export function safeFileName(value: string) {
  const normalized = value.normalize("NFKC").replace(/[\\/\r\n\0]/g, "_").trim().slice(0, 180);
  return normalized || "parcel-media";
}

export function validParcelId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id >= 1 && id <= 79 ? id : null;
}
