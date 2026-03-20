import React, { useEffect, useMemo, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ActionButton, Badge, EmptyState, Panel, uiStyles } from "../components/ui";
import { colors } from "../theme";
import { PracticeDifficulty, Subject, UploadRecord } from "../types";

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
  backendBaseUrl,
  setBackendBaseUrl,
  pickPdf,
  syncSubjectWithAi,
  syncingSubject,
  askPracticeAssistant,
  generatePracticeSet,
  answerGeneratedQuestion,
  analyzeGeneratedPractice,
}: {
  uploads: UploadRecord[];
  backendBaseUrl: string;
  setBackendBaseUrl: (value: string) => void;
  pickPdf: (subject: Subject, type: "notesPdfName" | "questionBankPdfName") => Promise<boolean>;
  syncSubjectWithAi: (subject: Subject) => Promise<unknown>;
  syncingSubject: Subject | null;
  askPracticeAssistant: (subject: Subject, question: string, extraContext?: Record<string, unknown>) => Promise<{ answer: string; imageUrl: string }>;
  generatePracticeSet: (subject: Subject, chapterTitle: string, questionCount: number, difficulty: PracticeDifficulty) => Promise<unknown>;
  answerGeneratedQuestion: (subject: Subject, questionId: string, selectedOption: string) => void;
  analyzeGeneratedPractice: (subject: Subject) => Promise<unknown>;
}) {
  const parsedSubjects = uploads.filter((upload) => upload.parsedChapters.length > 0);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedChapter, setSelectedChapter] = useState("");
  const [questionCount, setQuestionCount] = useState("10");
  const [difficulty, setDifficulty] = useState<PracticeDifficulty>("1");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [assistantQuestion, setAssistantQuestion] = useState("");
  const [assistantAnswer, setAssistantAnswer] = useState("");
  const [assistantImageUrl, setAssistantImageUrl] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (!selectedSubject && parsedSubjects[0]) {
      setSelectedSubject(parsedSubjects[0].subject);
    }
  }, [parsedSubjects, selectedSubject]);

  const activeUpload = uploads.find((upload) => upload.subject === selectedSubject) || null;

  useEffect(() => {
    if (!activeUpload) {
      setSelectedChapter("");
      return;
    }
    if (!selectedChapter || !activeUpload.parsedChapters.some((chapter) => chapter.readingTitle === selectedChapter)) {
      setSelectedChapter(activeUpload.parsedChapters[0]?.readingTitle || "");
    }
  }, [activeUpload, selectedChapter]);

  const generatedStats = useMemo(() => (activeUpload ? generatedSummary(activeUpload) : { total: 0, answered: 0, correct: 0, wrong: 0, accuracy: 0 }), [activeUpload]);
  const activeParsedChapter = activeUpload?.parsedChapters.find((chapter) => chapter.readingTitle === selectedChapter) || null;

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

  async function handleGeneratePractice() {
    if (!selectedSubject || !selectedChapter) return;
    try {
      setGenerating(true);
      await generatePracticeSet(selectedSubject, selectedChapter, Number(questionCount || 10), difficulty);
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
      Alert.alert("Review ready", "Your weak-topic summary and study examples are ready below.");
    } catch (error) {
      Alert.alert("Analysis failed", error instanceof Error ? error.message : "The practice review could not be created.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleAskAssistant() {
    if (!selectedSubject || !assistantQuestion.trim()) return;
    try {
      setAssistantLoading(true);
      const result = await askPracticeAssistant(selectedSubject, assistantQuestion.trim());
      setAssistantAnswer(result.answer);
      setAssistantImageUrl(result.imageUrl);
    } catch (error) {
      Alert.alert("Assistant failed", error instanceof Error ? error.message : "The assistant could not answer right now.");
    } finally {
      setAssistantLoading(false);
    }
  }

  return (
    <>
      <Panel title="Practice" icon="sparkles-outline">
        <Text style={styles.copy}>
          Use uploaded notes and question-bank PDFs as the source. Then generate a fresh set by chapter, choose how many questions you want, and get a study review after you finish.
        </Text>
      </Panel>

      <Panel title="Source material" icon="folder-open-outline">
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
      </Panel>

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
                    {activeParsedChapter.revisionFocus.length ? (
                      <View style={styles.badgeWrap}>
                        {activeParsedChapter.revisionFocus.map((topic) => (
                          <Badge key={topic} text={topic} tone="accent" />
                        ))}
                      </View>
                    ) : null}
                  </View>
                ) : null}

                <View style={styles.configCard}>
                  <View style={styles.configRow}>
                    <View style={styles.flex}>
                      <Text style={styles.sectionLabel}>How many questions?</Text>
                      <TextInput
                        value={questionCount}
                        onChangeText={setQuestionCount}
                        style={uiStyles.input}
                        keyboardType="numeric"
                        placeholder="10"
                        placeholderTextColor={colors.inkSoft}
                      />
                    </View>
                  </View>
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
            </View>

            {activeUpload.generatedSet.questions.map((question, index) => {
              const selected = activeUpload.generatedAnswers[question.id];
              const isCorrect = selected && question.answer ? selected.trim().toLowerCase() === question.answer.trim().toLowerCase() : false;
              return (
                <View key={question.id} style={styles.questionCard}>
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

            <ActionButton label={analyzing ? "Building review..." : "Analyze my weak areas"} icon="analytics-outline" onPress={() => void handleAnalyzePractice()} />
          </View>
        ) : (
          <EmptyState text="Generate a practice set first." />
        )}
      </Panel>

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
          </View>
        ) : (
          <EmptyState text="Finish a generated set, then analyze it to get your weak-topic study summary." />
        )}
      </Panel>

      <Panel title="Study assistant" icon="chatbubble-ellipses-outline">
        <Text style={styles.copy}>
          Ask about formulas, revision topics, exam tips, or even ask for a visual explanation from the material you uploaded.
        </Text>
        {selectedSubject ? (
          <>
            <TextInput
              value={assistantQuestion}
              onChangeText={setAssistantQuestion}
              style={[uiStyles.input, styles.chatInput]}
              placeholder="Ask: what exactly should I revise in Rate and Return? Give me one simple numerical example."
              placeholderTextColor={colors.inkSoft}
              multiline
            />
            <ActionButton label={assistantLoading ? "Thinking..." : "Ask assistant"} icon="sparkles-outline" onPress={() => void handleAskAssistant()} />
            {assistantAnswer ? (
              <View style={styles.summaryCard}>
                <Text style={styles.cardTitle}>Assistant answer</Text>
                <Text style={styles.assistantText}>{assistantAnswer}</Text>
                {assistantImageUrl ? <Image source={{ uri: assistantImageUrl }} style={styles.assistantImage} resizeMode="contain" /> : null}
              </View>
            ) : null}
          </>
        ) : (
          <EmptyState text="Sync a subject with AI first." />
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
  );
}

const styles = StyleSheet.create({
  copy: {
    color: colors.inkSoft,
    lineHeight: 20,
  },
  sourceCard: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
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
  configRow: {
    flexDirection: "row",
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
  assistantImage: {
    width: "100%",
    height: 220,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  advancedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
