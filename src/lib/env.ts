/**
 * Runtime environment variable validation.
 * Import this at the top of any server-side entry point to fail fast with a
 * clear error message rather than a cryptic runtime crash.
 *
 * Usage:
 *   import "@/lib/env";   // side-effect import — validates on first load
 */

type EnvVar = {
  key:      string;
  required: boolean;
  hint?:    string;
};

const vars: EnvVar[] = [
  // Auth
  { key: "AUTH_SECRET",          required: true,  hint: "Run: openssl rand -base64 32" },
  { key: "NEXTAUTH_URL",         required: true,  hint: "e.g. https://your-domain.vercel.app" },
  // Database
  { key: "DATABASE_URL",         required: true,  hint: "Neon PostgreSQL connection string" },
  // Encryption
  { key: "ENCRYPTION_KEY",       required: true,  hint: "32-byte hex key: openssl rand -hex 32" },
  // Google OAuth (required for login + calendar)
  { key: "GOOGLE_CLIENT_ID",     required: true,  hint: "Google Cloud Console → Credentials" },
  { key: "GOOGLE_CLIENT_SECRET", required: true,  hint: "Google Cloud Console → Credentials" },
  // Email (optional — emails are non-fatal when missing)
  { key: "EMAIL_USER",           required: false, hint: "Gmail address for outbound email" },
  { key: "EMAIL_PASS",           required: false, hint: "Gmail App Password" },
  // Zoom (optional)
  { key: "ZOOM_CLIENT_ID",       required: false, hint: "Zoom app credentials" },
  { key: "ZOOM_CLIENT_SECRET",   required: false, hint: "Zoom app credentials" },
  // Teams (optional)
  { key: "MICROSOFT_CLIENT_ID",     required: false },
  { key: "MICROSOFT_CLIENT_SECRET", required: false },
  { key: "MICROSOFT_TENANT_ID",     required: false },
  // App URL
  { key: "NEXT_PUBLIC_APP_URL",  required: false, hint: "Public-facing base URL" },
];

const missing = vars
  .filter((v) => v.required && !process.env[v.key])
  .map((v) => `  • ${v.key}${v.hint ? `  →  ${v.hint}` : ""}`);

if (missing.length > 0) {
  console.error(
    "\n❌ Missing required environment variables:\n" +
    missing.join("\n") +
    "\n\nSet them in .env (local) or Vercel project settings (production).\n",
  );
  // In production throw hard; in dev just warn so hot-reload still works
  if (process.env.NODE_ENV === "production") {
    throw new Error("Missing required environment variables. See server log.");
  }
}
