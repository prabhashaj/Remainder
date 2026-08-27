import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Lock, Mail, User } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { RemispaceBrand } from "@/components/brand";
import { supabase } from "@/integrations/supabase/client";

type AuthMode = "signin" | "signup" | "forgot";
type AuthSearch = { mode?: "signin" | "signup" };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    mode: search["mode"] === "signup" ? "signup" : "signin",
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
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [tab, setTab] = useState<AuthMode>(search.mode === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sentConfirmation, setSentConfirmation] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  useEffect(() => {
    if (search.mode) {
      setTab(search.mode === "signup" ? "signup" : "signin");
    }
  }, [search.mode]);

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
    if (!email || !password) {
      toast.error("Please provide both email and password.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      toast.error(error.message || "Failed to sign in. Please verify your credentials.");
    }
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all required fields.");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: window.location.origin, data: { full_name: name.trim() } },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message || "Unable to register account. Please try again.");
      return;
    }
    if (!data.session) {
      setSentConfirmation(true);
      toast.success("Check your email to confirm your account.");
    }
  }

  async function forgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email address.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth?mode=signin`,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message || "Unable to send reset email.");
    } else {
      setResetEmailSent(true);
      toast.success("Password reset instructions sent to your email.");
    }
  }

  async function google() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth` },
    });
    if (error) {
      setBusy(false);
      toast.error("Google sign-in failed. Please try again.");
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#06140e] text-zinc-100 px-4 py-12 selection:bg-emerald-500/30 font-sans overflow-hidden">
      {/* Dynamic Background Mesh Gradients */}
      <div className="pointer-events-none absolute -top-40 -left-40 size-[500px] rounded-full bg-emerald-600/15 blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 size-[500px] rounded-full bg-teal-500/15 blur-[140px]" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[650px] rounded-full bg-emerald-400/5 blur-[160px]" />

      {/* Subtle Dot Grid Overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #34d399 1px, transparent 0)`,
          backgroundSize: "32px 32px",
        }}
      />

      {/* Back to Home Button */}
      <Link
        to="/"
        className="group absolute left-4 top-4 sm:left-8 sm:top-8 flex items-center gap-2 rounded-full border border-emerald-500/20 bg-[#0c2419]/80 px-4 py-2 text-xs sm:text-sm font-medium text-zinc-300 shadow-sm backdrop-blur-md transition-all duration-200 hover:border-emerald-400/50 hover:bg-[#123626] hover:text-white z-20"
      >
        <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5 text-emerald-400" />
        <span>Back to home</span>
      </Link>

      <div className="relative w-full max-w-[440px] z-10 my-auto">
        {/* Brand Header */}
        <div className="mb-6 flex items-center justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center transition-transform hover:opacity-90 group"
          >
            <RemispaceBrand size="lg" className="text-white" iconClassName="group-hover:scale-110" />
          </Link>
        </div>

        {/* Auth Card */}
        <div className="relative rounded-3xl border border-emerald-500/20 bg-[#082216]/90 p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl transition-all">
          {sentConfirmation ? (
            <div className="space-y-4 text-center py-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="mx-auto size-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="size-7 text-emerald-400" />
              </div>
              <h2 className="font-display text-xl font-bold text-white">Check your email</h2>
              <p className="text-sm leading-relaxed text-zinc-300">
                We sent a confirmation link to <span className="font-semibold text-emerald-300">{email}</span>. Click
                the link to activate your account and start learning.
              </p>
              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setSentConfirmation(false);
                    setTab("signin");
                  }}
                  className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-zinc-950 hover:bg-emerald-400 transition-colors shadow-sm cursor-pointer"
                >
                  Return to sign in
                </button>
              </div>
            </div>
          ) : resetEmailSent ? (
            <div className="space-y-4 text-center py-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="mx-auto size-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shadow-lg shadow-emerald-500/10">
                <Mail className="size-7 text-emerald-400" />
              </div>
              <h2 className="font-display text-xl font-bold text-white">Password reset link sent</h2>
              <p className="text-sm leading-relaxed text-zinc-300">
                If an account exists for <span className="font-semibold text-emerald-300">{email}</span>, you will
                receive instructions shortly.
              </p>
              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setResetEmailSent(false);
                    setTab("signin");
                  }}
                  className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-zinc-950 hover:bg-emerald-400 transition-colors shadow-sm cursor-pointer"
                >
                  Back to Sign In
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Segmented Switcher (Sign in / Create Account) */}
              {tab !== "forgot" ? (
                <div className="grid grid-cols-2 rounded-2xl bg-[#04170e] p-1.5 border border-emerald-500/20 mb-6 shadow-inner">
                  <button
                    type="button"
                    onClick={() => setTab("signin")}
                    className={`rounded-xl py-2.5 text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                      tab === "signin"
                        ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/50 font-bold border border-emerald-400/30"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("signup")}
                    className={`rounded-xl py-2.5 text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                      tab === "signup"
                        ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/50 font-bold border border-emerald-400/30"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Create Account
                  </button>
                </div>
              ) : (
                <div className="mb-6 flex items-center justify-between border-b border-emerald-500/20 pb-4">
                  <div className="flex items-center gap-2 text-white font-semibold text-base">
                    <KeyRound className="size-4 text-emerald-400" />
                    <span>Reset Password</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTab("signin")}
                    className="text-xs text-emerald-400 hover:text-emerald-300 underline underline-offset-4 cursor-pointer"
                  >
                    Back to Sign In
                  </button>
                </div>
              )}

              {/* Sign In Form */}
              {tab === "signin" && (
                <form onSubmit={signIn} className="space-y-4 animate-in fade-in duration-150">
                  <div className="space-y-1.5">
                    <label htmlFor="signin-email" className="block text-xs font-semibold text-zinc-200">
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
                        <Mail className="size-4" />
                      </div>
                      <input
                        id="signin-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full h-11 rounded-xl border border-emerald-500/25 bg-[#03150d] pl-10 pr-3.5 text-sm text-white placeholder:text-zinc-500 transition-all hover:border-emerald-500/40 focus:border-emerald-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-400/30"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="signin-password" className="block text-xs font-semibold text-zinc-200">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => setTab("forgot")}
                        className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
                        <Lock className="size-4" />
                      </div>
                      <input
                        id="signin-password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full h-11 rounded-xl border border-emerald-500/25 bg-[#03150d] pl-10 pr-10 text-sm text-white placeholder:text-zinc-500 transition-all hover:border-emerald-500/40 focus:border-emerald-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-400/30"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full h-11.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm shadow-lg shadow-emerald-500/25 transition-all duration-150 active:scale-[0.99] disabled:opacity-60 cursor-pointer mt-3 flex items-center justify-center gap-2"
                  >
                    {busy ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        <span>Signing in…</span>
                      </>
                    ) : (
                      "Sign In to Workspace"
                    )}
                  </button>
                </form>
              )}

              {/* Sign Up Form */}
              {tab === "signup" && (
                <form onSubmit={signUp} className="space-y-4 animate-in fade-in duration-150">
                  <div className="space-y-1.5">
                    <label htmlFor="signup-name" className="block text-xs font-semibold text-zinc-200">
                      Full Name
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
                        <User className="size-4" />
                      </div>
                      <input
                        id="signup-name"
                        name="name"
                        type="text"
                        autoComplete="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Marie Curie"
                        className="w-full h-11 rounded-xl border border-emerald-500/25 bg-[#03150d] pl-10 pr-3.5 text-sm text-white placeholder:text-zinc-500 transition-all hover:border-emerald-500/40 focus:border-emerald-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-400/30"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="signup-email" className="block text-xs font-semibold text-zinc-200">
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
                        <Mail className="size-4" />
                      </div>
                      <input
                        id="signup-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full h-11 rounded-xl border border-emerald-500/25 bg-[#03150d] pl-10 pr-3.5 text-sm text-white placeholder:text-zinc-500 transition-all hover:border-emerald-500/40 focus:border-emerald-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-400/30"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="signup-password" className="block text-xs font-semibold text-zinc-200">
                        Password
                      </label>
                      <span className="text-[11px] text-zinc-400">min 6 chars</span>
                    </div>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
                        <Lock className="size-4" />
                      </div>
                      <input
                        id="signup-password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Create a strong password"
                        className="w-full h-11 rounded-xl border border-emerald-500/25 bg-[#03150d] pl-10 pr-10 text-sm text-white placeholder:text-zinc-500 transition-all hover:border-emerald-500/40 focus:border-emerald-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-400/30"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full h-11.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm shadow-lg shadow-emerald-500/25 transition-all duration-150 active:scale-[0.99] disabled:opacity-60 cursor-pointer mt-3 flex items-center justify-center gap-2"
                  >
                    {busy ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        <span>Creating account…</span>
                      </>
                    ) : (
                      "Create My Free Workspace"
                    )}
                  </button>
                </form>
              )}

              {/* Forgot Password Form */}
              {tab === "forgot" && (
                <form onSubmit={forgotPassword} className="space-y-4 animate-in fade-in duration-150">
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Enter the email associated with your account and we’ll send you a password reset link.
                  </p>
                  <div className="space-y-1.5">
                    <label htmlFor="reset-email" className="block text-xs font-semibold text-zinc-200">
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
                        <Mail className="size-4" />
                      </div>
                      <input
                        id="reset-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full h-11 rounded-xl border border-emerald-500/25 bg-[#03150d] pl-10 pr-3.5 text-sm text-white placeholder:text-zinc-500 transition-all hover:border-emerald-500/40 focus:border-emerald-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-400/30"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full h-11.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-sm shadow-lg shadow-emerald-500/25 transition-all duration-150 active:scale-[0.99] disabled:opacity-60 cursor-pointer mt-3 flex items-center justify-center gap-2"
                  >
                    {busy ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        <span>Sending reset link…</span>
                      </>
                    ) : (
                      "Send Reset Link"
                    )}
                  </button>
                </form>
              )}

              {/* Divider for Social Logins (only in signin/signup) */}
              {tab !== "forgot" && (
                <>
                  <div className="my-5 flex items-center gap-3 text-xs text-zinc-400">
                    <span className="h-px flex-1 bg-emerald-500/20" />
                    <span className="text-[11px] font-medium tracking-wider uppercase text-zinc-400">Or continue with</span>
                    <span className="h-px flex-1 bg-emerald-500/20" />
                  </div>

                  {/* Google Button */}
                  <button
                    type="button"
                    onClick={google}
                    disabled={busy}
                    className="w-full h-11.5 rounded-xl border border-emerald-500/30 bg-[#092b1d] hover:bg-[#0e3b28] hover:border-emerald-400/60 text-zinc-100 text-xs sm:text-sm font-semibold transition-all duration-150 flex items-center justify-center gap-3 active:scale-[0.99] cursor-pointer shadow-md shadow-black/20"
                  >
                    <svg className="size-4.5" viewBox="0 0 24 24">
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
                    <span>Google Account</span>
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
