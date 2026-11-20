import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const parcelMedia = sqliteTable("parcel_media", {
  id: text("id").primaryKey(),
  parcelId: integer("parcel_id").notNull(),
  mediaType: text("media_type", { enum: ["image", "video"] }).notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  objectKey: text("object_key").notNull().unique(),
  uploadedBy: text("uploaded_by").notNull(),
  uploadedAt: text("uploaded_at").notNull(),
});
