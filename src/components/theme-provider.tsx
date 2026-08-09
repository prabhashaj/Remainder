import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { applyThemeClass, isThemeId, THEME_STORAGE_KEY, type ThemeId } from "@/lib/themes";

type ThemeContextValue = {
  theme: ThemeId;
  /** Applies instantly (live preview) without persisting. */
  previewTheme: (theme: ThemeId) => void;
  /** Applies and persists to the signed-in profile. */
  setTheme: (theme: ThemeId) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): ThemeId {
  if (typeof window === "undefined") return "blush";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isThemeId(stored) ? stored : "blush";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("blush");

  // Hydrate from this browser first (instant), then reconcile with the profile.
  useEffect(() => {
    const localTheme = readStoredTheme();
    setThemeState(localTheme);
    applyThemeClass(localTheme);

    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;
      if (!userId || cancelled) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("theme")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled || !profile || !isThemeId(profile.theme)) return;
      setThemeState(profile.theme);
      applyThemeClass(profile.theme);
      window.localStorage.setItem(THEME_STORAGE_KEY, profile.theme);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const previewTheme = useCallback((next: ThemeId) => {
    setThemeState(next);
    applyThemeClass(next);
  }, []);

  const setTheme = useCallback(
    (next: ThemeId) => {
      previewTheme(next);
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
      void (async () => {
        const { data } = await supabase.auth.getSession();
        const userId = data.session?.user.id;
        if (!userId) return;
        await supabase.from("profiles").update({ theme: next }).eq("id", userId);
      })();
    },
    [previewTheme],
  );

  const value = useMemo(() => ({ theme, previewTheme, setTheme }), [theme, previewTheme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
