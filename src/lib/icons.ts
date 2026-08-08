import {
  BookOpen,
  Brain,
  Code2,
  Dumbbell,
  Droplet,
  FileText,
  Footprints,
  Languages,
  Leaf,
  Moon,
  Music,
  NotebookPen,
  Sparkle,
  Sprout,
  Sun,
  Timer,
  type LucideIcon,
} from "lucide-react";

/**
 * A curated set of line icons used everywhere a habit, page or subject needs a
 * visual marker. Stored by key so the database never holds emoji.
 */
export const LINE_ICONS: Record<string, LucideIcon> = {
  sprout: Sprout,
  book: BookOpen,
  code: Code2,
  brain: Brain,
  dumbbell: Dumbbell,
  droplet: Droplet,
  run: Footprints,
  music: Music,
  note: NotebookPen,
  language: Languages,
  leaf: Leaf,
  sun: Sun,
  moon: Moon,
  timer: Timer,
  spark: Sparkle,
  file: FileText,
};

export const ICON_KEYS = Object.keys(LINE_ICONS);

export function iconFor(key: string | null | undefined): LucideIcon {
  if (!key) return FileText;
  return LINE_ICONS[key] ?? FileText;
}
