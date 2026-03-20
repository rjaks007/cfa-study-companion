import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useEffect, useMemo, useState } from "react";
import { MISTAKE_TYPES, STORAGE_KEY } from "../constants";
import { buildWeeks, createCardDraft, createInitialState, createSessionDraft, defaultMocks, defaultUploads, starterCards, SUBJECT_BLUEPRINT, SUBJECT_ORDER } from "../data/cfa";
import { CardDraft, ChapterQuestionSummary, Flashcard, FlashcardRating, PracticeChapter, SessionDraft, StoredState, StudySession, Subject, UploadRecord } from "../types";
import { requestReviewNotificationPermission, scheduleReviewNotifications } from "../utils/notifications";
import { calculateCardUpdate, diffDays, makeId, nextReviewFromScore, todayISO } from "../utils/study";
import { buildChapterQuestionSummary, deriveMistakeKey, emptyQuestionProgress, generateExamTip, generateFlashcardsFromReading, generateFormulaTemplate, generateMemoryTip, generateMindMapTemplate, generateSummaryTemplate } from "../utils/templates";

function parseStructuredAiOutput(content: string) {
  const trimmed = content.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeParsedChapters(value: unknown): PracticeChapter[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((chapter, chapterIndex) => {
      const readingTitle = typeof chapter?.readingTitle === "string" ? chapter.readingTitle.trim() : "";
      const questions = Array.isArray(chapter?.questions)
        ? chapter.questions
            .map((question: any, questionIndex: number) => {
              const prompt = typeof question?.question === "string" ? question.question.trim() : "";
              const options = Array.isArray(question?.options)
                ? question.options.map((option: unknown) => String(option).trim()).filter(Boolean)
                : [];
              if (!prompt) return null;
              return {
                id: `chapter-${chapterIndex + 1}-question-${questionIndex + 1}`,
                question: prompt,
                options,
                answer: typeof question?.answer === "string" ? question.answer.trim() : "",
                explanation: typeof question?.explanation === "string" ? question.explanation.trim() : "",
                difficulty: typeof question?.difficulty === "string" ? question.difficulty.trim() : "",
                tags: Array.isArray(question?.tags) ? question.tags.map((tag: unknown) => String(tag).trim()).filter(Boolean) : [],
              };
            })
            .filter(Boolean)
        : [];

      if (!readingTitle && !questions.length) return null;

      return {
        id: `chapter-${chapterIndex + 1}`,
        readingTitle: readingTitle || `Chapter ${chapterIndex + 1}`,
        notesSummary: typeof chapter?.notesSummary === "string" ? chapter.notesSummary.trim() : "",
        revisionFocus: Array.isArray(chapter?.revisionFocus)
          ? chapter.revisionFocus.map((item: unknown) => String(item).trim()).filter(Boolean)
          : [],
        questions,
      };
    })
    .filter(Boolean) as PracticeChapter[];
}

function normalizeReading(reading: StoredState["readings"][number]) {
  return {
    ...reading,
    chapterSummary: reading.chapterSummary || "",
    memoryTip: reading.memoryTip || "",
    examTip: reading.examTip || "",
    weakTags: Array.isArray(reading.weakTags) ? reading.weakTags : [],
    reviewHistory: Array.isArray(reading.reviewHistory) ? reading.reviewHistory : [],
    questionProgress: reading.questionProgress || emptyQuestionProgress(),
    revisionCycle: reading.revisionCycle || 1,
  };
}

function normalizeUpload(upload: Partial<UploadRecord>, subject: Subject): UploadRecord {
  const notesPdfName = upload.notesPdfName || "";
  const notesPdfUri = upload.notesPdfUri || "";
  const questionBankPdfName = upload.questionBankPdfName || "";
  const questionBankPdfUri = upload.questionBankPdfUri || "";
  const hasNotes = Boolean(notesPdfName);
  const hasQBank = Boolean(questionBankPdfName);
  return {
    subject,
    notesPdfName,
    notesPdfUri,
    questionBankPdfName,
    questionBankPdfUri,
    notesParsed: upload.notesParsed || false,
    questionBankParsed: upload.questionBankParsed || false,
    lastSyncAt: upload.lastSyncAt || "",
    uploadStatus:
      upload.uploadStatus ||
      (hasNotes && hasQBank ? "Ready for assisted review" : hasNotes ? "Waiting for question bank" : hasQBank ? "Waiting for notes" : "Not uploaded"),
    chaptersDetected: upload.chaptersDetected || SUBJECT_BLUEPRINT[subject].length,
    readyForReview: hasNotes && hasQBank,
    aiSummary: upload.aiSummary || "",
    aiError: upload.aiError || "",
    parsedChapters: normalizeParsedChapters(upload.parsedChapters),
    userAnswers: upload.userAnswers || {},
  };
}

function normalizeState(value: Partial<StoredState> | null | undefined): StoredState {
  const base = createInitialState();
  if (!value) return base;

  const readings = value.readings?.length ? value.readings.map(normalizeReading) : base.readings;
  const selectedSubject = value.selectedSubject || base.selectedSubject;
  const selectedReadingId =
    value.selectedReadingId && readings.some((reading) => reading.id === value.selectedReadingId)
      ? value.selectedReadingId
      : readings.find((reading) => reading.subject === selectedSubject)?.id || readings[0].id;

  const uploads = SUBJECT_ORDER.map((subject) => {
    const existing = value.uploads?.find((upload) => upload.subject === subject);
    return normalizeUpload(existing || {}, subject);
  });

  const sessions = Array.isArray(value.sessions) ? value.sessions : [];
  const cards = Array.isArray(value.cards) && value.cards.length ? value.cards : starterCards();
  const mocks = Array.isArray(value.mocks) && value.mocks.length ? value.mocks : defaultMocks();

  return {
    startDate: value.startDate || base.startDate,
    readings,
    weeks: buildWeeks(readings),
    sessions,
    cards,
    uploads,
    mocks,
    selectedSubject,
    selectedReadingId,
    backendBaseUrl: value.backendBaseUrl || base.backendBaseUrl,
    notificationsEnabled: Boolean(value.notificationsEnabled),
  };
}

export function useStudyCompanion() {
  const [studyState, setStudyState] = useState<StoredState>(createInitialState());
  const [isHydrated, setHydrated] = useState(false);
  const [syncingSubject, setSyncingSubject] = useState<Subject | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [flashcardFilter, setFlashcardFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [newSession, setNewSession] = useState<SessionDraft>(createSessionDraft(SUBJECT_ORDER[0], createInitialState().selectedReadingId));
  const [newCard, setNewCard] = useState<CardDraft>(createCardDraft(SUBJECT_ORDER[0], createInitialState().selectedReadingId));

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved && mounted) {
          const parsed = normalizeState(JSON.parse(saved));
          setStudyState(parsed);
          setNewSession(createSessionDraft(parsed.selectedSubject, parsed.selectedReadingId));
          setNewCard(createCardDraft(parsed.selectedSubject, parsed.selectedReadingId));
        }
      })
      .catch((error) => {
        console.warn("Failed to load study state", error);
      })
      .finally(() => {
        if (mounted) setHydrated(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(studyState)).catch((error) => {
      console.warn("Failed to persist study state", error);
    });
  }, [isHydrated, studyState]);

  useEffect(() => {
    if (!isHydrated || !studyState.notificationsEnabled) return;
    scheduleReviewNotifications(studyState.readings).catch((error) => {
      console.warn("Failed to schedule review reminders", error);
    });
  }, [isHydrated, studyState.notificationsEnabled, studyState.readings]);

  const readingMap = useMemo(
    () => Object.fromEntries(studyState.readings.map((reading) => [reading.id, reading])),
    [studyState.readings],
  );

  const visibleReadings = useMemo(
    () => studyState.readings.filter((reading) => reading.subject === studyState.selectedSubject),
    [studyState.readings, studyState.selectedSubject],
  );

  useEffect(() => {
    const visible = studyState.readings.filter((reading) => reading.subject === studyState.selectedSubject);
    if (!visible.some((reading) => reading.id === studyState.selectedReadingId) && visible[0]) {
      setStudyState((current) => ({ ...current, selectedReadingId: visible[0].id }));
    }
  }, [studyState.readings, studyState.selectedReadingId, studyState.selectedSubject]);

  useEffect(() => {
    const sessionReadings = studyState.readings.filter((reading) => reading.subject === newSession.subject);
    if (!sessionReadings.some((reading) => reading.id === newSession.readingId) && sessionReadings[0]) {
      setNewSession((current) => ({ ...current, readingId: sessionReadings[0].id }));
    }
  }, [newSession.readingId, newSession.subject, studyState.readings]);

  useEffect(() => {
    const cardReadings = studyState.readings.filter((reading) => reading.subject === newCard.topic);
    if (!cardReadings.some((reading) => reading.id === newCard.readingId) && cardReadings[0]) {
      setNewCard((current) => ({ ...current, readingId: cardReadings[0].id }));
    }
  }, [newCard.readingId, newCard.topic, studyState.readings]);

  const selectedReading = readingMap[studyState.selectedReadingId] || visibleReadings[0];

  const currentWeek = useMemo(() => {
    const start = new Date(studyState.startDate);
    const now = new Date(todayISO());
    const days = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86400000));
    return Math.min(26, Math.floor(days / 7) + 1);
  }, [studyState.startDate]);

  const currentWeekObj = studyState.weeks.find((week) => week.week === currentWeek) || studyState.weeks[0];
  const currentWeekReadings = currentWeekObj.readings.map((id) => readingMap[id]).filter(Boolean);
  const backlogReadings = studyState.readings.filter((reading) => reading.weekAssigned < currentWeek && reading.status !== "done");
  const dueReadingReviews = studyState.readings.filter((reading) => reading.nextReview && diffDays(reading.nextReview) <= 0);
  const dueCards = studyState.cards.filter((card) => !card.suspended && (!card.nextReview || diffDays(card.nextReview) <= 0));
  const currentCard = dueCards[0];
  const completedReadings = studyState.readings.filter((reading) => reading.status === "done").length;
  const syllabusProgress = Math.round((completedReadings / studyState.readings.length) * 100);
  const totalHours = studyState.sessions.reduce((sum, session) => sum + Number(session.hours || 0), 0);
  const totalQuestions = studyState.sessions.reduce((sum, session) => sum + Number(session.questions || 0), 0);
  const totalCorrect = studyState.sessions.reduce((sum, session) => sum + Number(session.correct || 0), 0);
  const overallAccuracy = totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  const avgConfidence =
    studyState.readings.length > 0
      ? Math.round((studyState.readings.reduce((sum, reading) => sum + Number(reading.confidence || 0), 0) / studyState.readings.length) * 10) / 10
      : 0;

  const streak = useMemo(() => {
    const days = new Set(studyState.sessions.map((session) => session.date));
    let count = 0;
    const cursor = new Date(todayISO());
    while (days.has(cursor.toISOString().slice(0, 10))) {
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }, [studyState.sessions]);

  const subjectStats = useMemo(
    () =>
      SUBJECT_ORDER.map((subject) => {
        const subjectReadings = studyState.readings.filter((reading) => reading.subject === subject);
        const done = subjectReadings.filter((reading) => reading.status === "done").length;
        const avg =
          subjectReadings.length > 0
            ? Math.round((subjectReadings.reduce((sum, reading) => sum + Number(reading.confidence || 0), 0) / subjectReadings.length) * 10) / 10
            : 0;
        const due = subjectReadings.filter((reading) => reading.nextReview && diffDays(reading.nextReview) <= 0).length;
        return {
          subject,
          total: subjectReadings.length,
          done,
          avg,
          due,
          progress: Math.round((done / subjectReadings.length) * 100) || 0,
        };
      }),
    [studyState.readings],
  );

  const examReadiness = Math.min(
    99,
    Math.round(syllabusProgress * 0.35 + avgConfidence * 6 + overallAccuracy * 0.35 + Math.min(10, streak) * 0.4),
  );

  const todayPlan = useMemo(() => {
    const due = dueReadingReviews.slice(0, 3);
    const current = currentWeekReadings.filter((reading) => reading.status !== "done").slice(0, 2);
    return { due, current };
  }, [currentWeekReadings, dueReadingReviews]);

  const filteredCards = useMemo(
    () =>
      studyState.cards.filter((card) => {
        if (card.suspended) return false;
        const matchesFilter = flashcardFilter === "all" || card.topic === flashcardFilter || card.cardType === flashcardFilter;
        const query = search.trim().toLowerCase();
        const matchesSearch =
          !query ||
          card.front.toLowerCase().includes(query) ||
          card.back.toLowerCase().includes(query) ||
          card.readingTitle.toLowerCase().includes(query);
        return matchesFilter && matchesSearch;
      }),
    [flashcardFilter, search, studyState.cards],
  );

  const planEndDate = useMemo(() => {
    const end = new Date(studyState.startDate || todayISO());
    end.setDate(end.getDate() + 26 * 7 - 1);
    return end.toISOString().slice(0, 10);
  }, [studyState.startDate]);

  const selectedReadingQuestionSummary: ChapterQuestionSummary | null = selectedReading
    ? buildChapterQuestionSummary(selectedReading, studyState.sessions)
    : null;

  const recoveryAreas = useMemo(() => {
    const scores = new Map<string, number>();
    studyState.readings.forEach((reading) => {
      reading.weakTags.forEach((tag) => {
        const label = `${reading.subject}: ${tag}`;
        scores.set(label, (scores.get(label) || 0) + 1);
      });
    });
    studyState.mocks.forEach((mock) => {
      mock.weakAreas
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => scores.set(`Mock focus: ${item}`, (scores.get(`Mock focus: ${item}`) || 0) + 1));
    });
    return Array.from(scores.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [studyState.mocks, studyState.readings]);

  const dueTomorrowReadings = useMemo(
    () => studyState.readings.filter((reading) => reading.nextReview && diffDays(reading.nextReview) === 1),
    [studyState.readings],
  );

  const overdueReadings = useMemo(
    () => studyState.readings.filter((reading) => reading.nextReview && diffDays(reading.nextReview) < 0),
    [studyState.readings],
  );

  const weekProgress = useMemo(() => {
    const done = currentWeekReadings.filter((reading) => reading.status === "done").length;
    const total = currentWeekReadings.length;
    return {
      done,
      total,
      percent: total ? Math.round((done / total) * 100) : 0,
    };
  }, [currentWeekReadings]);

  function setReadings(nextReadings: StoredState["readings"]) {
    setStudyState((current) => ({
      ...current,
      readings: nextReadings,
      weeks: buildWeeks(nextReadings),
    }));
  }

  function updateReading(readingId: string, patch: Partial<StoredState["readings"][number]>) {
    setReadings(studyState.readings.map((reading) => (reading.id === readingId ? { ...reading, ...patch } : reading)));
  }

  function cycleReadingStatus(readingId: string) {
    const reading = readingMap[readingId];
    if (!reading) return;
    const nextStatus =
      reading.status === "not-started" ? "in-progress" : reading.status === "in-progress" ? "done" : "not-started";

    updateReading(readingId, {
      status: nextStatus,
      lastReviewed: nextStatus === "not-started" ? reading.lastReviewed : reading.lastReviewed || todayISO(),
      nextReview:
        nextStatus === "done"
          ? nextReviewFromScore(reading.confidence || 6, reading.lastReviewed || todayISO())
          : nextStatus === "not-started"
            ? ""
            : reading.nextReview,
    });
  }

  function markReadingStudied(readingId: string, date = todayISO()) {
    const reading = readingMap[readingId];
    if (!reading) return;
    updateReading(readingId, {
      status: reading.status === "done" ? "done" : "in-progress",
      lastReviewed: date,
      nextReview: reading.confidence ? nextReviewFromScore(reading.confidence, date) : reading.nextReview,
    });
  }

  function setReadingStudyDate(readingId: string, date: string) {
    const reading = readingMap[readingId];
    if (!reading) return;
    updateReading(readingId, {
      status: reading.status === "not-started" ? "in-progress" : reading.status,
      lastReviewed: date,
      nextReview: reading.confidence ? nextReviewFromScore(reading.confidence, date) : reading.nextReview,
    });
  }

  function setReadingConfidence(readingId: string, score: number) {
    const reading = readingMap[readingId];
    if (!reading) return;
    const baseDate = reading.lastReviewed || todayISO();
    updateReading(readingId, {
      confidence: score,
      lastReviewed: baseDate,
      nextReview: nextReviewFromScore(score, baseDate),
      reviewHistory: [...(reading.reviewHistory || []), { date: baseDate, score }],
    });
  }

  function setSelectedSubject(subject: Subject) {
    const firstReadingId = studyState.readings.find((reading) => reading.subject === subject)?.id || studyState.readings[0].id;
    setStudyState((current) => ({
      ...current,
      selectedSubject: subject,
      selectedReadingId: firstReadingId,
    }));
  }

  function setSelectedReadingId(readingId: string) {
    setStudyState((current) => ({ ...current, selectedReadingId: readingId }));
  }

  function setBackendBaseUrl(value: string) {
    setStudyState((current) => ({ ...current, backendBaseUrl: value }));
  }

  function handleReadingConfidence(readingId: string, score: number) {
    setReadingConfidence(readingId, Number(score));
  }

  function toggleWeakTag(readingId: string, tag: StoredState["readings"][number]["weakTags"][number]) {
    const reading = readingMap[readingId];
    const current = new Set(reading?.weakTags || []);
    if (current.has(tag)) current.delete(tag);
    else current.add(tag);
    updateReading(readingId, { weakTags: Array.from(current) });
  }

  function addSession() {
    const reading = readingMap[newSession.readingId];
    if (!reading) return;

    const questions = Number(newSession.questions || 0);
    const correct = Number(newSession.correct || 0);
    const wrong = Math.max(0, questions - correct);
    const confidence = Number(newSession.confidence || 0);
    const accuracy = questions ? Math.round((correct / questions) * 100) : null;
    const typeKey = deriveMistakeKey(newSession.mistakeType);

    const entry: StudySession = {
      id: makeId("session"),
      date: newSession.date || todayISO(),
      subject: newSession.subject,
      readingId: newSession.readingId,
      sessionType: newSession.sessionType,
      hours: Number(newSession.hours || 0),
      questions,
      correct,
      confidence,
      mistakeType: newSession.mistakeType,
      notes: newSession.notes.trim(),
      accuracy,
    };

    const nextQuestionProgress = {
      ...reading.questionProgress,
      total: Number(reading.questionProgress.total || 0) + questions,
      correct: Number(reading.questionProgress.correct || 0) + correct,
      wrong: Number(reading.questionProgress.wrong || 0) + wrong,
      skipped: Number(reading.questionProgress.skipped || 0),
      byType: {
        ...reading.questionProgress.byType,
        concept: reading.questionProgress.byType.concept + (typeKey === "concept" ? wrong : 0),
        formula: reading.questionProgress.byType.formula + (typeKey === "formula" ? wrong : 0),
        application: reading.questionProgress.byType.application + (typeKey === "application" ? wrong : 0),
        silly: reading.questionProgress.byType.silly + (typeKey === "silly" ? wrong : 0),
        misread: reading.questionProgress.byType.misread + (typeKey === "misread" ? wrong : 0),
      },
    };

    const nextSessions = [entry, ...studyState.sessions];
    const nextReadings = studyState.readings.map((item) =>
      item.id === newSession.readingId
        ? {
            ...item,
            status: newSession.sessionType === "Reading" && item.status === "not-started" ? "in-progress" : item.status,
            confidence,
            lastReviewed: entry.date,
            nextReview: nextReviewFromScore(confidence, entry.date),
            questionsSolved: Number(item.questionsSolved || 0) + questions,
            accuracy,
            notes: newSession.notes.trim() || item.notes,
            questionProgress: nextQuestionProgress,
            reviewHistory: [...(item.reviewHistory || []), { date: entry.date, score: confidence }],
          }
        : item,
    );

    setStudyState((current) => ({
      ...current,
      sessions: nextSessions,
      readings: nextReadings,
      weeks: buildWeeks(nextReadings),
    }));

    const fallbackReadingId = studyState.readings.find((item) => item.subject === newSession.subject)?.id || studyState.readings[0].id;
    setNewSession(createSessionDraft(newSession.subject, fallbackReadingId));
  }

  function markReadingDone(readingId: string) {
    const reading = readingMap[readingId];
    if (!reading) return;
    const summary = buildChapterQuestionSummary(reading, studyState.sessions);
    updateReading(readingId, {
      status: "done",
      lastReviewed: todayISO(),
      nextReview: nextReviewFromScore(Number(reading.confidence || 6), todayISO()),
      chapterSummary:
        reading.chapterSummary ||
        `Accuracy ${summary.accuracy}% · Total questions ${summary.totalQuestions} · Weakest area: ${summary.weakestArea}.`,
      memoryTip: reading.memoryTip || generateMemoryTip(reading),
      examTip: reading.examTip || generateExamTip(reading),
    });
  }

  function resetSubjectForRevision(subject: Subject) {
    const nextReadings = studyState.readings.map((reading) =>
      reading.subject === subject
        ? {
            ...reading,
            status: "not-started" as const,
            confidence: 0,
            lastReviewed: "",
            nextReview: "",
            accuracy: null,
            questionsSolved: 0,
            questionProgress: emptyQuestionProgress(),
            chapterSummary: "",
            revisionCycle: (reading.revisionCycle || 1) + 1,
          }
        : reading,
    );
    setReadings(nextReadings);
  }

  function resetAllForRevision() {
    const nextReadings = studyState.readings.map((reading) => ({
      ...reading,
      status: "not-started" as const,
      confidence: 0,
      lastReviewed: "",
      nextReview: "",
      accuracy: null,
      questionsSolved: 0,
      questionProgress: emptyQuestionProgress(),
      chapterSummary: "",
      revisionCycle: (reading.revisionCycle || 1) + 1,
    }));
    setReadings(nextReadings);
  }

  function autofillReadingAssets(readingId: string) {
    const reading = readingMap[readingId];
    if (!reading) return;
    updateReading(readingId, {
      memoryMap: reading.memoryMap || generateMindMapTemplate(reading),
      formulaSheet: reading.formulaSheet || generateFormulaTemplate(reading),
      summary: reading.summary || generateSummaryTemplate(reading),
      memoryTip: reading.memoryTip || generateMemoryTip(reading),
      examTip: reading.examTip || generateExamTip(reading),
    });
  }

  function addCard() {
    if (!newCard.front.trim() || !newCard.back.trim()) return;
    const reading = readingMap[newCard.readingId];
    const nextCard: Flashcard = {
      id: makeId("card"),
      deck: newCard.deck.trim() || "General",
      topic: newCard.topic,
      readingId: newCard.readingId,
      readingTitle: reading?.title || "",
      front: newCard.front.trim(),
      back: newCard.back.trim(),
      difficulty: Number(newCard.difficulty || 3),
      lastReviewed: "",
      nextReview: todayISO(),
      interval: 0,
      ease: 2.5,
      reps: 0,
      status: "new",
      cardType: newCard.cardType,
      suspended: false,
    };

    setStudyState((current) => ({ ...current, cards: [nextCard, ...current.cards] }));
    const fallbackReadingId = studyState.readings.find((item) => item.subject === newCard.topic)?.id || studyState.readings[0].id;
    setNewCard(createCardDraft(newCard.topic, fallbackReadingId));
  }

  function generateCardsFromSelectedReading() {
    if (!selectedReading) return 0;
    const generated = generateFlashcardsFromReading(selectedReading);
    if (!generated.length) return 0;

    const nextCards: Flashcard[] = generated.map((card) => ({
      id: makeId("card"),
      deck: card.deck,
      topic: card.topic,
      readingId: card.readingId,
      readingTitle: card.readingTitle,
      front: card.front,
      back: card.back,
      difficulty: 3,
      lastReviewed: "",
      nextReview: todayISO(),
      interval: 0,
      ease: 2.5,
      reps: 0,
      status: "new",
      cardType: card.cardType,
      suspended: false,
    }));

    setStudyState((current) => ({ ...current, cards: [...nextCards, ...current.cards] }));
    return nextCards.length;
  }

  function reviewCard(rating: FlashcardRating) {
    if (!currentCard) return;
    setStudyState((current) => ({
      ...current,
      cards: current.cards.map((card) => (card.id === currentCard.id ? calculateCardUpdate(card, rating) : card)),
    }));
    setShowAnswer(false);
  }

  function toggleSuspend(cardId: string) {
    setStudyState((current) => ({
      ...current,
      cards: current.cards.map((card) => (card.id === cardId ? { ...card, suspended: !card.suspended } : card)),
    }));
  }

  function updateMock(index: number, patch: Partial<StoredState["mocks"][number]>) {
    setStudyState((current) => ({
      ...current,
      mocks: current.mocks.map((mock, mockIndex) => (mockIndex === index ? { ...mock, ...patch } : mock)),
    }));
  }

  async function updateUpload(
    subject: Subject,
    type: "notesPdfName" | "questionBankPdfName",
    asset: { name: string; uri: string },
  ) {
    setStudyState((current) => ({
      ...current,
      uploads: current.uploads.map((upload) => {
        if (upload.subject !== subject) return upload;
        const uriKey = type === "notesPdfName" ? "notesPdfUri" : "questionBankPdfUri";
        const next = {
          ...upload,
          [type]: asset.name,
          [uriKey]: asset.uri,
          notesParsed: type === "notesPdfName" ? false : upload.notesParsed,
          questionBankParsed: type === "questionBankPdfName" ? false : upload.questionBankParsed,
          lastSyncAt: "",
          aiSummary: "",
          aiError: "",
          parsedChapters: [],
          userAnswers: {},
        };
        const hasNotes = Boolean(next.notesPdfName);
        const hasQBank = Boolean(next.questionBankPdfName);
        return {
          ...next,
          uploadStatus: hasNotes && hasQBank ? "Ready for assisted review" : hasNotes ? "Waiting for question bank" : hasQBank ? "Waiting for notes" : "Not uploaded",
          chaptersDetected: SUBJECT_BLUEPRINT[subject]?.length || 0,
          readyForReview: hasNotes && hasQBank,
        };
      }),
    }));
  }

  async function pickPdf(subject: Subject, type: "notesPdfName" | "questionBankPdfName") {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });
    if (result.canceled) return false;
    await updateUpload(subject, type, {
      name: result.assets[0].name,
      uri: result.assets[0].uri,
    });
    return true;
  }

  async function syncSubjectWithAi(subject: Subject) {
    const upload = studyState.uploads.find((item) => item.subject === subject);
    const backendBaseUrl = studyState.backendBaseUrl.trim().replace(/\/$/, "");

    if (!backendBaseUrl) {
      throw new Error("Add your backend URL first.");
    }
    if (!upload?.questionBankPdfUri) {
      throw new Error("Upload the question bank PDF first.");
    }

    setSyncingSubject(subject);
    setStudyState((current) => ({
      ...current,
      uploads: current.uploads.map((item) =>
        item.subject === subject
          ? {
              ...item,
              uploadStatus: "Syncing with AI",
              aiError: "",
            }
          : item,
      ),
    }));

    try {
      const formData = new FormData();
      formData.append("subject", subject);

      if (upload.notesPdfUri) {
        formData.append("notes", {
          uri: upload.notesPdfUri,
          name: upload.notesPdfName || `${subject}-notes.pdf`,
          type: "application/pdf",
        } as never);
      }

      formData.append("questionBank", {
        uri: upload.questionBankPdfUri,
        name: upload.questionBankPdfName || `${subject}-question-bank.pdf`,
        type: "application/pdf",
      } as never);

      const response = await fetch(`${backendBaseUrl}/api/parse-materials`, {
        method: "POST",
        body: formData,
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.details || payload?.error || "AI sync failed.");
      }

      const structured = parseStructuredAiOutput(payload.output_text || "");
      const parsedChapters = normalizeParsedChapters(structured?.chapters);
      const chapterCount = parsedChapters.length || upload.chaptersDetected;

      setStudyState((current) => ({
        ...current,
        uploads: current.uploads.map((item) =>
          item.subject === subject
            ? {
                ...item,
                notesParsed: Boolean(item.notesPdfUri),
                questionBankParsed: true,
                lastSyncAt: todayISO(),
                chaptersDetected: chapterCount,
                uploadStatus: "Parsed with AI",
                aiSummary: payload.output_text || "",
                aiError: "",
                parsedChapters,
                userAnswers: {},
              }
            : item,
        ),
      }));

      return payload;
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI sync failed.";
      setStudyState((current) => ({
        ...current,
        uploads: current.uploads.map((item) =>
          item.subject === subject
            ? {
                ...item,
                uploadStatus: "AI sync failed",
                aiError: message,
              }
            : item,
        ),
      }));
      throw error;
    } finally {
      setSyncingSubject(null);
    }
  }

  async function enableReviewNotifications() {
    const granted = await requestReviewNotificationPermission();
    if (!granted) return false;
    await scheduleReviewNotifications(studyState.readings);
    setStudyState((current) => ({ ...current, notificationsEnabled: true }));
    return true;
  }

  async function askPracticeAssistant(subject: Subject, question: string, extraContext?: Record<string, unknown>) {
    const backendBaseUrl = studyState.backendBaseUrl.trim().replace(/\/$/, "");
    if (!backendBaseUrl) {
      throw new Error("Add your backend URL first.");
    }

    const upload = studyState.uploads.find((item) => item.subject === subject);
    const performanceSummary = upload
      ? {
          totalChapters: upload.parsedChapters.length,
          answered: Object.keys(upload.userAnswers).length,
          wrongByChapter: upload.parsedChapters.map((chapter) => {
            const wrong = chapter.questions.filter((question) => {
              const selected = upload.userAnswers[question.id];
              return selected && question.answer && selected.trim().toLowerCase() !== question.answer.trim().toLowerCase();
            }).length;
            return {
              readingTitle: chapter.readingTitle,
              wrong,
              revisionFocus: chapter.revisionFocus,
              notesSummary: chapter.notesSummary,
            };
          }),
        }
      : null;

    const response = await fetch(`${backendBaseUrl}/api/study-chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subject,
        question,
        parsedChapters: upload?.parsedChapters || [],
        performanceSummary,
        aiSummary: upload?.aiSummary || "",
        extraContext: extraContext || {},
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.details || payload?.error || "Study assistant request failed.");
    }

    return String(payload.answer || "").trim();
  }

  function answerPracticeQuestion(subject: Subject, questionId: string, selectedOption: string) {
    setStudyState((current) => ({
      ...current,
      uploads: current.uploads.map((upload) =>
        upload.subject === subject
          ? {
              ...upload,
              userAnswers: {
                ...upload.userAnswers,
                [questionId]: selectedOption,
              },
            }
          : upload,
      ),
    }));
  }

  function resetPracticeAnswers(subject: Subject) {
    setStudyState((current) => ({
      ...current,
      uploads: current.uploads.map((upload) =>
        upload.subject === subject
          ? {
              ...upload,
              userAnswers: {},
            }
          : upload,
      ),
    }));
  }

  async function exportBackup() {
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error("Sharing unavailable");
    }
    const baseDirectory = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    if (!baseDirectory) {
      throw new Error("Writable directory unavailable");
    }
    const uri = `${baseDirectory}cfa-study-backup-${todayISO()}.json`;
    await FileSystem.writeAsStringAsync(uri, JSON.stringify(studyState, null, 2), {
      encoding: FileSystem.EncodingType.UTF8,
    });
    await Sharing.shareAsync(uri, {
      dialogTitle: "Export CFA Study Companion backup",
      mimeType: "application/json",
    });
  }

  async function importBackup() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/json", "text/json"],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return false;
    const content = await FileSystem.readAsStringAsync(result.assets[0].uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    const parsed = normalizeState(JSON.parse(content));
    setStudyState(parsed);
    setNewSession(createSessionDraft(parsed.selectedSubject, parsed.selectedReadingId));
    setNewCard(createCardDraft(parsed.selectedSubject, parsed.selectedReadingId));
    return true;
  }

  function setStartDate(value: string) {
    setStudyState((current) => ({ ...current, startDate: value }));
  }

  function resetStartDateToToday() {
    setStartDate(todayISO());
  }

  const subjectReadingOptions = studyState.readings.filter((reading) => reading.subject === newSession.subject);
  const cardReadingOptions = studyState.readings.filter((reading) => reading.subject === newCard.topic);
  const selfChecksPassed = useMemo(() => {
    return (
      generateMindMapTemplate({ subject: "Quantitative Methods", readingNumber: 1, title: "Rate and Return" } as StoredState["readings"][number]).includes("\n") &&
      generateFormulaTemplate({ title: "The Time Value of Money" } as StoredState["readings"][number]).includes("\n") &&
      nextReviewFromScore(3, "2026-03-19") === "2026-03-21" &&
      nextReviewFromScore(8, "2026-03-19") === "2026-04-08" &&
      MISTAKE_TYPES.length === 6
    );
  }, []);

  return {
    studyState,
    isHydrated,
    showAnswer,
    setShowAnswer,
    flashcardFilter,
    setFlashcardFilter,
    search,
    setSearch,
    newSession,
    setNewSession,
    newCard,
    setNewCard,
    readingMap,
    visibleReadings,
    selectedReading,
    currentWeek,
    currentWeekObj,
    currentWeekReadings,
    backlogReadings,
    dueReadingReviews,
    dueCards,
    currentCard,
    syllabusProgress,
    totalHours,
    totalQuestions,
    totalCorrect,
    overallAccuracy,
    avgConfidence,
    streak,
    subjectStats,
    examReadiness,
    todayPlan,
    filteredCards,
    planEndDate,
    selectedReadingQuestionSummary,
    recoveryAreas,
    dueTomorrowReadings,
    overdueReadings,
    weekProgress,
    syncingSubject,
    subjectReadingOptions,
    cardReadingOptions,
    selfChecksPassed,
    setStartDate,
    resetStartDateToToday,
    setSelectedSubject,
    setSelectedReadingId,
    setBackendBaseUrl,
    updateReading,
    cycleReadingStatus,
    markReadingStudied,
    setReadingStudyDate,
    setReadingConfidence,
    handleReadingConfidence,
    toggleWeakTag,
    addSession,
    markReadingDone,
    resetSubjectForRevision,
    resetAllForRevision,
    autofillReadingAssets,
    addCard,
    generateCardsFromSelectedReading,
    reviewCard,
    toggleSuspend,
    updateMock,
    updateUpload,
    pickPdf,
    syncSubjectWithAi,
    enableReviewNotifications,
    askPracticeAssistant,
    answerPracticeQuestion,
    resetPracticeAnswers,
    exportBackup,
    importBackup,
  };
}
