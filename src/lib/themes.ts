export type ThemeId =
  | "blush"
  | "sage"
  | "lavender"
  | "peach"
  | "butter"
  | "emerald"
  | "velvet"
  | "obsidian"
  | "sapphire";

export type FontId =
  | "merienda"
  | "inter"
  | "outfit";

export const FONT_STORAGE_KEY = "remispace-font";

export const FONTS: { id: FontId; name: string; blurb: string; fontClass: string }[] = [
  { id: "merienda", name: "Flow (Default)", blurb: "Playful, organic cursive handwriting.", fontClass: "font-merienda" },
  { id: "inter", name: "Minimalist (Inter)", blurb: "Clean, neutral, and hyper-legible sans.", fontClass: "font-inter" },
  { id: "outfit", name: "Geometric (Outfit)", blurb: "Sleek, modern, and futuristic geometric sans.", fontClass: "font-outfit" },
];

export const FONT_IDS = FONTS.map((f) => f.id);

export function isFontId(val: unknown): val is FontId {
  return typeof val === "string" && (FONT_IDS as string[]).includes(val);
}

export function applyFontClass(font: FontId) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  FONT_IDS.forEach((id) => root.classList.remove(`font-${id}`));
  root.classList.add(`font-${font}`);
}

export type ThemeDef = {
  id: ThemeId;
  name: string;
  blurb: string;
  swatches: string[];
  isDark?: boolean;
};

export const THEMES: ThemeDef[] = [
  // Soft Light Palettes
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
    id: "peach",
    name: "Peach",
    blurb: "Soft orange + cream",
    swatches: ["oklch(0.985 0.015 60)", "oklch(0.92 0.05 55)", "oklch(0.71 0.14 45)"],
  },
  {
    id: "butter",
    name: "Butter",
    blurb: "Soft yellow + white",
    swatches: ["oklch(0.99 0.02 100)", "oklch(0.93 0.06 95)", "oklch(0.66 0.13 80)"],
  },

  // Rich Dark Palettes
  {
    id: "emerald",
    name: "Emerald Forest",
    blurb: "Deep evergreen + glowing mint",
    swatches: ["oklch(0.16 0.03 160)", "oklch(0.27 0.04 160)", "oklch(0.72 0.15 160)"],
    isDark: true,
  },
  {
    id: "velvet",
    name: "Velvet Plum",
    blurb: "Plum charcoal + glowing rose",
    swatches: ["oklch(0.16 0.03 320)", "oklch(0.27 0.04 320)", "oklch(0.72 0.15 330)"],
    isDark: true,
  },
  {
    id: "obsidian",
    name: "Obsidian Gold",
    blurb: "Pitch carbon + warm glowing amber",
    swatches: ["oklch(0.13 0.01 260)", "oklch(0.22 0.02 80)", "oklch(0.78 0.16 75)"],
    isDark: true,
  },
  {
    id: "sapphire",
    name: "Sapphire Abyss",
    blurb: "Oceanic noir + electric cobalt cyan",
    swatches: ["oklch(0.13 0.04 240)", "oklch(0.22 0.05 240)", "oklch(0.72 0.16 230)"],
    isDark: true,
  },
];

export const THEME_IDS = THEMES.map((t) => t.id);
export const THEME_STORAGE_KEY = "remispace-theme";

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
