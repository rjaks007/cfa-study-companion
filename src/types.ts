export type Subject =
  | "Quantitative Methods"
  | "Financial Statement Analysis"
  | "Fixed Income"
  | "Derivatives"
  | "Corporate Finance"
  | "Equity Investments"
  | "Portfolio Management"
  | "Economics"
  | "Alternative Investments"
  | "Ethics";

export type ReadingStatus = "not-started" | "in-progress" | "done";
export type SessionType = "Reading" | "Practice Questions" | "Revision" | "Mock" | "Flashcards";
export type FlashcardRating = "again" | "hard" | "good" | "easy";
export type FlashcardType = "Concept" | "Formula" | "Application" | "Trap";
export type FlashcardStatus = "new" | "learning" | "relearning";
export type AppTab = "overview" | "weekly" | "progress" | "practice";
export type MistakeType = "Concept weak" | "Formula weak" | "Application weak" | "Silly mistake" | "Misread question" | "No major issue";
export type WeakTag =
  | "Concept weak"
  | "Formula weak"
  | "Application weak"
  | "Silly mistakes"
  | "Misread question"
  | "Needs re-test"
  | "Trap-prone"
  | "Memory issue";
export type UploadStatus =
  | "Not uploaded"
  | "Waiting for notes"
  | "Waiting for question bank"
  | "Ready for assisted review"
  | "Syncing with AI"
  | "Parsed with AI"
  | "AI sync failed";

export interface ReviewLog {
  date: string;
  score: number;
}

export interface QuestionBreakdown {
  concept: number;
  formula: number;
  application: number;
  silly: number;
  misread: number;
}

export interface QuestionProgress {
  total: number;
  correct: number;
  wrong: number;
  skipped: number;
  byType: QuestionBreakdown;
}

export interface ChapterQuestionSummary {
  totalQuestions: number;
  totalCorrect: number;
  accuracy: number;
  counts: Record<MistakeType, number>;
  weakestArea: MistakeType;
}

export interface Reading {
  id: string;
  subject: Subject;
  readingNumber: number;
  title: string;
  weekAssigned: number;
  status: ReadingStatus;
  confidence: number;
  lastReviewed: string;
  nextReview: string;
  sessionType: SessionType;
  notes: string;
  memoryMap: string;
  formulaSheet: string;
  summary: string;
  chapterSummary: string;
  memoryTip: string;
  examTip: string;
  weakTags: WeakTag[];
  reviewHistory: ReviewLog[];
  accuracy: number | null;
  questionsSolved: number;
  estimatedHours: number;
  questionProgress: QuestionProgress;
  revisionCycle: number;
}

export interface WeekPlan {
  week: number;
  readings: string[];
  type: "Coverage" | "Revision" | "Mock & Final Review";
  revisionFocus?: string[];
}

export interface StudySession {
  id: string;
  date: string;
  subject: Subject;
  readingId: string;
  sessionType: SessionType;
  hours: number;
  questions: number;
  correct: number;
  confidence: number;
  mistakeType: MistakeType;
  notes: string;
  accuracy: number | null;
}

export interface Flashcard {
  id: string;
  deck: string;
  topic: Subject;
  readingId: string;
  readingTitle: string;
  front: string;
  back: string;
  difficulty: number;
  lastReviewed: string;
  nextReview: string;
  interval: number;
  ease: number;
  reps: number;
  status: FlashcardStatus;
  cardType: FlashcardType;
  suspended: boolean;
}

export interface PracticeQuestion {
  id: string;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  difficulty: string;
  tags: string[];
}

export interface PracticeChapter {
  id: string;
  readingTitle: string;
  notesSummary: string;
  revisionFocus: string[];
  questions: PracticeQuestion[];
}

export interface UploadRecord {
  subject: Subject;
  notesPdfName: string;
  notesPdfUri: string;
  questionBankPdfName: string;
  questionBankPdfUri: string;
  notesParsed: boolean;
  questionBankParsed: boolean;
  lastSyncAt: string;
  uploadStatus: UploadStatus;
  chaptersDetected: number;
  readyForReview: boolean;
  aiSummary: string;
  aiError: string;
  parsedChapters: PracticeChapter[];
  userAnswers: Record<string, string>;
}

export interface MockExam {
  id: string;
  name: string;
  date: string;
  score: string;
  weakAreas: string;
  notes: string;
}

export interface StoredState {
  startDate: string;
  readings: Reading[];
  weeks: WeekPlan[];
  sessions: StudySession[];
  cards: Flashcard[];
  uploads: UploadRecord[];
  mocks: MockExam[];
  selectedSubject: Subject;
  selectedReadingId: string;
  backendBaseUrl: string;
  notificationsEnabled: boolean;
}

export interface SessionDraft {
  date: string;
  subject: Subject;
  readingId: string;
  sessionType: SessionType;
  hours: string;
  questions: string;
  correct: string;
  confidence: string;
  mistakeType: MistakeType;
  notes: string;
}

export interface CardDraft {
  deck: string;
  topic: Subject;
  readingId: string;
  front: string;
  back: string;
  difficulty: string;
  cardType: FlashcardType;
}
