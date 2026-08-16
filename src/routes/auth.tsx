import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import remiLogo from "@/assets/remi.png";
import { supabase } from "@/integrations/supabase/client";

type AuthSearch = { mode: "signin" | "signup" };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    mode: search["mode"] === "signin" ? "signin" : "signup",
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Remispace" },
      {
        name: "description",
        content: "Sign in to your Remispace workspace and continue learning.",
      },
      { property: "og:title", content: "Sign in — Remispace" },
      {
        property: "og:description",
        content: "Sign in to your calm workspace and AI learning coach.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode: initialMode } = Route.useSearch();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"signin" | "signup">(initialMode === "signin" ? "signin" : "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentConfirmation, setSentConfirmation] = useState(false);

  useEffect(() => {
    setTab(initialMode === "signin" ? "signin" : "signup");
  }, [initialMode]);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: "/dashboard", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message);
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data.session) {
      setSentConfirmation(true);
      toast.success("Check your email to confirm your account.");
    }
  }

  async function google() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth` },
    });
    if (error) {
      toast.error("Google sign-in failed. Please try again.");
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#021810] text-[#f4f4f5] px-4 py-12 selection:bg-emerald-500/30 font-sans overflow-hidden">
      {/* Subtle Background Ambience */}
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[600px] rounded-full bg-emerald-500/10 blur-[130px]" />

      {/* Back Link */}
      <Link
        to="/"
        className="absolute left-6 top-6 flex items-center gap-2 text-xs sm:text-sm font-medium text-zinc-400 hover:text-emerald-400 transition-colors z-10"
      >
        <ArrowLeft className="size-4" />
        Back to home
      </Link>

      <div className="relative w-full max-w-[420px] z-10">
        {/* Brand Header */}
        <Link to="/" className="mb-6 flex flex-col items-center justify-center gap-3 group">
          <img
            src={remiLogo}
            alt="Remispace"
            width={48}
            height={48}
            className="size-12 rounded-2xl object-cover ring-1 ring-emerald-500/30 shadow-lg shadow-emerald-950/50 group-hover:ring-emerald-400/50 transition-all"
          />
          <div className="text-center">
            <span className="font-display text-2xl font-bold tracking-tight text-white block">Remispace</span>
            <p className="text-xs text-zinc-400 mt-0.5">Your quiet sanctuary for deep learning</p>
          </div>
        </Link>

        {/* Auth Card */}
        <div className="relative rounded-3xl border border-[#0d402e] bg-[#042419]/95 p-7 sm:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          {sentConfirmation ? (
            <div className="space-y-4 text-center py-4">
              <div className="mx-auto size-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xl font-bold">
                ✓
              </div>
              <h1 className="font-display text-xl font-bold text-white">Check your inbox</h1>
              <p className="text-sm leading-relaxed text-zinc-300">
                We sent a confirmation link to <span className="font-semibold text-emerald-400">{email}</span>. Open it to access your workspace.
              </p>
              <button
                type="button"
                onClick={() => setSentConfirmation(false)}
                className="mt-4 text-xs text-zinc-400 hover:text-white underline underline-offset-4 transition-colors"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              {/* Segmented Tab Switcher */}
              <div className="grid grid-cols-2 rounded-2xl bg-[#021810] p-1 border border-[#0d402e]/90 mb-6">
                <button
                  type="button"
                  onClick={() => setTab("signup")}
                  className={`rounded-xl py-2 text-xs font-semibold transition-all duration-150 ${
                    tab === "signup"
                      ? "bg-[#062f21] text-emerald-300 border border-emerald-500/30 shadow-xs font-bold"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Create account
                </button>
                <button
                  type="button"
                  onClick={() => setTab("signin")}
                  className={`rounded-xl py-2 text-xs font-semibold transition-all duration-150 ${
                    tab === "signin"
                      ? "bg-[#062f21] text-emerald-300 border border-emerald-500/30 shadow-xs font-bold"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Sign in
                </button>
              </div>

              {/* Form Content */}
              {tab === "signup" ? (
                <form onSubmit={signUp} className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="name" className="text-xs font-medium text-zinc-300">
                      Your name
                    </label>
                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Marie Curie"
                      className="w-full h-11 rounded-xl border border-[#0d402e] bg-[#021810] px-3.5 text-sm text-white placeholder:text-zinc-600 transition-all hover:border-[#13573e] focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="signup-email" className="text-xs font-medium text-zinc-300">
                      Email address
                    </label>
                    <input
                      id="signup-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full h-11 rounded-xl border border-[#0d402e] bg-[#021810] px-3.5 text-sm text-white placeholder:text-zinc-600 transition-all hover:border-[#13573e] focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="signup-password" className="text-xs font-medium text-zinc-300">
                      Password <span className="text-zinc-500 font-normal">(min 6 characters)</span>
                    </label>
                    <input
                      id="signup-password"
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-11 rounded-xl border border-[#0d402e] bg-[#021810] px-3.5 text-sm text-white placeholder:text-zinc-600 transition-all hover:border-[#13573e] focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full h-11 rounded-xl bg-emerald-500 text-black font-bold text-sm shadow-md shadow-emerald-500/20 hover:bg-emerald-400 hover:shadow-emerald-500/30 transition-all duration-150 active:scale-[0.99] disabled:opacity-50 cursor-pointer mt-2"
                  >
                    {busy ? "Creating account…" : "Create my workspace"}
                  </button>
                </form>
              ) : (
                <form onSubmit={signIn} className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="signin-email" className="text-xs font-medium text-zinc-300">
                      Email address
                    </label>
                    <input
                      id="signin-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full h-11 rounded-xl border border-[#0d402e] bg-[#021810] px-3.5 text-sm text-white placeholder:text-zinc-600 transition-all hover:border-[#13573e] focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="signin-password" className="text-xs font-medium text-zinc-300">
                      Password
                    </label>
                    <input
                      id="signin-password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-11 rounded-xl border border-[#0d402e] bg-[#021810] px-3.5 text-sm text-white placeholder:text-zinc-600 transition-all hover:border-[#13573e] focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full h-11 rounded-xl bg-emerald-500 text-black font-bold text-sm shadow-md shadow-emerald-500/20 hover:bg-emerald-400 hover:shadow-emerald-500/30 transition-all duration-150 active:scale-[0.99] disabled:opacity-50 cursor-pointer mt-2"
                  >
                    {busy ? "Signing in…" : "Sign in to workspace"}
                  </button>
                </form>
              )}

              {/* Or Divider */}
              <div className="my-5 flex items-center gap-3 text-xs text-zinc-500">
                <span className="h-px flex-1 bg-[#0d402e]" />
                <span>or</span>
                <span className="h-px flex-1 bg-[#0d402e]" />
              </div>

              {/* Google Button */}
              <button
                type="button"
                onClick={google}
                className="w-full h-11 rounded-xl border border-[#0d402e] bg-[#062b1e] text-zinc-200 hover:bg-[#093828] hover:text-white hover:border-emerald-500/40 text-xs sm:text-sm font-semibold transition-all duration-150 flex items-center justify-center gap-2.5 active:scale-[0.99] cursor-pointer shadow-xs"
              >
                <svg className="size-4" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12 0 14.5s.7 4.8 1.9 7.2l3.7-2.9z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16.5C3.7 20.2 7.5 23.5 12 23.5z"
                  />
                </svg>
                Continue with Google
              </button>
            </>
          )}
        </div>

        {/* Footer Note */}
        <p className="mt-6 text-center text-xs text-zinc-500">
          By continuing, you agree to Remispace's calm learning terms.
        </p>
      </div>
    </main>
  );
}
