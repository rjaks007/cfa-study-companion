import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ActionButton, Badge, EmptyState, Panel, uiStyles } from "../components/ui";
import { colors } from "../theme";
import { PracticeDifficulty, PracticeQuestion, Reading, Subject, UploadRecord } from "../types";

type PracticeSection = "generate" | "saved" | "review" | "assistant";

function normalizeDifficultyLabel(value: PracticeDifficulty) {
  if (value === "1") return "Level 1 · Normal";
  if (value === "2") return "Level 2 · Exam";
  return "Level 3 · Hard";
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
}: {
  uploads: UploadRecord[];
  readings: Reading[];
  backendBaseUrl: string;
  setBackendBaseUrl: (value: string) => void;
  pickPdf: (subject: Subject, type: "notesPdfName" | "questionBankPdfName") => Promise<boolean>;
  syncSubjectWithAi: (subject: Subject) => Promise<unknown>;
  syncingSubject: Subject | null;
  askPracticeAssistant: (subject: Subject, question: string, extraContext?: Record<string, unknown>) => Promise<{ answer: string; imageUrl: string }>;
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
}) {
  const parsedSubjects = uploads.filter((upload) => upload.parsedChapters.length > 0);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedChapter, setSelectedChapter] = useState("");
  const [questionCount, setQuestionCount] = useState("10");
  const [difficulty, setDifficulty] = useState<PracticeDifficulty>("1");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showUploads, setShowUploads] = useState(false);
  const [assistantQuestion, setAssistantQuestion] = useState("");
  const [assistantAnswer, setAssistantAnswer] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeSection, setActiveSection] = useState<PracticeSection>("generate");
  const [returnQuestionId, setReturnQuestionId] = useState("");
  const [highlightedQuestionId, setHighlightedQuestionId] = useState("");

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

  const generatedStats = useMemo(() => (activeUpload ? generatedSummary(activeUpload) : { total: 0, answered: 0, correct: 0, wrong: 0, accuracy: 0 }), [activeUpload]);
  const activeParsedChapter = activeUpload?.parsedChapters.find((chapter) => chapter.readingTitle === selectedChapter) || null;
  const activeReading = readings.find((reading) => reading.subject === selectedSubject && reading.title === selectedChapter) || null;
  const confidencePercent = activeReading ? activeReading.confidence * 10 : 0;
  const confidenceGap = activeReading && generatedStats.answered ? confidencePercent - generatedStats.accuracy : 0;
  const wrongGeneratedQuestions = activeUpload?.generatedSet
    ? activeUpload.generatedSet.questions.filter((question) => {
        const selected = activeUpload.generatedAnswers[question.id];
        return selected && question.answer && selected.trim().toLowerCase() !== question.answer.trim().toLowerCase();
      })
    : [];
  const chapterHistory = useMemo(
    () => activeUpload?.practiceHistory.filter((entry) => entry.chapterTitle === selectedChapter) || [],
    [activeUpload?.practiceHistory, selectedChapter],
  );
  const historyByDifficulty = useMemo(
    () =>
      (["1", "2", "3"] as PracticeDifficulty[]).map((level) => {
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

  async function handleAskAssistant(extraContext?: Record<string, unknown>, directQuestion?: string) {
    const prompt = String(directQuestion || assistantQuestion).trim();
    if (!selectedSubject || !prompt) return;
    try {
      setAssistantLoading(true);
      const result = await askPracticeAssistant(selectedSubject, prompt, {
        chapterTitle: selectedChapter,
        generatedReview: activeUpload?.generatedReview,
        confidence: activeReading?.confidence || 0,
        ...extraContext,
      });
      setAssistantAnswer(result.answer);
      setActiveSection("assistant");
    } catch (error) {
      Alert.alert("Assistant failed", error instanceof Error ? error.message : "The assistant could not answer right now.");
    } finally {
      setAssistantLoading(false);
    }
  }

  async function runAssistantPreset(prompt: string, extraContext?: Record<string, unknown>) {
    if (!selectedSubject) return;
    setAssistantQuestion(prompt);
    await handleAskAssistant(extraContext, prompt);
  }

  async function explainWrongAnswer(question: PracticeQuestion) {
    const selected = activeUpload?.generatedAnswers[question.id] || "";
    if (!selectedSubject || !selected) return;
    setAssistantQuestion(`Explain why my answer was wrong in ${question.question}`);
    setReturnQuestionId(question.id);
    setHighlightedQuestionId(question.id);
    setActiveSection("assistant");
    try {
      setAssistantLoading(true);
      const result = await askPracticeAssistant(selectedSubject, `Explain why my answer was wrong in ${question.question}`, {
        mode: "explain-wrong-answer",
        chapterTitle: selectedChapter,
        wrongQuestion: question,
        selectedAnswer: selected,
      });
      setAssistantAnswer(result.answer);
    } catch (error) {
      Alert.alert("Assistant failed", error instanceof Error ? error.message : "The assistant could not answer right now.");
    } finally {
      setAssistantLoading(false);
    }
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
        {sectionButton("assistant", "Assistant")}
      </View>

      {activeSection === "generate" ? (
        <>
          <Panel title="Generate practice set" icon="create-outline">
            {parsedSubjects.length ? (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subjectChipRow} keyboardShouldPersistTaps="handled">
                  {parsedSubjects.map((upload) => (
                    <Pressable
                      key={upload.subject}
                      style={[styles.subjectChip, selectedSubject === upload.subject && styles.subjectChipActive]}
                      onPress={() => setSelectedSubject(upload.subject)}
                    >
                      <Text style={[styles.subjectChipText, selectedSubject === upload.subject && styles.subjectChipTextActive]}>{upload.subject}</Text>
                    </Pressable>
                  ))}
                </ScrollView>

                {activeUpload ? (
                  <>
                    <Text style={styles.sectionLabel}>Chapter</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subjectChipRow} keyboardShouldPersistTaps="handled">
                      {activeUpload.parsedChapters.map((chapter) => (
                        <Pressable
                          key={chapter.id}
                          style={[styles.chapterChip, selectedChapter === chapter.readingTitle && styles.chapterChipActive]}
                          onPress={() => setSelectedChapter(chapter.readingTitle)}
                        >
                          <Text style={[styles.chapterChipText, selectedChapter === chapter.readingTitle && styles.chapterChipTextActive]}>{chapter.readingTitle}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>

                    {activeParsedChapter ? (
                      <View style={styles.summaryCard}>
                        <Text style={styles.cardTitle}>Chapter source</Text>
                        {activeParsedChapter.notesSummary ? <Text style={styles.metaText}>{activeParsedChapter.notesSummary}</Text> : null}
                        {activeParsedChapter.keySubtopics.length ? (
                          <>
                            <Text style={styles.sectionLabel}>Must-cover topics</Text>
                            <View style={styles.badgeWrap}>
                              {activeParsedChapter.keySubtopics.map((topic) => (
                                <Badge key={topic} text={topic} tone="accent" />
                              ))}
                            </View>
                          </>
                        ) : null}
                        {activeParsedChapter.formulas.length ? (
                          <>
                            <Text style={styles.sectionLabel}>Core formulas</Text>
                            <View style={styles.badgeWrap}>
                              {activeParsedChapter.formulas.map((formula) => (
                                <Badge key={formula} text={formula} tone="warning" />
                              ))}
                            </View>
                          </>
                        ) : null}
                        {activeParsedChapter.calculatorGuidance.length ? (
                          <>
                            <Text style={styles.sectionLabel}>BA II Plus</Text>
                            <Text style={styles.metaText}>{activeParsedChapter.calculatorGuidance.join(" ")}</Text>
                          </>
                        ) : null}
                      </View>
                    ) : null}

                    <View style={styles.summaryCard}>
                      <Text style={styles.cardTitle}>Solved so far</Text>
                      {chapterHistory.length ? (
                        <View style={styles.levelSummaryWrap}>
                          {historyByDifficulty.map((item) => (
                            <View key={item.difficulty} style={styles.levelSummaryCard}>
                              <Text style={styles.levelSummaryTitle}>{normalizeDifficultyLabel(item.difficulty)}</Text>
                              <Text style={styles.metaText}>{item.attempted} solved</Text>
                              <Text style={styles.metaText}>
                                {item.correct} correct · {item.wrong} wrong
                              </Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.metaText}>No saved practice history for this chapter yet.</Text>
                      )}
                    </View>

                    <View style={styles.configCard}>
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
                        {(["1", "2", "3"] as PracticeDifficulty[]).map((level) => (
                          <Pressable key={level} style={[styles.levelChip, difficulty === level && styles.levelChipActive]} onPress={() => setDifficulty(level)}>
                            <Text style={[styles.levelChipText, difficulty === level && styles.levelChipTextActive]}>{normalizeDifficultyLabel(level)}</Text>
                          </Pressable>
                        ))}
                      </View>
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
                    {activeUpload.generatedSet.questionCount} questions · {normalizeDifficultyLabel(activeUpload.generatedSet.difficulty)}
                  </Text>
                  <View style={styles.badgeWrap}>
                    <Badge text={`Answered ${generatedStats.answered}/${generatedStats.total}`} tone="accent" />
                    <Badge text={`Correct ${generatedStats.correct}`} tone="success" />
                    <Badge text={`Wrong ${generatedStats.wrong}`} tone="danger" />
                    <Badge text={`Accuracy ${generatedStats.accuracy}%`} tone="warning" />
                  </View>
                  <View style={styles.inlineRow}>
                    <ActionButton label="Save this set" icon="bookmark-outline" onPress={handleSaveCurrentSet} compact />
                    <ActionButton label={analyzing ? "Building review..." : "Analyze my weak areas"} icon="analytics-outline" onPress={() => void handleAnalyzePractice()} compact />
                  </View>
                </View>

                {activeReading && generatedStats.answered ? (
                  <View style={styles.summaryCard}>
                    <Text style={styles.cardTitle}>Confidence calibration</Text>
                    <Text style={styles.metaText}>
                      You rated this chapter at {activeReading.confidence}/10, while your current set score is {generatedStats.accuracy}%.
                    </Text>
                    <Badge
                      text={
                        Math.abs(confidenceGap) <= 10
                          ? "Confidence and score are aligned"
                          : confidenceGap > 10
                            ? "You may be overconfident here"
                            : "You may know more than your confidence suggests"
                      }
                      tone={Math.abs(confidenceGap) <= 10 ? "success" : confidenceGap > 10 ? "warning" : "accent"}
                    />
                  </View>
                ) : null}

                {activeUpload.generatedSet.questions.map((question, index) => {
                  const selected = activeUpload.generatedAnswers[question.id];
                  const isCorrect = selected && question.answer ? selected.trim().toLowerCase() === question.answer.trim().toLowerCase() : false;
                  return (
                    <View key={question.id} style={[styles.questionCard, highlightedQuestionId === question.id && styles.questionCardHighlighted]}>
                      <Text style={styles.questionTitle}>
                        Q{index + 1}. {question.question}
                      </Text>
                      <View style={styles.optionWrap}>
                        {question.options.map((option) => {
                          const chosen = selected === option;
                          const revealCorrect = Boolean(selected && question.answer && option.trim().toLowerCase() === question.answer.trim().toLowerCase());
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
                        {!isCorrect && selected && question.answer ? (
                          <ActionButton label="Explain why wrong" icon="help-circle-outline" onPress={() => void explainWrongAnswer(question)} compact />
                        ) : null}
                      </View>
                      {selected ? (
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
                          const prompt = `Help me revise this saved question: ${item.question.question}`;
                          setAssistantQuestion(prompt);
                          setReturnQuestionId("");
                          setHighlightedQuestionId("");
                          setActiveSection("assistant");
                          void handleAskAssistant(
                            {
                              mode: "saved-question-help",
                              savedQuestion: item.question,
                              chapterTitle: item.chapterTitle,
                            },
                            prompt,
                          );
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
                          const prompt = `Explain why this answer was wrong: ${item.question.question}`;
                          setAssistantQuestion(prompt);
                          setActiveSection("assistant");
                          setReturnQuestionId("");
                          void handleAskAssistant(
                            {
                              mode: "wrong-library-help",
                              wrongQuestion: item.question,
                              selectedAnswer: item.selectedAnswer,
                              chapterTitle: item.chapterTitle,
                            },
                            prompt,
                          );
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
          <Text style={styles.copy}>Ask about formulas, revision topics, exam tips, or why a question went wrong using your uploaded source material.</Text>
          {returnQuestionId ? (
            <View style={styles.inlineRow}>
              <ActionButton label="Back to question" icon="arrow-back-outline" onPress={jumpBackToQuestion} compact />
            </View>
          ) : null}
          {selectedSubject ? (
            <>
              <View style={styles.inlineRow}>
                <ActionButton
                  label="Formula drill"
                  icon="calculator-outline"
                  onPress={() =>
                    void runAssistantPreset(`Create a formula drill for ${selectedChapter || selectedSubject}. Show the key formulas, when to use them, and one quick recall check for each.`, {
                      mode: "formula-drill",
                    })
                  }
                  compact
                />
                <ActionButton
                  label="Exam coach"
                  icon="school-outline"
                  onPress={() =>
                    void runAssistantPreset(`Coach me for exam-style questions in ${selectedChapter || selectedSubject}. Tell me the common traps, time-saving approach, and how to think under pressure.`, {
                      mode: "exam-coach",
                    })
                  }
                  compact
                />
                <ActionButton
                  label="Chat with notes"
                  icon="book-outline"
                  onPress={() =>
                    void runAssistantPreset(`Use my uploaded notes for ${selectedChapter || selectedSubject} and tell me the most important ideas in plain language.`, {
                      mode: "chat-with-notes",
                    })
                  }
                  compact
                />
                <ActionButton
                  label="Revision sheet"
                  icon="document-text-outline"
                  onPress={() =>
                    void runAssistantPreset(`Create a one-page revision sheet for ${selectedChapter || selectedSubject}. Include the exact concepts, formulas, and traps I should revise next.`, {
                      mode: "revision-sheet",
                    })
                  }
                  compact
                />
              </View>
              {assistantAnswer ? (
                <View style={styles.summaryCard}>
                  <Text style={styles.cardTitle}>Assistant answer</Text>
                  <Text style={styles.assistantText}>{assistantAnswer}</Text>
                </View>
              ) : null}
              <View style={styles.summaryCard}>
                <TextInput
                  value={assistantQuestion}
                  onChangeText={setAssistantQuestion}
                  style={[uiStyles.input, styles.chatInput]}
                  placeholder="Ask: what exactly should I revise in Rate and Return? Give me one simple numerical example."
                  placeholderTextColor={colors.inkSoft}
                  multiline
                />
                <ActionButton label={assistantLoading ? "Thinking..." : "Ask assistant"} icon="sparkles-outline" onPress={() => void handleAskAssistant()} />
              </View>
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
  advancedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bottomSpacer: {
    height: 320,
  },
});
