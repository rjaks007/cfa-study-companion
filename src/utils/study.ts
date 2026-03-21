import { Flashcard, FlashcardRating } from "../types";

export function makeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number) {
  const date = new Date(iso || todayISO());
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function diffDays(target: string) {
  const targetDate = new Date(target);
  const now = new Date(todayISO());
  const ms = targetDate.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0);
  return Math.round(ms / 86400000);
}

export function formatShortDate(iso?: string) {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

export function formatLongDate(iso?: string) {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatInputDate(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${day}/${month}/${year}`;
}

export function parseInputDate(value: string) {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function nextReviewFromScore(score: number, baseDate = todayISO()) {
  if (score <= 3) return addDays(baseDate, 2);
  if (score <= 5) return addDays(baseDate, 5);
  if (score <= 7) return addDays(baseDate, 10);
  return addDays(baseDate, 20);
}

export function calculateCardUpdate(card: Flashcard, rating: FlashcardRating): Flashcard {
  const easeMap: Record<FlashcardRating, number> = {
    again: -0.2,
    hard: -0.05,
    good: 0.05,
    easy: 0.15,
  };

  const dayMap: Record<FlashcardRating, number> = {
    again: 1,
    hard: Math.max(1, Math.round(card.interval * 1.2) || 2),
    good: Math.max(2, Math.round(card.interval * card.ease) || 3),
    easy: Math.max(4, Math.round(card.interval * (card.ease + 0.4)) || 5),
  };

  const newEase = Math.max(1.3, Number((card.ease + easeMap[rating]).toFixed(2)));
  const newInterval = dayMap[rating];

  return {
    ...card,
    lastReviewed: todayISO(),
    nextReview: addDays(todayISO(), newInterval),
    interval: newInterval,
    ease: newEase,
    reps: card.reps + 1,
    status: rating === "again" ? "relearning" : "learning",
  };
}
