"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState<"google" | "credentials" | null>(null);
  const [error, setError] = useState<string | null>(
    errorParam === "CredentialsSignin" ? "Invalid email or password." : null
  );

  async function handleGoogle() {
    setLoading("google");
    setError(null);
    await signIn("google", { callbackUrl });
  }

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setLoading("credentials");
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password.");
      setLoading(null);
    } else {
      router.push(callbackUrl);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-2xl border border-[#2e2e2e] bg-[#181818] p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="mt-1 text-sm text-[#9a9a9a]">Sign in to your account</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Google */}
        <Button
          type="button"
          variant="outline"
          className="mb-4 w-full gap-2 border-[#2e2e2e] bg-transparent text-white hover:bg-[#2e2e2e]"
          onClick={handleGoogle}
          disabled={loading !== null}
        >
          {loading === "google" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          )}
          Continue with Google
        </Button>

        {/* Divider */}
        <div className="mb-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-[#2e2e2e]" />
          <span className="text-xs text-[#9a9a9a]">or</span>
          <div className="h-px flex-1 bg-[#2e2e2e]" />
        </div>

        {/* Credentials form */}
        <form onSubmit={handleCredentials} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-[#9a9a9a]">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-[#2e2e2e] bg-[#0c0c0c] px-4 py-2.5 text-sm text-white placeholder:text-[#9a9a9a] outline-none focus:border-[#c4956a] transition-colors"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-[#9a9a9a]">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-[#2e2e2e] bg-[#0c0c0c] px-4 py-2.5 text-sm text-white placeholder:text-[#9a9a9a] outline-none focus:border-[#c4956a] transition-colors"
            />
          </div>

          <Button type="submit" className="w-full gap-2" disabled={loading !== null}>
            {loading === "credentials" && <Loader2 className="h-4 w-4 animate-spin" />}
            Sign in
          </Button>
        </form>

        {/* Sign up link */}
        <p className="mt-6 text-center text-sm text-[#9a9a9a]">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium text-[#c4956a] hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
