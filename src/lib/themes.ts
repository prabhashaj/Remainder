export type ThemeId =
  | "blush"
  | "sage"
  | "lavender"
  | "sky"
  | "peach"
  | "sand"
  | "mint"
  | "lilac"
  | "butter"
  | "cloud"
  | "midnight"
  | "emerald"
  | "velvet";

export type ThemeDef = {
  id: ThemeId;
  name: string;
  blurb: string;
  swatches: string[];
  isDark?: boolean;
};

export const THEMES: ThemeDef[] = [
  {
    id: "blush",
    name: "Blush",
    blurb: "Soft pink + cream",
    swatches: ["oklch(0.985 0.012 40)", "oklch(0.93 0.04 15)", "oklch(0.72 0.13 8)"],
  },
  {
    id: "sage",
    name: "Sage",
    blurb: "Muted green + off-white",
    swatches: ["oklch(0.985 0.012 140)", "oklch(0.92 0.04 150)", "oklch(0.6 0.08 150)"],
  },
  {
    id: "lavender",
    name: "Lavender Mist",
    blurb: "Light purple + white",
    swatches: ["oklch(0.985 0.012 300)", "oklch(0.92 0.045 300)", "oklch(0.65 0.13 300)"],
  },
  {
    id: "sky",
    name: "Sky",
    blurb: "Pale blue + white",
    swatches: ["oklch(0.985 0.012 235)", "oklch(0.92 0.045 235)", "oklch(0.63 0.12 245)"],
  },
  {
    id: "peach",
    name: "Peach",
    blurb: "Soft orange + cream",
    swatches: ["oklch(0.985 0.015 60)", "oklch(0.92 0.05 55)", "oklch(0.71 0.14 45)"],
  },
  {
    id: "sand",
    name: "Sand",
    blurb: "Warm beige + terracotta",
    swatches: ["oklch(0.975 0.018 85)", "oklch(0.91 0.045 65)", "oklch(0.62 0.13 40)"],
  },
  {
    id: "mint",
    name: "Mint",
    blurb: "Light teal + white",
    swatches: ["oklch(0.985 0.014 180)", "oklch(0.92 0.05 180)", "oklch(0.62 0.1 185)"],
  },
  {
    id: "lilac",
    name: "Lilac Bloom",
    blurb: "Pink-purple bloom",
    swatches: ["oklch(0.982 0.018 330)", "oklch(0.918 0.05 320)", "oklch(0.66 0.15 335)"],
  },
  {
    id: "butter",
    name: "Butter",
    blurb: "Soft yellow + white",
    swatches: ["oklch(0.99 0.02 100)", "oklch(0.93 0.06 95)", "oklch(0.66 0.13 80)"],
  },
  {
    id: "cloud",
    name: "Cloud",
    blurb: "Neutral grey-white",
    swatches: ["oklch(0.985 0.002 260)", "oklch(0.925 0.008 260)", "oklch(0.45 0.02 260)"],
  },
  {
    id: "midnight",
    name: "Midnight",
    blurb: "Deep navy + luminous cyan",
    swatches: ["oklch(0.16 0.03 260)", "oklch(0.28 0.04 260)", "oklch(0.7 0.15 240)"],
    isDark: true,
  },
  {
    id: "emerald",
    name: "Emerald Night",
    blurb: "Deep forest + glowing mint",
    swatches: ["oklch(0.16 0.03 160)", "oklch(0.27 0.04 160)", "oklch(0.72 0.15 160)"],
    isDark: true,
  },
  {
    id: "velvet",
    name: "Velvet Dark",
    blurb: "Plum charcoal + glowing rose",
    swatches: ["oklch(0.16 0.03 320)", "oklch(0.27 0.04 320)", "oklch(0.72 0.15 330)"],
    isDark: true,
  },
];

export const THEME_IDS = THEMES.map((t) => t.id);
export const THEME_STORAGE_KEY = "remainder-theme";

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as string[]).includes(value);
}

export function applyThemeClass(theme: ThemeId) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  THEME_IDS.forEach((id) => root.classList.remove(`theme-${id}`));
  root.classList.add(`theme-${theme}`);

  const selectedTheme = THEMES.find((t) => t.id === theme);
  if (selectedTheme?.isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}
