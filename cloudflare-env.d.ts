declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    DB_PROVIDER?: string;
    SUPABASE_URL?: string;
    SUPABASE_SECRET_KEY?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
    ROOT_ADMIN_ID?: string;
  }
}
