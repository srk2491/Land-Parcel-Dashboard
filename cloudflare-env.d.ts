declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    MEDIA_ADMIN_USER_IDS?: string;
  }
}
