CREATE TABLE `parcel_media` (
	`id` text PRIMARY KEY NOT NULL,
	`parcel_id` integer NOT NULL,
	`media_type` text NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`object_key` text NOT NULL,
	`uploaded_by` text NOT NULL,
	`uploaded_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `parcel_media_object_key_unique` ON `parcel_media` (`object_key`);