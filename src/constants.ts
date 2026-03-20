import { AppTab, FlashcardType, MistakeType, SessionType, WeakTag } from "./types";

export const STORAGE_KEY = "cfa-study-companion-mobile-v2";

export const WEAK_TAG_OPTIONS: WeakTag[] = [
  "Concept weak",
  "Formula weak",
  "Application weak",
  "Silly mistakes",
  "Misread question",
  "Needs re-test",
  "Trap-prone",
  "Memory issue",
];

export const SESSION_TYPES: SessionType[] = ["Reading", "Practice Questions", "Revision", "Mock", "Flashcards"];
export const CARD_TYPES: FlashcardType[] = ["Concept", "Formula", "Application", "Trap"];
export const MISTAKE_TYPES: MistakeType[] = [
  "Concept weak",
  "Formula weak",
  "Application weak",
  "Silly mistake",
  "Misread question",
  "No major issue",
];

export const TABS: Array<{ id: AppTab; label: string; icon: string }> = [
  { id: "overview", label: "Overview", icon: "home-outline" },
  { id: "weekly", label: "Weekly Plan", icon: "calendar-outline" },
  { id: "progress", label: "Progress", icon: "bar-chart-outline" },
  { id: "practice", label: "Practice", icon: "library-outline" },
];
