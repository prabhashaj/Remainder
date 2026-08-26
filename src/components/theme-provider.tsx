import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  applyThemeClass,
  isThemeId,
  THEME_STORAGE_KEY,
  type ThemeId,
  applyFontClass,
  isFontId,
  FONT_STORAGE_KEY,
  type FontId,
} from "@/lib/themes";

type ThemeContextValue = {
  theme: ThemeId;
  font: FontId;
  /** Applies instantly (live preview) without persisting. */
  previewTheme: (theme: ThemeId) => void;
  /** Applies instantly (live preview) without persisting. */
  previewFont: (font: FontId) => void;
  /** Applies and persists to the signed-in profile. */
  setTheme: (theme: ThemeId) => void;
  /** Applies and persists to the signed-in profile. */
  setFont: (font: FontId) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): ThemeId {
  if (typeof window === "undefined") return "blush";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isThemeId(stored) ? stored : "blush";
}

function readStoredFont(): FontId {
  if (typeof window === "undefined") return "roboto";
  const stored = window.localStorage.getItem(FONT_STORAGE_KEY);
  return isFontId(stored) ? stored : "roboto";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("blush");
  const [font, setFontState] = useState<FontId>("roboto");

  // Hydrate from this browser first (instant), then reconcile with the profile.
  useEffect(() => {
    const localTheme = readStoredTheme();
    const localFont = readStoredFont();
    setThemeState(localTheme);
    setFontState(localFont);
    applyThemeClass(localTheme);
    applyFontClass(localFont);

    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;
      if (!userId || cancelled) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("theme, font")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled || !profile) return;

      if (isThemeId(profile.theme)) {
        setThemeState(profile.theme);
        applyThemeClass(profile.theme);
        window.localStorage.setItem(THEME_STORAGE_KEY, profile.theme);
      }

      if (isFontId(profile.font)) {
        setFontState(profile.font);
        applyFontClass(profile.font);
        window.localStorage.setItem(FONT_STORAGE_KEY, profile.font);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const previewTheme = useCallback((next: ThemeId) => {
    setThemeState(next);
    applyThemeClass(next);
  }, []);

  const previewFont = useCallback((next: FontId) => {
    setFontState(next);
    applyFontClass(next);
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

  const setFont = useCallback(
    (next: FontId) => {
      previewFont(next);
      window.localStorage.setItem(FONT_STORAGE_KEY, next);
      void (async () => {
        const { data } = await supabase.auth.getSession();
        const userId = data.session?.user.id;
        if (!userId) return;
        await supabase.from("profiles").update({ font: next }).eq("id", userId);
      })();
    },
    [previewFont],
  );

  const value = useMemo(
    () => ({ theme, font, previewTheme, previewFont, setTheme, setFont }),
    [theme, font, previewTheme, previewFont, setTheme, setFont],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
