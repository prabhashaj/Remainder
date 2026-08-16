import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import remiLogo from "@/assets/remi.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentConfirmation, setSentConfirmation] = useState(false);

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
    <main className="flex min-h-screen items-center justify-center bg-[#021810] text-[#f4f4f5] px-4 py-12 relative selection:bg-emerald-500/30 font-sans">
      <Link
        to="/"
        className="absolute left-6 top-6 flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="size-4" />
        Back to home
      </Link>
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2.5">
          <img
            src={remiLogo}
            alt="Remispace"
            width={44}
            height={44}
            className="size-11 rounded-xl object-cover shadow-xs"
          />
          <span className="font-display text-2xl font-bold text-white tracking-tight">Remispace</span>
        </Link>

        <div className="rounded-3xl border border-[#0d402e] bg-[#042419] p-8 shadow-2xl">
          {sentConfirmation ? (
            <div className="space-y-3 text-center">
              <h1 className="font-display text-xl font-bold text-white">One last step</h1>
              <p className="text-sm leading-relaxed text-zinc-300">
                We sent a confirmation link to <span className="font-semibold text-emerald-400">{email}</span>. Open it
                and you'll land right in your workspace.
              </p>
            </div>
          ) : (
            <Tabs defaultValue={mode === "signin" ? "signin" : "signup"}>
              <TabsList className="grid w-full grid-cols-2 rounded-2xl bg-[#021810] p-1 border border-[#0d402e]">
                <TabsTrigger
                  value="signup"
                  className="rounded-xl py-2.5 text-xs font-semibold data-[state=active]:bg-emerald-500 data-[state=active]:text-black data-[state=active]:font-bold data-[state=inactive]:text-zinc-400 data-[state=inactive]:hover:text-white transition-all"
                >
                  Create account
                </TabsTrigger>
                <TabsTrigger
                  value="signin"
                  className="rounded-xl py-2.5 text-xs font-semibold data-[state=active]:bg-emerald-500 data-[state=active]:text-black data-[state=active]:font-bold data-[state=inactive]:text-zinc-400 data-[state=inactive]:hover:text-white transition-all"
                >
                  Sign in
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signup" className="mt-6">
                <form onSubmit={signUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label
                      htmlFor="name"
                      className="text-xs font-semibold uppercase tracking-wider text-emerald-400"
                    >
                      What should Remi call you?
                    </Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ada"
                      className="rounded-2xl border-[#0d402e] bg-[#021810] text-white placeholder:text-zinc-600 focus-visible:ring-emerald-500 focus-visible:border-emerald-500"
                    />
                  </div>
                  <EmailPassword
                    email={email}
                    password={password}
                    setEmail={setEmail}
                    setPassword={setPassword}
                  />
                  <Button
                    type="submit"
                    disabled={busy}
                    className="press w-full rounded-2xl bg-emerald-500 py-3 text-sm font-bold text-black shadow-lg shadow-emerald-500/10 hover:bg-emerald-400 transition-all"
                  >
                    {busy ? "Creating…" : "Create my workspace"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signin" className="mt-6">
                <form onSubmit={signIn} className="space-y-4">
                  <EmailPassword
                    email={email}
                    password={password}
                    setEmail={setEmail}
                    setPassword={setPassword}
                  />
                  <Button
                    type="submit"
                    disabled={busy}
                    className="press w-full rounded-2xl bg-emerald-500 py-3 text-sm font-bold text-black shadow-lg shadow-emerald-500/10 hover:bg-emerald-400 transition-all"
                  >
                    {busy ? "Signing in…" : "Sign in"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}

          {!sentConfirmation && (
            <>
              <div className="my-6 flex items-center gap-3 text-xs text-zinc-500">
                <span className="h-px flex-1 bg-[#0d402e]" />
                or
                <span className="h-px flex-1 bg-[#0d402e]" />
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={google}
                className="press w-full rounded-2xl border border-[#0d402e] bg-[#062b1e] py-3 text-sm font-semibold text-zinc-200 hover:bg-[#093828] hover:text-white transition-colors"
              >
                Continue with Google
              </Button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function EmailPassword({
  email,
  password,
  setEmail,
  setPassword,
}: {
  email: string;
  password: string;
  setEmail: (v: string) => void;
  setPassword: (v: string) => void;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label
          htmlFor="email"
          className="text-xs font-semibold uppercase tracking-wider text-emerald-400"
        >
          Email
        </Label>
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="rounded-2xl border-[#0d402e] bg-[#021810] text-white placeholder:text-zinc-600 focus-visible:ring-emerald-500 focus-visible:border-emerald-500"
        />
      </div>
      <div className="space-y-2">
        <Label
          htmlFor="password"
          className="text-xs font-semibold uppercase tracking-wider text-emerald-400"
        >
          Password
        </Label>
        <Input
          id="password"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="rounded-2xl border-[#0d402e] bg-[#021810] text-white placeholder:text-zinc-600 focus-visible:ring-emerald-500 focus-visible:border-emerald-500"
        />
      </div>
    </>
  );
}
