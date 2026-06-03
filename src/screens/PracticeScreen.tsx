import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ActionButton, Badge, EmptyState, Panel, ProgressBar, uiStyles } from "../components/ui";
import { colors } from "../theme";
import { Flashcard, FlashcardRating, PracticeDifficulty, PracticeQuestion, Reading, Subject, UploadRecord } from "../types";
import { buildTopicCoverage } from "../utils/coverage";

type PracticeSection = "generate" | "saved" | "review" | "assistant" | "cards";
type ChatMessage = { role: "user" | "assistant"; content: string };

const ASSISTANT_FOLLOW_UPS = ["Explain more simply", "Give a numerical example", "What are the common mistakes here?"];

// Renders inline **bold** spans within a line of assistant text.
function renderInline(text: string, keyPrefix: string) {
  const parts = text.split(/\*\*(.+?)\*\*/g); // odd indices are the bold segments
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <Text key={`${keyPrefix}-b${index}`} style={styles.assistantBold}>
        {part}
      </Text>
    ) : (
      <Text key={`${keyPrefix}-t${index}`}>{part}</Text>
    ),
  );
}

// Lightweight formatter: bold **headings**, "- " bullets, and paragraph spacing,
// so the assistant's answers are scannable instead of one flat block.
function FormattedAnswer({ content }: { content: string }) {
  const lines = content.split(/\n/).map((line) => line.trim());
  return (
    <View style={styles.answerWrap}>
      {lines.map((line, index) => {
        if (!line) return null;
        const heading = line.match(/^\*\*(.+?)\*\*:?$/);
        if (heading) {
          return (
            <Text key={`h-${index}`} style={styles.answerHeading}>
              {heading[1]}
            </Text>
          );
        }
        const bullet = line.match(/^[-•*]\s+(.*)$/);
        if (bullet) {
          return (
            <View key={`bl-${index}`} style={styles.answerBulletRow}>
              <Text style={styles.answerBulletDot}>•</Text>
              <Text style={styles.assistantText}>{renderInline(bullet[1], `bl-${index}`)}</Text>
            </View>
          );
        }
        return (
          <Text key={`p-${index}`} style={styles.assistantText}>
            {renderInline(line, `p-${index}`)}
          </Text>
        );
      })}
    </View>
  );
}

function normalizeDifficultyLabel(value: PracticeDifficulty) {
  if (value === "1") return "Foundational";
  if (value === "2") return "Exam";
  return "Hard";
}

function formatClock(totalSec: number) {
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function generatedSummary(upload: UploadRecord) {
  const set = upload.generatedSet;
  if (!set) return { total: 0, answered: 0, correct: 0, wrong: 0, accuracy: 0 };

  const answered = set.questions.filter((question) => upload.generatedAnswers[question.id]).length;
  const correct = set.questions.filter((question) => {
    const selected = upload.generatedAnswers[question.id];
    return selected && question.answer && selected.trim().toLowerCase() === question.answer.trim().toLowerCase();
  }).length;
  const wrong = set.questions.filter((question) => {
    const selected = upload.generatedAnswers[question.id];
    return selected && question.answer && selected.trim().toLowerCase() !== question.answer.trim().toLowerCase();
  }).length;

  return {
    total: set.questions.length,
    answered,
    correct,
    wrong,
    accuracy: answered ? Math.round((correct / answered) * 100) : 0,
  };
}

export function PracticeScreen({
  uploads,
  readings,
  backendBaseUrl,
  setBackendBaseUrl,
  pickPdf,
  syncSubjectWithAi,
  syncingSubject,
  askPracticeAssistant,
  generatePracticeSet,
  answerGeneratedQuestion,
  saveCurrentPracticeSet,
  openSavedPracticeSet,
  deleteSavedPracticeSet,
  savePracticeQuestion,
  deleteSavedQuestion,
  analyzeGeneratedPractice,
  onRequestFocusBottomField,
  targetSubject,
  targetChapterTitle,
  onConsumeTarget,
  reviewRequest,
  onCompleteReview,
  assistantQuestion,
  setAssistantQuestion,
  assistantMessages,
  setAssistantMessages,
  selectedSubject,
  setSelectedSubject,
  selectedChapter,
  setSelectedChapter,
  flashcards,
  generateChapterFlashcards,
  addChapterCard,
  reviewChapterCard,
  deleteFlashcard,
}: {
  uploads: UploadRecord[];
  readings: Reading[];
  backendBaseUrl: string;
  setBackendBaseUrl: (value: string) => void;
  pickPdf: (subject: Subject, type: "notesPdfName" | "questionBankPdfName") => Promise<boolean>;
  syncSubjectWithAi: (subject: Subject) => Promise<unknown>;
  syncingSubject: Subject | null;
  askPracticeAssistant: (
    subject: Subject,
    question: string,
    extraContext?: Record<string, unknown>,
    history?: { role: "user" | "assistant"; content: string }[],
  ) => Promise<{ answer: string; imageUrl: string }>;
  generatePracticeSet: (
    subject: Subject,
    chapterTitle: string,
    questionCount: number,
    difficulty: PracticeDifficulty,
    options?: { mode?: string; focusTopics?: string[]; baseQuestions?: PracticeQuestion[] },
  ) => Promise<unknown>;
  answerGeneratedQuestion: (subject: Subject, questionId: string, selectedOption: string) => void;
  saveCurrentPracticeSet: (subject: Subject) => void;
  openSavedPracticeSet: (subject: Subject, savedSetId: string) => void;
  deleteSavedPracticeSet: (subject: Subject, savedSetId: string) => void;
  savePracticeQuestion: (subject: Subject, question: PracticeQuestion, options?: { reason?: "bookmark" | "wrong-answer"; chapterTitle?: string; difficulty?: PracticeDifficulty }) => void;
  deleteSavedQuestion: (subject: Subject, questionId: string, bucket: "savedQuestions" | "wrongQuestions") => void;
  analyzeGeneratedPractice: (subject: Subject) => Promise<unknown>;
  onRequestFocusBottomField?: () => void;
  targetSubject?: Subject;
  targetChapterTitle?: string;
  onConsumeTarget?: () => void;
  reviewRequest?: { subject?: Subject; chapterTitle?: string; nonce?: string };
  onCompleteReview?: (subject: Subject, chapterTitle: string, accuracyPercent: number, nudge?: "hard" | "good" | "easy") => void;
  assistantQuestion: string;
  setAssistantQuestion: (value: string) => void;
  assistantMessages: ChatMessage[];
  setAssistantMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  selectedSubject: Subject | null;
  setSelectedSubject: React.Dispatch<React.SetStateAction<Subject | null>>;
  selectedChapter: string;
  setSelectedChapter: React.Dispatch<React.SetStateAction<string>>;
  flashcards: Flashcard[];
  generateChapterFlashcards: (subject: Subject, chapterTitle: string) => Promise<number>;
  addChapterCard: (subject: Subject, chapterTitle: string, front: string, back: string, cardType?: Flashcard["cardType"]) => void;
  reviewChapterCard: (cardId: string, rating: FlashcardRating) => void;
  deleteFlashcard: (cardId: string) => void;
}) {
  const parsedSubjects = uploads.filter((upload) => upload.parsedChapters.length > 0);
  const [questionCount, setQuestionCount] = useState("10");
  const [difficulty, setDifficulty] = useState<PracticeDifficulty>("1");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showUploads, setShowUploads] = useState(false);
  const [showCoverageTopics, setShowCoverageTopics] = useState(false);
  const [showSubjectPicker, setShowSubjectPicker] = useState(false);
  const [showChapterPicker, setShowChapterPicker] = useState(false);
  const [showSetOptions, setShowSetOptions] = useState(false);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeSection, setActiveSection] = useState<PracticeSection>("generate");
  const [returnQuestionId, setReturnQuestionId] = useState("");
  const [highlightedQuestionId, setHighlightedQuestionId] = useState("");
  const [practiceMode, setPracticeMode] = useState<"practice" | "test">("practice");
  const [submitted, setSubmitted] = useState(false);
  const [guessed, setGuessed] = useState<Record<string, boolean>>({});
  const [elapsedSec, setElapsedSec] = useState(0);
  const [revealedCards, setRevealedCards] = useState<Record<string, boolean>>({});
  const [cardFront, setCardFront] = useState("");
  const [cardBack, setCardBack] = useState("");
  const [makingCards, setMakingCards] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [reviewContext, setReviewContext] = useState<{ subject: Subject; chapterTitle: string } | null>(null);
  const [reviewScheduled, setReviewScheduled] = useState(false);
  const handledReviewNonce = useRef("");

  useEffect(() => {
    if (!selectedSubject && parsedSubjects[0]) {
      setSelectedSubject(parsedSubjects[0].subject);
    }
  }, [parsedSubjects, selectedSubject]);

  useEffect(() => {
    if (!targetSubject) return;
    setSelectedSubject(targetSubject);
    setActiveSection("generate");
  }, [targetSubject]);

  const activeUpload = uploads.find((upload) => upload.subject === selectedSubject) || null;

  useEffect(() => {
    if (targetChapterTitle && activeUpload?.parsedChapters.some((chapter) => chapter.readingTitle === targetChapterTitle)) {
      setSelectedChapter(targetChapterTitle);
      setActiveSection("generate");
      onConsumeTarget?.();
      return;
    }
    if (!activeUpload) {
      setSelectedChapter("");
      return;
    }
    if (!selectedChapter || !activeUpload.parsedChapters.some((chapter) => chapter.readingTitle === selectedChapter)) {
      setSelectedChapter(activeUpload.parsedChapters[0]?.readingTitle || "");
    }
  }, [activeUpload, onConsumeTarget, selectedChapter, targetChapterTitle]);

  const currentSetId = activeUpload?.generatedSet?.id || "";

  // Reset the timer, guesses and submitted state whenever a different set loads.
  useEffect(() => {
    setSubmitted(false);
    setGuessed({});
    setElapsedSec(0);
  }, [currentSetId]);

  // Tick the practice clock while a set is open and not yet submitted.
  useEffect(() => {
    if (!currentSetId || submitted) return;
    const timer = setInterval(() => setElapsedSec((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [currentSetId, submitted]);

  // When a review quiz is launched from the Overview screen, auto-start it once.
  useEffect(() => {
    const nonce = reviewRequest?.nonce;
    const subject = reviewRequest?.subject;
    const chapterTitle = reviewRequest?.chapterTitle;
    if (!nonce || !subject || !chapterTitle) return;
    if (handledReviewNonce.current === nonce) return;
    handledReviewNonce.current = nonce;
    setSelectedSubject(subject);
    setActiveSection("generate");
    setPracticeMode("test");
    void startReviewQuiz(subject, chapterTitle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewRequest?.nonce]);

  const generatedStats = useMemo(() => (activeUpload ? generatedSummary(activeUpload) : { total: 0, answered: 0, correct: 0, wrong: 0, accuracy: 0 }), [activeUpload]);
  const activeParsedChapter = activeUpload?.parsedChapters.find((chapter) => chapter.readingTitle === selectedChapter) || null;
  const chapterCoverage = useMemo(() => buildTopicCoverage(activeUpload || undefined, selectedChapter), [activeUpload, selectedChapter]);
  const activeReading = readings.find((reading) => reading.subject === selectedSubject && reading.title === selectedChapter) || null;
  const chapterCards = useMemo(
    () => flashcards.filter((card) => card.topic === selectedSubject && card.readingTitle === selectedChapter),
    [flashcards, selectedSubject, selectedChapter],
  );
  const wrongGeneratedQuestions = activeUpload?.generatedSet
    ? activeUpload.generatedSet.questions.filter((question) => {
        const selected = activeUpload.generatedAnswers[question.id];
        return selected && question.answer && selected.trim().toLowerCase() !== question.answer.trim().toLowerCase();
      })
    : [];
  const setQuestions = activeUpload?.generatedSet?.questions || [];
  // In Test mode we hide correctness until the user submits; Practice mode reveals instantly.
  const revealed = practiceMode === "practice" || submitted;
  const guessedRightCount = setQuestions.filter((question) => {
    const selected = activeUpload?.generatedAnswers[question.id];
    const isCorrect = selected && question.answer ? selected.trim().toLowerCase() === question.answer.trim().toLowerCase() : false;
    return isCorrect && guessed[question.id];
  }).length;
  const targetSec = setQuestions.length * 90;

  function toggleGuess(questionId: string) {
    setGuessed((current) => ({ ...current, [questionId]: !current[questionId] }));
  }

  const chapterHistory = useMemo(
    () => activeUpload?.practiceHistory.filter((entry) => entry.chapterTitle === selectedChapter) || [],
    [activeUpload?.practiceHistory, selectedChapter],
  );
  const historyByDifficulty = useMemo(
    () =>
      (["1", "2"] as PracticeDifficulty[]).map((level) => {
        const rows = chapterHistory.filter((entry) => entry.difficulty === level);
        return {
          difficulty: level,
          attempted: rows.reduce((sum, entry) => sum + entry.attempted, 0),
          correct: rows.reduce((sum, entry) => sum + entry.correct, 0),
          wrong: rows.reduce((sum, entry) => sum + entry.wrong, 0),
        };
      }),
    [chapterHistory],
  );
  const savedSetsForChapter = useMemo(
    () => activeUpload?.savedSets.filter((entry) => entry.chapterTitle === selectedChapter) || [],
    [activeUpload?.savedSets, selectedChapter],
  );
  const savedBookmarksForChapter = useMemo(
    () => activeUpload?.savedQuestions.filter((entry) => entry.chapterTitle === selectedChapter) || [],
    [activeUpload?.savedQuestions, selectedChapter],
  );
  const wrongQuestionLibrary = useMemo(
    () => activeUpload?.wrongQuestions.filter((entry) => entry.chapterTitle === selectedChapter) || [],
    [activeUpload?.wrongQuestions, selectedChapter],
  );
  async function handlePick(subject: Subject, type: "notesPdfName" | "questionBankPdfName") {
    try {
      await pickPdf(subject, type);
    } catch {
      Alert.alert("Picker failed", "I could not open the document picker on this device.");
    }
  }

  async function handleSync(subject: Subject) {
    try {
      await syncSubjectWithAi(subject);
      Alert.alert("AI sync complete", `${subject} is ready for generated practice sets now.`);
    } catch (error) {
      Alert.alert("AI sync failed", error instanceof Error ? error.message : "The backend sync did not complete.");
    }
  }

  async function handleGeneratePractice(options?: { mode?: string; focusTopics?: string[]; baseQuestions?: PracticeQuestion[]; count?: number }) {
    if (!selectedSubject || !selectedChapter) return;
    // A manual generate is not a review session.
    setReviewContext(null);
    setReviewScheduled(false);
    try {
      setGenerating(true);
      await generatePracticeSet(selectedSubject, selectedChapter, options?.count || Number(questionCount || 10), difficulty, {
        mode: options?.mode,
        focusTopics: options?.focusTopics,
        baseQuestions: options?.baseQuestions,
      });
      setActiveSection("generate");
      setHighlightedQuestionId("");
      Alert.alert("Practice set ready", "Your new question set is ready below.");
    } catch (error) {
      Alert.alert("Generation failed", error instanceof Error ? error.message : "The practice set could not be created.");
    } finally {
      setGenerating(false);
    }
  }

  // Collects the candidate's weak spots for a chapter so the review quiz targets them.
  function buildReviewFocusTopics(upload: UploadRecord, chapterTitle: string) {
    const fromWrong = upload.wrongQuestions
      .filter((entry) => entry.chapterTitle === chapterTitle)
      .flatMap((entry) => (entry.question.tags && entry.question.tags.length ? entry.question.tags : [entry.question.question]));
    const parsed = upload.parsedChapters.find((chapter) => chapter.readingTitle === chapterTitle);
    const fromTraps = parsed?.commonTraps || [];
    return Array.from(new Set([...fromWrong, ...fromTraps].filter(Boolean))).slice(0, 8);
  }

  // Launches a short, high-yield, exam-weighted retention quiz for a chapter.
  async function startReviewQuiz(subject: Subject, chapterTitle: string) {
    const upload = uploads.find((item) => item.subject === subject);
    const parsed = upload?.parsedChapters.find((chapter) => chapter.readingTitle === chapterTitle);
    if (!upload || !parsed) {
      setReviewContext(null);
      Alert.alert(
        "Pick the chapter",
        `I couldn't match "${chapterTitle}" to your synced material for ${subject}. Open the chapter below and tap Create practice set.`,
      );
      return;
    }
    setSelectedChapter(chapterTitle);
    setReviewContext({ subject, chapterTitle });
    setReviewScheduled(false);
    setDifficulty("2");
    const losCount = parsed.losChecklist?.length || 0;
    const count = Math.max(8, Math.min(15, losCount ? Math.round(losCount * 1.5) : 10));
    const focusTopics = buildReviewFocusTopics(upload, chapterTitle);
    try {
      setGenerating(true);
      await generatePracticeSet(subject, chapterTitle, count, "2", { mode: "review-focus", focusTopics });
      setActiveSection("generate");
      setHighlightedQuestionId("");
    } catch (error) {
      setReviewContext(null);
      Alert.alert("Couldn't start review", error instanceof Error ? error.message : "The review quiz could not be created.");
    } finally {
      setGenerating(false);
    }
  }

  // Closes the review loop: turns the quiz score into a confidence update + reschedule.
  function finishReview(nudge: "hard" | "good" | "easy") {
    if (!reviewContext) return;
    const accuracy = generatedStats.total ? Math.round((generatedStats.correct / generatedStats.total) * 100) : 0;
    onCompleteReview?.(reviewContext.subject, reviewContext.chapterTitle, accuracy, nudge);
    setReviewScheduled(true);
  }

  async function handleAnalyzePractice() {
    if (!selectedSubject) return;
    try {
      setAnalyzing(true);
      await analyzeGeneratedPractice(selectedSubject);
      setActiveSection("review");
      Alert.alert("Review ready", "Your weak-topic summary and study examples are ready below.");
    } catch (error) {
      Alert.alert("Analysis failed", error instanceof Error ? error.message : "The practice review could not be created.");
    } finally {
      setAnalyzing(false);
    }
  }

  // Unified conversational ask: append the question, call the assistant with prior
  // turns as context, then append the answer to the thread.
  async function askAssistant(promptText: string, extraContext?: Record<string, unknown>) {
    const text = String(promptText).trim();
    if (!selectedSubject || !text) return;
    const history = assistantMessages;
    setAssistantMessages((prev) => [...prev, { role: "user", content: text }]);
    setAssistantQuestion("");
    setActiveSection("assistant");
    try {
      setAssistantLoading(true);
      const result = await askPracticeAssistant(
        selectedSubject,
        text,
        { chapterTitle: selectedChapter, generatedReview: activeUpload?.generatedReview, confidence: activeReading?.confidence || 0, ...extraContext },
        history.map((message) => ({ role: message.role, content: message.content })),
      );
      setAssistantMessages((prev) => [...prev, { role: "assistant", content: result.answer }]);
    } catch (error) {
      Alert.alert("Assistant failed", error instanceof Error ? error.message : "The assistant could not answer right now.");
    } finally {
      setAssistantLoading(false);
    }
  }

  function explainWrongAnswer(question: PracticeQuestion) {
    const selected = activeUpload?.generatedAnswers[question.id] || "";
    if (!selectedSubject || !selected) return;
    setReturnQuestionId(question.id);
    setHighlightedQuestionId(question.id);
    void askAssistant(`Explain why my answer was wrong in: ${question.question}`, {
      mode: "explain-wrong-answer",
      wrongQuestion: question,
      selectedAnswer: selected,
    });
  }

  function startAssistantQuizFromChapter() {
    if (!selectedSubject || !selectedChapter) return;
    void startReviewQuiz(selectedSubject, selectedChapter);
  }

  async function handleMakeCards() {
    if (!selectedSubject || !selectedChapter) return;
    try {
      setMakingCards(true);
      const count = await generateChapterFlashcards(selectedSubject, selectedChapter);
      Alert.alert("Flashcards ready", `Added ${count} cards for ${selectedChapter}.`);
    } catch (error) {
      Alert.alert("Couldn't make cards", error instanceof Error ? error.message : "Flashcard generation failed.");
    } finally {
      setMakingCards(false);
    }
  }

  function handleAddCard() {
    if (!selectedSubject || !selectedChapter || !cardFront.trim() || !cardBack.trim()) return;
    addChapterCard(selectedSubject, selectedChapter, cardFront, cardBack);
    setCardFront("");
    setCardBack("");
    setShowAddCard(false);
  }

  function handleRateCard(cardId: string, rating: FlashcardRating) {
    reviewChapterCard(cardId, rating);
    setRevealedCards((current) => ({ ...current, [cardId]: false }));
  }

  function handleSaveCurrentSet() {
    if (!selectedSubject || !activeUpload?.generatedSet) return;
    saveCurrentPracticeSet(selectedSubject);
    Alert.alert("Saved", "This practice set is now in Saved sets.");
  }

  function handleBookmarkQuestion(question: PracticeQuestion) {
    if (!selectedSubject) return;
    savePracticeQuestion(selectedSubject, question, {
      reason: "bookmark",
      chapterTitle: selectedChapter,
      difficulty,
    });
    Alert.alert("Saved", "Question added to your saved questions.");
  }

  function jumpBackToQuestion() {
    setActiveSection("generate");
  }

  function sectionButton(section: PracticeSection, label: string) {
    return (
      <Pressable key={section} style={[styles.sectionChip, activeSection === section && styles.sectionChipActive]} onPress={() => setActiveSection(section)}>
        <Text style={[styles.sectionChipText, activeSection === section && styles.sectionChipTextActive]}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <>
      <View style={styles.sectionSwitch}>
        {sectionButton("generate", "Generate")}
        {sectionButton("saved", "Saved")}
        {sectionButton("review", "Review")}
        {sectionButton("cards", "Cards")}
        {sectionButton("assistant", "Assistant")}
      </View>

      {activeSection === "generate" ? (
        <>
          <Panel title="Generate practice set" icon="create-outline">
            {parsedSubjects.length ? (
              <>
                <Text style={styles.sectionLabel}>Subject</Text>
                <Pressable style={styles.pickerHeader} onPress={() => setShowSubjectPicker((current) => !current)}>
                  <Text style={styles.subjectPickerHeaderText} numberOfLines={1}>
                    {selectedSubject || "Select a subject"}
                  </Text>
                  <Text style={styles.pickerChevron}>{showSubjectPicker ? "▴" : "▾"}</Text>
                </Pressable>
                {showSubjectPicker ? (
                  <View style={styles.chapterList}>
                    {parsedSubjects.map((upload) => {
                      const selected = selectedSubject === upload.subject;
                      return (
                        <Pressable
                          key={upload.subject}
                          style={[styles.chapterListRow, selected && styles.chapterListRowActive]}
                          onPress={() => {
                            setSelectedSubject(upload.subject);
                            setShowSubjectPicker(false);
                          }}
                        >
                          <Text style={[styles.chapterListTitle, selected && styles.chapterListTitleActive]} numberOfLines={1}>
                            {upload.subject}
                          </Text>
                          <Badge text={`${upload.parsedChapters.length} ch`} tone="neutral" />
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}

                {activeUpload ? (
                  <>
                    <Text style={styles.sectionLabel}>Chapter</Text>
                    <Pressable style={styles.pickerHeader} onPress={() => setShowChapterPicker((current) => !current)}>
                      <Text style={styles.pickerHeaderText} numberOfLines={1}>
                        {selectedChapter
                          ? `${activeUpload.parsedChapters.findIndex((chapter) => chapter.readingTitle === selectedChapter) + 1}. ${selectedChapter}`
                          : "Select a chapter"}
                      </Text>
                      <Text style={styles.pickerChevron}>{showChapterPicker ? "▴" : "▾"}</Text>
                    </Pressable>
                    {showChapterPicker ? (
                      <View style={styles.chapterList}>
                        {activeUpload.parsedChapters.map((chapter, index) => {
                          const coverage = buildTopicCoverage(activeUpload, chapter.readingTitle);
                          const selected = selectedChapter === chapter.readingTitle;
                          return (
                            <Pressable
                              key={chapter.id}
                              style={[styles.chapterListRow, selected && styles.chapterListRowActive]}
                              onPress={() => {
                                setSelectedChapter(chapter.readingTitle);
                                setShowChapterPicker(false);
                              }}
                            >
                              <Text style={styles.chapterListNum}>{index + 1}</Text>
                              <Text style={[styles.chapterListTitle, selected && styles.chapterListTitleActive]} numberOfLines={2}>
                                {chapter.readingTitle}
                              </Text>
                              {coverage.total ? (
                                <Badge
                                  text={`${coverage.percent}%`}
                                  tone={coverage.percent >= 80 ? "success" : coverage.percent >= 40 ? "accent" : "neutral"}
                                />
                              ) : null}
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}

                    {activeParsedChapter && chapterCoverage.total ? (
                      <View style={styles.summaryCard}>
                        <Text style={styles.cardTitle}>Chapter coverage</Text>
                        <Text style={styles.metaText}>
                          {chapterCoverage.solid}/{chapterCoverage.total} topics solid · {chapterCoverage.percent}%
                        </Text>
                        <ProgressBar progress={chapterCoverage.percent} />
                        <View style={styles.inlineRow}>
                          {chapterCoverage.untestedTopics.length ? (
                            <ActionButton
                              label={`Practice untested (${chapterCoverage.untestedTopics.length})`}
                              icon="add-circle-outline"
                              onPress={() => void handleGeneratePractice({ mode: "review-focus", focusTopics: chapterCoverage.untestedTopics })}
                              compact
                            />
                          ) : null}
                          {chapterCoverage.weakTopics.length ? (
                            <ActionButton
                              label={`Drill weak (${chapterCoverage.weakTopics.length})`}
                              icon="barbell-outline"
                              onPress={() => void handleGeneratePractice({ mode: "weak-topics-retry", focusTopics: chapterCoverage.weakTopics })}
                              compact
                            />
                          ) : null}
                          <Pressable style={styles.guessChip} onPress={() => setShowCoverageTopics((current) => !current)}>
                            <Text style={styles.guessChipText}>{showCoverageTopics ? "Hide topics" : "See topics"}</Text>
                          </Pressable>
                        </View>
                        {showCoverageTopics ? (
                          <View style={styles.badgeWrap}>
                            {chapterCoverage.topics.map((entry) => (
                              <Badge
                                key={entry.topic}
                                text={entry.topic}
                                tone={entry.status === "solid" ? "success" : entry.status === "weak" ? "warning" : "neutral"}
                              />
                            ))}
                          </View>
                        ) : null}
                      </View>
                    ) : null}

                    <View style={styles.configCard}>
                      <Pressable style={styles.advancedHeader} onPress={() => setShowSetOptions((current) => !current)}>
                        <Text style={styles.cardTitle}>Options</Text>
                        <Badge
                          text={`${questionCount || "10"} Q · ${normalizeDifficultyLabel(difficulty)} · ${practiceMode === "test" ? "Test" : "Practice"}`}
                          tone="accent"
                        />
                      </Pressable>
                      {showSetOptions ? (
                        <>
                          <Text style={styles.sectionLabel}>How many questions?</Text>
                          <TextInput
                            value={questionCount}
                            onChangeText={setQuestionCount}
                            style={uiStyles.input}
                            keyboardType="numeric"
                            placeholder="10"
                            placeholderTextColor={colors.inkSoft}
                          />
                          <Text style={styles.sectionLabel}>Difficulty</Text>
                          <View style={styles.inlineRow}>
                            {(["1", "2"] as PracticeDifficulty[]).map((level) => (
                              <Pressable key={level} style={[styles.levelChip, difficulty === level && styles.levelChipActive]} onPress={() => setDifficulty(level)}>
                                <Text style={[styles.levelChipText, difficulty === level && styles.levelChipTextActive]}>{normalizeDifficultyLabel(level)}</Text>
                              </Pressable>
                            ))}
                          </View>
                          <Text style={styles.sectionLabel}>Mode</Text>
                          <View style={styles.inlineRow}>
                            {(["practice", "test"] as const).map((mode) => (
                              <Pressable key={mode} style={[styles.levelChip, practiceMode === mode && styles.levelChipActive]} onPress={() => setPracticeMode(mode)}>
                                <Text style={[styles.levelChipText, practiceMode === mode && styles.levelChipTextActive]}>
                                  {mode === "practice" ? "Practice · instant feedback" : "Test · score at the end"}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        </>
                      ) : null}
                    </View>

                    <ActionButton label={generating ? "Generating..." : "Create practice set"} icon="flash-outline" onPress={() => void handleGeneratePractice()} />
                  </>
                ) : null}
              </>
            ) : (
              <EmptyState text="Sync at least one subject with AI first." />
            )}
          </Panel>

          <Panel title="Current set" icon="list-outline">
            {activeUpload?.generatedSet ? (
              <View style={styles.generatedWrap}>
                <View style={styles.summaryCard}>
                  <Text style={styles.cardTitle}>{activeUpload.generatedSet.chapterTitle}</Text>
                  <Text style={styles.metaText}>
                    {activeUpload.generatedSet.questionCount} questions · {normalizeDifficultyLabel(activeUpload.generatedSet.difficulty)} · {practiceMode === "test" ? "Test mode" : "Practice mode"}
                  </Text>
                  {reviewContext ? <Text style={styles.metaText}>Review quiz · high-yield + your weak spots</Text> : null}
                  <View style={styles.badgeWrap}>
                    {reviewContext ? <Badge text="Review quiz" tone="primary" /> : null}
                    <Badge text={`⏱ ${formatClock(elapsedSec)}`} tone={practiceMode === "test" && elapsedSec > targetSec ? "danger" : "neutral"} />
                    {practiceMode === "test" ? <Badge text={`Target ${formatClock(targetSec)}`} tone="accent" /> : null}
                    <Badge text={`Answered ${generatedStats.answered}/${generatedStats.total}`} tone="accent" />
                    {revealed ? (
                      <>
                        <Badge text={`Correct ${generatedStats.correct}`} tone="success" />
                        <Badge text={`Wrong ${generatedStats.wrong}`} tone="danger" />
                        <Badge text={`Accuracy ${generatedStats.accuracy}%`} tone="warning" />
                      </>
                    ) : null}
                  </View>

                  {practiceMode === "test" && !submitted ? (
                    <ActionButton
                      label={`Submit ${reviewContext ? "review" : "test"} (${generatedStats.answered}/${generatedStats.total} answered)`}
                      icon="checkmark-done-outline"
                      onPress={() => {
                        setSubmitted(true);
                        // A review quiz settles its review automatically on submit (score-based).
                        if (reviewContext) finishReview("good");
                      }}
                    />
                  ) : null}

                  {practiceMode === "test" && submitted ? (
                    <View style={styles.feedbackCard}>
                      <Text style={styles.feedbackTitle}>Test result</Text>
                      <Text style={styles.feedbackLine}>
                        Score {generatedStats.correct}/{generatedStats.total} · {generatedStats.accuracy}% accuracy
                      </Text>
                      <Text style={styles.feedbackLine}>
                        Time {formatClock(elapsedSec)} · pace {generatedStats.answered ? formatClock(Math.round(elapsedSec / generatedStats.answered)) : "0:00"}/question (exam target 1:30)
                      </Text>
                      {guessedRightCount ? (
                        <Text style={styles.feedbackLine}>
                          {guessedRightCount} correct {guessedRightCount === 1 ? "answer was" : "answers were"} flagged as a guess — treat {guessedRightCount === 1 ? "it" : "them"} as a weak spot to revisit.
                        </Text>
                      ) : null}
                    </View>
                  ) : null}

                  {reviewContext && submitted ? (
                    <View style={styles.summaryCard}>
                      <Text style={styles.feedbackTitle}>✓ Review done — next date set from your score.</Text>
                      <Text style={styles.metaText}>Felt different? Adjust when this chapter comes back:</Text>
                      <View style={styles.inlineRow}>
                        <Pressable style={styles.levelChip} onPress={() => finishReview("hard")}>
                          <Text style={styles.levelChipText}>Tougher · sooner</Text>
                        </Pressable>
                        <Pressable style={styles.levelChip} onPress={() => finishReview("easy")}>
                          <Text style={styles.levelChipText}>Easier · later</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : null}

                  <View style={styles.inlineRow}>
                    <ActionButton label="Save this set" icon="bookmark-outline" onPress={handleSaveCurrentSet} compact />
                    <ActionButton label={analyzing ? "Building review..." : "Analyze my weak areas"} icon="analytics-outline" onPress={() => void handleAnalyzePractice()} compact />
                  </View>
                </View>

                {activeUpload.generatedSet.questions.map((question, index) => {
                  const selected = activeUpload.generatedAnswers[question.id];
                  const isCorrect = selected && question.answer ? selected.trim().toLowerCase() === question.answer.trim().toLowerCase() : false;
                  // Practice mode reveals as soon as you answer; Test mode hides everything until submit.
                  const showAnswer = practiceMode === "test" ? submitted : Boolean(selected);
                  return (
                    <View key={question.id} style={[styles.questionCard, highlightedQuestionId === question.id && styles.questionCardHighlighted]}>
                      <Text style={styles.questionTitle}>
                        Q{index + 1}. {question.question}
                      </Text>
                      <View style={styles.optionWrap}>
                        {question.options.map((option) => {
                          const chosen = selected === option;
                          const revealCorrect = showAnswer && Boolean(question.answer && option.trim().toLowerCase() === question.answer.trim().toLowerCase());
                          return (
                            <Pressable
                              key={option}
                              style={[styles.optionButton, chosen && styles.optionButtonSelected, revealCorrect && styles.optionButtonCorrect]}
                              onPress={() => activeUpload && answerGeneratedQuestion(activeUpload.subject, question.id, option)}
                            >
                              <Text style={[styles.optionText, chosen && styles.optionTextSelected, revealCorrect && styles.optionTextCorrect]}>{option}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      <View style={styles.inlineRow}>
                        <ActionButton label="Save question" icon="bookmark-outline" onPress={() => handleBookmarkQuestion(question)} compact />
                        {selected ? (
                          <Pressable
                            style={[styles.guessChip, guessed[question.id] && styles.guessChipActive]}
                            onPress={() => toggleGuess(question.id)}
                          >
                            <Text style={[styles.guessChipText, guessed[question.id] && styles.guessChipTextActive]}>
                              {guessed[question.id] ? "Marked as guess" : "I guessed"}
                            </Text>
                          </Pressable>
                        ) : null}
                        {showAnswer && !isCorrect && selected && question.answer ? (
                          <ActionButton label="Explain why wrong" icon="help-circle-outline" onPress={() => void explainWrongAnswer(question)} compact />
                        ) : null}
                      </View>
                      {showAnswer && selected ? (
                        <View style={styles.feedbackCard}>
                          <Text style={styles.feedbackTitle}>{question.answer ? (isCorrect ? "Correct" : "Needs review") : "Saved answer"}</Text>
                          {question.answer ? <Text style={styles.feedbackLine}>Answer: {question.answer}</Text> : null}
                          {question.explanation ? <Text style={styles.feedbackLine}>{question.explanation}</Text> : null}
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : (
              <EmptyState text="Generate a practice set first." />
            )}
          </Panel>

          <Panel title="Upload source material" icon="folder-open-outline">
            <Pressable style={styles.advancedHeader} onPress={() => setShowUploads((current) => !current)}>
              <Text style={styles.cardTitle}>Notes and question bank</Text>
              <Badge text={showUploads ? "Hide" : "Show"} tone="accent" />
            </Pressable>
            {showUploads ? (
              <View style={styles.uploadStack}>
                {uploads.map((upload) => (
                  <View key={upload.subject} style={styles.sourceCard}>
                    <View style={styles.sourceHeader}>
                      <View style={styles.flex}>
                        <Text style={styles.cardTitle}>{upload.subject}</Text>
                        <Text style={styles.metaText}>
                          {upload.parsedChapters.length ? `${upload.parsedChapters.length} chapters ready` : "Upload both files, then sync with AI"}
                        </Text>
                      </View>
                      <Badge text={upload.uploadStatus} tone={upload.uploadStatus === "Parsed with AI" ? "success" : upload.uploadStatus === "AI sync failed" ? "danger" : "neutral"} />
                    </View>
                    <View style={styles.inlineRow}>
                      <ActionButton label={upload.notesPdfName || "Add notes"} icon="document-outline" onPress={() => handlePick(upload.subject, "notesPdfName")} compact />
                      <ActionButton label={upload.questionBankPdfName || "Add Q-bank"} icon="albums-outline" onPress={() => handlePick(upload.subject, "questionBankPdfName")} compact />
                      {upload.readyForReview ? (
                        <ActionButton label={syncingSubject === upload.subject ? "Syncing..." : "Sync with AI"} icon="sparkles-outline" onPress={() => void handleSync(upload.subject)} compact />
                      ) : null}
                    </View>
                    {upload.aiError ? <Text style={styles.errorText}>Error: {upload.aiError}</Text> : null}
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.metaText}>Keep this closed while practicing so the screen stays clean.</Text>
            )}
          </Panel>

          <Panel title="Advanced" icon="settings-outline">
            <Pressable style={styles.advancedHeader} onPress={() => setShowAdvanced((current) => !current)}>
              <Text style={styles.cardTitle}>Backend connection</Text>
              <Badge text={showAdvanced ? "Hide" : "Show"} tone="accent" />
            </Pressable>
            {showAdvanced ? (
              <View style={styles.summaryCard}>
                <Text style={styles.metaText}>Keep this collapsed so the backend URL does not get changed by accident.</Text>
                <TextInput
                  value={backendBaseUrl}
                  onChangeText={setBackendBaseUrl}
                  onFocus={onRequestFocusBottomField}
                  style={uiStyles.input}
                  placeholder="https://your-backend.onrender.com"
                  placeholderTextColor={colors.inkSoft}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            ) : null}
          </Panel>
        </>
      ) : null}

      {activeSection === "saved" ? (
        <>
          <Panel title="Saved sets" icon="bookmark-outline">
            {selectedSubject && savedSetsForChapter.length ? (
              <View style={styles.stack}>
                {savedSetsForChapter.map((savedSet) => (
                  <View key={savedSet.id} style={styles.summaryCard}>
                    <Text style={styles.cardTitle}>{savedSet.chapterTitle}</Text>
                    <Text style={styles.metaText}>
                      {savedSet.questionCount} questions · {normalizeDifficultyLabel(savedSet.difficulty)} · Saved {savedSet.savedAt}
                    </Text>
                    <View style={styles.inlineRow}>
                      <ActionButton
                        label="Open"
                        icon="open-outline"
                        onPress={() => {
                          openSavedPracticeSet(selectedSubject, savedSet.id);
                          setDifficulty(savedSet.difficulty);
                          setSelectedChapter(savedSet.chapterTitle);
                          setActiveSection("generate");
                        }}
                        compact
                      />
                      <ActionButton label="Delete" icon="trash-outline" onPress={() => deleteSavedPracticeSet(selectedSubject, savedSet.id)} compact />
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState text="No saved sets for this chapter yet." />
            )}
          </Panel>

          <Panel title="Saved questions" icon="library-outline">
            {selectedSubject && savedBookmarksForChapter.length ? (
              <View style={styles.stack}>
                {savedBookmarksForChapter.map((item) => (
                  <View key={item.id} style={styles.questionCard}>
                    <Text style={styles.questionTitle}>{item.question.question}</Text>
                    <Text style={styles.metaText}>Saved {item.savedAt}</Text>
                    <View style={styles.inlineRow}>
                      <ActionButton
                        label="Ask assistant"
                        icon="chatbubble-ellipses-outline"
                        onPress={() => {
                          setReturnQuestionId("");
                          setHighlightedQuestionId("");
                          void askAssistant(`Help me revise this saved question: ${item.question.question}`, {
                            mode: "saved-question-help",
                            savedQuestion: item.question,
                            chapterTitle: item.chapterTitle,
                          });
                        }}
                        compact
                      />
                      <ActionButton label="Delete" icon="trash-outline" onPress={() => deleteSavedQuestion(selectedSubject, item.id, "savedQuestions")} compact />
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState text="Bookmark questions from a practice set to revisit them here." />
            )}
          </Panel>
        </>
      ) : null}

      {activeSection === "review" ? (
        <>
          <Panel title="Review summary" icon="reader-outline">
            {activeUpload?.generatedReview ? (
              <View style={styles.summaryCard}>
                <Text style={styles.cardTitle}>What to study next</Text>
                <Text style={styles.metaText}>{activeUpload.generatedReview.summary}</Text>
                {activeUpload.generatedReview.reviseTopics.length ? (
                  <View style={styles.badgeWrap}>
                    {activeUpload.generatedReview.reviseTopics.map((topic) => (
                      <Badge key={topic} text={topic} tone="accent" />
                    ))}
                  </View>
                ) : null}
                {activeUpload.generatedReview.conceptExample ? (
                  <View style={styles.exampleCard}>
                    <Text style={styles.exampleTitle}>Concept example</Text>
                    <Text style={styles.metaText}>{activeUpload.generatedReview.conceptExample}</Text>
                  </View>
                ) : null}
                {activeUpload.generatedReview.numericalExample ? (
                  <View style={styles.exampleCard}>
                    <Text style={styles.exampleTitle}>Numerical example</Text>
                    <Text style={styles.metaText}>{activeUpload.generatedReview.numericalExample}</Text>
                  </View>
                ) : null}
                <View style={styles.inlineRow}>
                  <ActionButton
                    label={generating ? "Working..." : "Generate 5 similar"}
                    icon="repeat-outline"
                    onPress={() =>
                      void handleGeneratePractice({
                        mode: "similar-questions",
                        focusTopics: activeUpload.generatedReview?.reviseTopics || [],
                        baseQuestions: wrongGeneratedQuestions.slice(0, 5),
                        count: 5,
                      })
                    }
                    compact
                  />
                  <ActionButton
                    label={generating ? "Working..." : "Retry weak topics"}
                    icon="refresh-outline"
                    onPress={() =>
                      void handleGeneratePractice({
                        mode: "weak-topics-retry",
                        focusTopics: activeUpload.generatedReview?.reviseTopics || [],
                        baseQuestions: wrongGeneratedQuestions,
                      })
                    }
                    compact
                  />
                </View>
              </View>
            ) : (
              <EmptyState text="Finish a generated set, then analyze it to get your weak-topic study summary." />
            )}
          </Panel>

          <Panel title="Wrong questions" icon="warning-outline">
            {selectedSubject && wrongQuestionLibrary.length ? (
              <View style={styles.stack}>
                {wrongQuestionLibrary.map((item) => (
                  <View key={item.id} style={styles.questionCard}>
                    <Text style={styles.questionTitle}>{item.question.question}</Text>
                    <Text style={styles.metaText}>
                      {normalizeDifficultyLabel(item.difficulty)} · Your answer: {item.selectedAnswer || "Not saved"}
                    </Text>
                    <View style={styles.inlineRow}>
                      <ActionButton
                        label="Explain"
                        icon="help-circle-outline"
                        onPress={() => {
                          setReturnQuestionId("");
                          void askAssistant(`Explain why this answer was wrong: ${item.question.question}`, {
                            mode: "wrong-library-help",
                            wrongQuestion: item.question,
                            selectedAnswer: item.selectedAnswer,
                            chapterTitle: item.chapterTitle,
                          });
                        }}
                        compact
                      />
                      <ActionButton label="Delete" icon="trash-outline" onPress={() => deleteSavedQuestion(selectedSubject, item.id, "wrongQuestions")} compact />
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState text="Wrong questions from analyzed sets will collect here for later retry." />
            )}
          </Panel>
        </>
      ) : null}

      {activeSection === "assistant" ? (
        <Panel title="Study assistant" icon="chatbubble-ellipses-outline">
          {selectedSubject ? (
            <>
              <View style={styles.assistantHeaderRow}>
                <Text style={styles.assistantFocus} numberOfLines={1}>
                  Focused on: {selectedChapter || selectedSubject}
                </Text>
                {assistantMessages.length ? (
                  <Pressable onPress={() => setAssistantMessages([])}>
                    <Badge text="Clear chat" tone="neutral" />
                  </Pressable>
                ) : null}
              </View>
              {returnQuestionId ? (
                <View style={styles.inlineRow}>
                  <ActionButton label="Back to question" icon="arrow-back-outline" onPress={jumpBackToQuestion} compact />
                </View>
              ) : null}

              {assistantMessages.length === 0 ? (
                <View style={styles.summaryCard}>
                  <Text style={styles.copy}>Ask anything about this chapter — it answers from your material and remembers the conversation. Try a starter:</Text>
                  <View style={styles.inlineRow}>
                    <ActionButton
                      label="Explain this simply"
                      icon="bulb-outline"
                      onPress={() => void askAssistant(`Explain the most important ideas in ${selectedChapter || selectedSubject} as simply as possible, with one short everyday analogy.`)}
                      compact
                    />
                    <ActionButton
                      label="Key formulas"
                      icon="calculator-outline"
                      onPress={() => void askAssistant(`Give me the key formulas for ${selectedChapter || selectedSubject}, when to use each, and where the BA II Plus helps.`)}
                      compact
                    />
                    <ActionButton
                      label="Common traps"
                      icon="alert-circle-outline"
                      onPress={() => void askAssistant(`What are the most common mistakes and exam traps in ${selectedChapter || selectedSubject}, and how do I avoid them?`)}
                      compact
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.chatThread}>
                  {assistantMessages.map((message, index) => (
                    <View
                      key={`${message.role}-${index}`}
                      style={[styles.chatBubble, message.role === "user" ? styles.chatBubbleUser : styles.chatBubbleAssistant]}
                    >
                      <Text style={styles.chatRole}>{message.role === "user" ? "You" : "Assistant"}</Text>
                      {message.role === "user" ? <Text style={styles.chatTextUser}>{message.content}</Text> : <FormattedAnswer content={message.content} />}
                    </View>
                  ))}
                  {assistantLoading ? <Text style={styles.metaText}>Thinking…</Text> : null}

                  {!assistantLoading && assistantMessages[assistantMessages.length - 1]?.role === "assistant" ? (
                    <View style={styles.inlineRow}>
                      {ASSISTANT_FOLLOW_UPS.map((prompt) => (
                        <Pressable key={prompt} style={styles.followUpChip} onPress={() => void askAssistant(prompt)}>
                          <Text style={styles.followUpChipText}>{prompt}</Text>
                        </Pressable>
                      ))}
                      <Pressable style={[styles.followUpChip, styles.followUpChipPrimary]} onPress={startAssistantQuizFromChapter}>
                        <Text style={[styles.followUpChipText, styles.followUpChipTextPrimary]}>Quiz me on this</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              )}

              <View style={styles.summaryCard}>
                <TextInput
                  value={assistantQuestion}
                  onChangeText={setAssistantQuestion}
                  style={[uiStyles.input, styles.chatInput]}
                  placeholder="Ask a question, or a follow-up like 'give a harder example'…"
                  placeholderTextColor={colors.inkSoft}
                  multiline
                />
                <ActionButton
                  label={assistantLoading ? "Thinking..." : "Send"}
                  icon="send-outline"
                  onPress={() => void askAssistant(assistantQuestion)}
                />
              </View>
            </>
          ) : (
            <EmptyState text="Sync a subject with AI first." />
          )}
        </Panel>
      ) : null}

      {activeSection === "cards" ? (
        <Panel title="Flashcards" icon="albums-outline">
          {selectedSubject ? (
            <>
              <Text style={styles.copy}>Formula and concept cards for {selectedChapter || selectedSubject}. Flip a card, rate how well you knew it, and it comes back on a spaced schedule.</Text>
              <View style={styles.inlineRow}>
                <ActionButton
                  label={makingCards ? "Making cards..." : "Auto-make cards (formulas first)"}
                  icon="sparkles-outline"
                  onPress={() => void handleMakeCards()}
                />
                <ActionButton label={showAddCard ? "Close" : "Add a card"} icon="add-outline" onPress={() => setShowAddCard((current) => !current)} compact />
              </View>

              {showAddCard ? (
                <View style={styles.configCard}>
                  <Text style={styles.sectionLabel}>Front (question / cue)</Text>
                  <TextInput value={cardFront} onChangeText={setCardFront} style={uiStyles.input} placeholder="e.g. Future value of an ordinary annuity?" placeholderTextColor={colors.inkSoft} multiline />
                  <Text style={styles.sectionLabel}>Back (answer)</Text>
                  <TextInput value={cardBack} onChangeText={setCardBack} style={[uiStyles.input, styles.chatInput]} placeholder="The formula or fact…" placeholderTextColor={colors.inkSoft} multiline />
                  <ActionButton label="Save card" icon="checkmark-outline" onPress={handleAddCard} compact />
                </View>
              ) : null}

              {chapterCards.length ? (
                <View style={styles.stack}>
                  {chapterCards.map((card) => {
                    const revealed = Boolean(revealedCards[card.id]);
                    return (
                      <View key={card.id} style={styles.questionCard}>
                        <View style={styles.badgeWrap}>
                          <Badge text={card.cardType} tone={card.cardType === "Formula" ? "warning" : card.cardType === "Trap" ? "danger" : "primary"} />
                          {card.reps > 0 ? <Badge text={`Seen ${card.reps}×`} tone="neutral" /> : <Badge text="New" tone="accent" />}
                        </View>
                        <Text style={styles.questionTitle}>{card.front}</Text>
                        {revealed ? (
                          <>
                            <View style={styles.feedbackCard}>
                              <Text style={styles.feedbackLine}>{card.back}</Text>
                            </View>
                            <Text style={styles.sectionLabel}>How well did you know it?</Text>
                            <View style={styles.inlineRow}>
                              {(["again", "hard", "good", "easy"] as FlashcardRating[]).map((rating) => (
                                <Pressable key={rating} style={styles.levelChip} onPress={() => handleRateCard(card.id, rating)}>
                                  <Text style={styles.levelChipText}>{rating === "again" ? "Again" : rating === "hard" ? "Hard" : rating === "good" ? "Good" : "Easy"}</Text>
                                </Pressable>
                              ))}
                            </View>
                          </>
                        ) : (
                          <View style={styles.inlineRow}>
                            <ActionButton label="Show answer" icon="eye-outline" onPress={() => setRevealedCards((current) => ({ ...current, [card.id]: true }))} compact />
                            <ActionButton label="Delete" icon="trash-outline" onPress={() => deleteFlashcard(card.id)} compact />
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              ) : (
                <EmptyState text="No cards yet. Tap 'Auto-make cards' to build a deck for this chapter." />
              )}
            </>
          ) : (
            <EmptyState text="Sync a subject with AI first." />
          )}
        </Panel>
      ) : null}

      <View style={styles.bottomSpacer} />
    </>
  );
}

const styles = StyleSheet.create({
  copy: {
    color: colors.inkSoft,
    lineHeight: 20,
  },
  sectionSwitch: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  sectionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sectionChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sectionChipText: {
    color: colors.ink,
    fontWeight: "800",
  },
  sectionChipTextActive: {
    color: colors.surface,
  },
  sourceCard: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  uploadStack: {
    gap: 10,
  },
  sourceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  inlineRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  flex: {
    flex: 1,
  },
  stack: {
    gap: 12,
  },
  cardTitle: {
    color: colors.ink,
    fontWeight: "800",
  },
  metaText: {
    color: colors.inkSoft,
    lineHeight: 19,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 18,
  },
  subjectChipRow: {
    gap: 10,
  },
  subjectChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surfaceMuted,
  },
  subjectChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  subjectChipText: {
    color: colors.ink,
    fontWeight: "700",
  },
  subjectChipTextActive: {
    color: colors.surface,
  },
  chapterChip: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surfaceMuted,
  },
  chapterChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chapterChipText: {
    color: colors.ink,
    fontWeight: "700",
  },
  chapterChipTextActive: {
    color: colors.surface,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pickerHeaderText: {
    color: colors.ink,
    fontWeight: "700",
    fontSize: 14,
    flex: 1,
  },
  subjectPickerHeaderText: {
    color: colors.ink,
    fontWeight: "800",
    fontSize: 18,
    flex: 1,
  },
  pickerChevron: {
    color: colors.inkSoft,
    fontSize: 16,
    fontWeight: "800",
  },
  chapterList: {
    gap: 8,
  },
  chapterListRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  chapterListRowActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chapterListNum: {
    color: colors.inkSoft,
    fontWeight: "800",
    fontSize: 13,
    minWidth: 20,
  },
  chapterListTitle: {
    color: colors.ink,
    fontWeight: "600",
    fontSize: 13,
    flex: 1,
  },
  chapterListTitleActive: {
    color: colors.primary,
    fontWeight: "800",
  },
  configCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
  sectionLabel: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  levelChip: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
  },
  levelChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  levelChipText: {
    color: colors.ink,
    fontWeight: "700",
  },
  levelChipTextActive: {
    color: colors.primary,
  },
  generatedWrap: {
    gap: 12,
  },
  levelSummaryWrap: {
    gap: 10,
  },
  levelSummaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 4,
  },
  levelSummaryTitle: {
    color: colors.ink,
    fontWeight: "800",
  },
  summaryCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 10,
  },
  badgeWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  questionCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 10,
  },
  questionCardHighlighted: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  questionTitle: {
    color: colors.ink,
    fontWeight: "700",
    lineHeight: 20,
  },
  optionWrap: {
    gap: 8,
  },
  optionButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionButtonSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  optionButtonCorrect: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  optionText: {
    color: colors.ink,
    lineHeight: 18,
  },
  optionTextSelected: {
    color: colors.primary,
    fontWeight: "700",
  },
  optionTextCorrect: {
    color: colors.success,
    fontWeight: "700",
  },
  guessChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  guessChipActive: {
    borderColor: colors.warning,
    backgroundColor: colors.warningSoft,
  },
  guessChipText: {
    color: colors.inkSoft,
    fontWeight: "700",
    fontSize: 12,
  },
  guessChipTextActive: {
    color: colors.warning,
  },
  feedbackCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  feedbackTitle: {
    color: colors.ink,
    fontWeight: "800",
  },
  feedbackLine: {
    color: colors.inkSoft,
    lineHeight: 18,
  },
  exampleCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 6,
  },
  exampleTitle: {
    color: colors.ink,
    fontWeight: "800",
  },
  chatInput: {
    minHeight: 110,
    textAlignVertical: "top",
  },
  assistantText: {
    color: colors.ink,
    lineHeight: 21,
  },
  answerWrap: {
    gap: 6,
  },
  answerHeading: {
    color: colors.ink,
    fontWeight: "800",
    fontSize: 14,
    marginTop: 4,
  },
  answerBold: {
    fontWeight: "800",
    color: colors.ink,
  },
  assistantBold: {
    fontWeight: "800",
    color: colors.ink,
  },
  answerBulletRow: {
    flexDirection: "row",
    gap: 8,
    paddingLeft: 4,
  },
  answerBulletDot: {
    color: colors.primary,
    lineHeight: 21,
    fontWeight: "800",
  },
  assistantHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  assistantFocus: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    flex: 1,
  },
  chatThread: {
    gap: 10,
  },
  chatBubble: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  chatBubbleUser: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  chatBubbleAssistant: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  chatRole: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  chatTextUser: {
    color: colors.primary,
    lineHeight: 21,
    fontWeight: "600",
  },
  followUpChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  followUpChipPrimary: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  followUpChipText: {
    color: colors.ink,
    fontWeight: "700",
    fontSize: 12,
  },
  followUpChipTextPrimary: {
    color: colors.surface,
  },
  advancedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bottomSpacer: {
    height: 320,
  },
});
