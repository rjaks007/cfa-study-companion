import React, { useEffect, useMemo, useState } from "react";
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ActionButton, Badge, EmptyState, Panel, uiStyles } from "../components/ui";
import { colors } from "../theme";
import { PracticeChapter, Subject, UploadRecord } from "../types";

function computeChapterScore(chapter: PracticeChapter, answers: Record<string, string>) {
  let answered = 0;
  let correct = 0;
  let wrong = 0;

  chapter.questions.forEach((question) => {
    const selected = answers[question.id];
    if (!selected) return;
    answered += 1;
    if (question.answer && selected.trim().toLowerCase() === question.answer.trim().toLowerCase()) correct += 1;
    else if (question.answer) wrong += 1;
  });

  return {
    total: chapter.questions.length,
    answered,
    correct,
    wrong,
    accuracy: answered ? Math.round((correct / answered) * 100) : 0,
  };
}

function computeOverallSummary(upload: UploadRecord) {
  const chapterRows = upload.parsedChapters.map((chapter) => ({
    chapter,
    stats: computeChapterScore(chapter, upload.userAnswers),
  }));

  const totalQuestions = chapterRows.reduce((sum, row) => sum + row.stats.total, 0);
  const totalAnswered = chapterRows.reduce((sum, row) => sum + row.stats.answered, 0);
  const totalCorrect = chapterRows.reduce((sum, row) => sum + row.stats.correct, 0);
  const totalWrong = chapterRows.reduce((sum, row) => sum + row.stats.wrong, 0);
  const weakest = [...chapterRows]
    .filter((row) => row.stats.answered > 0)
    .sort((left, right) => right.stats.wrong - left.stats.wrong || left.stats.accuracy - right.stats.accuracy)[0];

  return {
    totalQuestions,
    totalAnswered,
    totalCorrect,
    totalWrong,
    accuracy: totalAnswered ? Math.round((totalCorrect / totalAnswered) * 100) : 0,
    weakestArea: weakest?.chapter.readingTitle || "Answer a few questions to see this",
  };
}

function computeStudyFocus(upload: UploadRecord) {
  const wrongChapters = upload.parsedChapters
    .map((chapter) => ({ chapter, stats: computeChapterScore(chapter, upload.userAnswers) }))
    .filter((item) => item.stats.wrong > 0)
    .sort((left, right) => right.stats.wrong - left.stats.wrong || left.stats.accuracy - right.stats.accuracy);

  const primary = wrongChapters[0];
  const focusTopics = Array.from(new Set(wrongChapters.flatMap((item) => item.chapter.revisionFocus))).slice(0, 5);

  return {
    weakestChapter: primary?.chapter.readingTitle || "Answer more questions to unlock this",
    notesSummary: primary?.chapter.notesSummary || "Once you answer more questions, the app will turn your weak areas into a sharper revision brief.",
    focusTopics,
  };
}

export function PracticeScreen({
  uploads,
  backendBaseUrl,
  setBackendBaseUrl,
  pickPdf,
  syncSubjectWithAi,
  syncingSubject,
  answerPracticeQuestion,
  resetPracticeAnswers,
  askPracticeAssistant,
}: {
  uploads: UploadRecord[];
  backendBaseUrl: string;
  setBackendBaseUrl: (value: string) => void;
  pickPdf: (subject: Subject, type: "notesPdfName" | "questionBankPdfName") => Promise<boolean>;
  syncSubjectWithAi: (subject: Subject) => Promise<unknown>;
  syncingSubject: Subject | null;
  answerPracticeQuestion: (subject: Subject, questionId: string, selectedOption: string) => void;
  resetPracticeAnswers: (subject: Subject) => void;
  askPracticeAssistant: (subject: Subject, question: string, extraContext?: Record<string, unknown>) => Promise<{ answer: string; imageUrl: string }>;
}) {
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});
  const [showBackendConfig, setShowBackendConfig] = useState(false);
  const [assistantSubject, setAssistantSubject] = useState<Subject | null>(null);
  const [assistantQuestion, setAssistantQuestion] = useState("");
  const [assistantAnswer, setAssistantAnswer] = useState("");
  const [assistantImageUrl, setAssistantImageUrl] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);

  const parsedSubjects = uploads.filter((upload) => upload.parsedChapters.length > 0);
  const subjectSummaries = useMemo(
    () => Object.fromEntries(uploads.map((upload) => [upload.subject, computeOverallSummary(upload)])),
    [uploads],
  );

  useEffect(() => {
    if (!assistantSubject && parsedSubjects[0]) {
      setAssistantSubject(parsedSubjects[0].subject);
    }
  }, [assistantSubject, parsedSubjects]);

  async function handlePick(subject: Subject, type: "notesPdfName" | "questionBankPdfName") {
    try {
      await pickPdf(subject, type);
    } catch {
      Alert.alert("Picker failed", "I could not open the document picker on this device.");
    }
  }

  async function handleAiSync(subject: Subject) {
    try {
      await syncSubjectWithAi(subject);
      setExpandedSubjects((current) => ({ ...current, [subject]: true }));
      Alert.alert("AI sync complete", `The ${subject} PDFs were sent to your backend and the app refreshed the chapter questions.`);
    } catch (error) {
      Alert.alert("AI sync failed", error instanceof Error ? error.message : "The backend sync did not complete.");
    }
  }

  async function handleAssistantQuestion() {
    if (!assistantSubject || !assistantQuestion.trim()) return;
    try {
      setAssistantLoading(true);
      const result = await askPracticeAssistant(assistantSubject, assistantQuestion.trim());
      setAssistantAnswer(result.answer);
      setAssistantImageUrl(result.imageUrl);
    } catch (error) {
      Alert.alert("Study assistant failed", error instanceof Error ? error.message : "The assistant could not answer right now.");
    } finally {
      setAssistantLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <Panel title="Practice" icon="library-outline">
        <Text style={styles.copy}>
          One clean flow: upload a subject, sync with AI, answer chapter questions, see what went wrong, then ask the assistant what to study next.
        </Text>
      </Panel>

      <Panel title="Question bank" icon="albums-outline">
        {uploads.length ? (
          uploads.map((upload) => {
            const expanded = Boolean(expandedSubjects[upload.subject]);
            const summary = subjectSummaries[upload.subject];
            const studyFocus = computeStudyFocus(upload);

            return (
              <View key={upload.subject} style={styles.subjectCard}>
                <Pressable style={styles.subjectHeader} onPress={() => setExpandedSubjects((current) => ({ ...current, [upload.subject]: !expanded }))}>
                  <View style={styles.flex}>
                    <Text style={styles.subjectTitle}>{upload.subject}</Text>
                    <Text style={styles.subjectMeta}>
                      {upload.parsedChapters.length
                        ? `${upload.parsedChapters.length} chapters parsed · ${summary.totalAnswered}/${summary.totalQuestions} answered`
                        : "Upload notes + question bank, then sync with AI"}
                    </Text>
                  </View>
                  <Badge
                    text={upload.uploadStatus}
                    tone={upload.uploadStatus === "Parsed with AI" ? "success" : upload.uploadStatus === "AI sync failed" ? "danger" : "neutral"}
                  />
                </Pressable>

                <View style={styles.actionRow}>
                  <ActionButton label={upload.notesPdfName || "Add notes"} icon="document-outline" onPress={() => handlePick(upload.subject, "notesPdfName")} compact />
                  <ActionButton
                    label={upload.questionBankPdfName || "Add question bank"}
                    icon="albums-outline"
                    onPress={() => handlePick(upload.subject, "questionBankPdfName")}
                    compact
                  />
                  {upload.readyForReview ? (
                    <ActionButton
                      label={syncingSubject === upload.subject ? "Syncing..." : "Sync with AI"}
                      icon="sparkles-outline"
                      onPress={() => void handleAiSync(upload.subject)}
                      compact
                    />
                  ) : null}
                </View>

                {upload.aiError ? <Text style={styles.errorText}>Error: {upload.aiError}</Text> : null}

                {expanded ? (
                  <View style={styles.subjectDetail}>
                    {upload.parsedChapters.length ? (
                      <>
                        <View style={styles.summaryCard}>
                          <Text style={styles.cardTitle}>Practice summary</Text>
                          <View style={styles.badgeWrap}>
                            <Badge text={`Answered ${summary.totalAnswered}/${summary.totalQuestions}`} tone="accent" />
                            <Badge text={`Correct ${summary.totalCorrect}`} tone="success" />
                            <Badge text={`Wrong ${summary.totalWrong}`} tone="danger" />
                            <Badge text={`Accuracy ${summary.accuracy}%`} tone="warning" />
                          </View>
                          <Text style={styles.metaLine}>Weakest area: {summary.weakestArea}</Text>
                        </View>

                        <View style={styles.summaryCard}>
                          <Text style={styles.cardTitle}>What to study next</Text>
                          <Text style={styles.metaLine}>Weakest chapter: {studyFocus.weakestChapter}</Text>
                          <Text style={styles.metaLine}>{studyFocus.notesSummary}</Text>
                          {studyFocus.focusTopics.length ? (
                            <View style={styles.badgeWrap}>
                              {studyFocus.focusTopics.map((topic) => (
                                <Badge key={topic} text={topic} tone="accent" />
                              ))}
                            </View>
                          ) : null}
                        </View>

                        <View style={styles.actionRow}>
                          <ActionButton label="Reset answers" icon="refresh-outline" onPress={() => resetPracticeAnswers(upload.subject)} compact />
                        </View>

                        {upload.parsedChapters.map((chapter) => {
                          const chapterExpanded = Boolean(expandedChapters[`${upload.subject}-${chapter.id}`]);
                          const chapterStats = computeChapterScore(chapter, upload.userAnswers);

                          return (
                            <View key={chapter.id} style={styles.chapterCard}>
                              <Pressable
                                style={styles.chapterHeader}
                                onPress={() =>
                                  setExpandedChapters((current) => ({
                                    ...current,
                                    [`${upload.subject}-${chapter.id}`]: !chapterExpanded,
                                  }))
                                }
                              >
                                <View style={styles.flex}>
                                  <Text style={styles.chapterTitle}>{chapter.readingTitle}</Text>
                                  <Text style={styles.chapterMeta}>
                                    {chapter.questions.length} questions · {chapterStats.answered} answered · {chapterStats.accuracy}% accuracy
                                  </Text>
                                </View>
                                <Badge text={chapterExpanded ? "Hide" : "Open"} tone="accent" />
                              </Pressable>

                              {chapterExpanded ? (
                                <View style={styles.chapterDetail}>
                                  {chapter.notesSummary ? <Text style={styles.chapterSummary}>{chapter.notesSummary}</Text> : null}
                                  {chapter.revisionFocus.length ? (
                                    <View style={styles.badgeWrap}>
                                      {chapter.revisionFocus.map((topic) => (
                                        <Badge key={topic} text={topic} tone="warning" />
                                      ))}
                                    </View>
                                  ) : null}

                                  {chapter.questions.map((question, index) => {
                                    const selected = upload.userAnswers[question.id];
                                    const isCorrect =
                                      selected && question.answer ? selected.trim().toLowerCase() === question.answer.trim().toLowerCase() : false;

                                    return (
                                      <View key={question.id} style={styles.questionCard}>
                                        <Text style={styles.questionTitle}>
                                          Q{index + 1}. {question.question}
                                        </Text>

                                        <View style={styles.optionWrap}>
                                          {question.options.length ? (
                                            question.options.map((option) => {
                                              const chosen = selected === option;
                                              const revealCorrect =
                                                Boolean(selected && question.answer && option.trim().toLowerCase() === question.answer.trim().toLowerCase());

                                              return (
                                                <Pressable
                                                  key={option}
                                                  style={[
                                                    styles.optionButton,
                                                    chosen && styles.optionButtonSelected,
                                                    revealCorrect && styles.optionButtonCorrect,
                                                  ]}
                                                  onPress={() => answerPracticeQuestion(upload.subject, question.id, option)}
                                                >
                                                  <Text
                                                    style={[
                                                      styles.optionText,
                                                      chosen && styles.optionTextSelected,
                                                      revealCorrect && styles.optionTextCorrect,
                                                    ]}
                                                  >
                                                    {option}
                                                  </Text>
                                                </Pressable>
                                              );
                                            })
                                          ) : (
                                            <Text style={styles.helperText}>No options were extracted for this question yet.</Text>
                                          )}
                                        </View>

                                        {selected ? (
                                          <View style={styles.feedbackCard}>
                                            <Text style={styles.feedbackTitle}>{question.answer ? (isCorrect ? "Correct" : "Needs review") : "Saved answer"}</Text>
                                            {question.answer ? <Text style={styles.feedbackLine}>Answer: {question.answer}</Text> : null}
                                            {question.explanation ? <Text style={styles.feedbackLine}>{question.explanation}</Text> : null}
                                            {question.tags.length ? <Text style={styles.feedbackLine}>Tags: {question.tags.join(", ")}</Text> : null}
                                          </View>
                                        ) : null}
                                      </View>
                                    );
                                  })}
                                </View>
                              ) : null}
                            </View>
                          );
                        })}
                      </>
                    ) : upload.aiSummary ? (
                      <View style={styles.summaryCard}>
                        <Text style={styles.cardTitle}>Latest AI output</Text>
                        <Text style={styles.metaLine}>{upload.aiSummary}</Text>
                      </View>
                    ) : (
                      <EmptyState text="No parsed chapters yet. Upload files and sync with AI." />
                    )}
                  </View>
                ) : null}
              </View>
            );
          })
        ) : (
          <EmptyState text="No uploads yet." />
        )}
      </Panel>

      <Panel title="Study assistant" icon="chatbubble-ellipses-outline">
        <Text style={styles.copy}>
          Ask about notes, formulas, mistakes, exam tips, or say you want a visual explanation. The assistant uses your uploaded material for that subject.
        </Text>
        {parsedSubjects.length ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subjectChipRow} keyboardShouldPersistTaps="handled">
              {parsedSubjects.map((upload) => (
                <Pressable
                  key={upload.subject}
                  style={[styles.subjectChip, assistantSubject === upload.subject && styles.subjectChipActive]}
                  onPress={() => setAssistantSubject(upload.subject)}
                >
                  <Text style={[styles.subjectChipText, assistantSubject === upload.subject && styles.subjectChipTextActive]}>{upload.subject}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <TextInput
              value={assistantQuestion}
              onChangeText={setAssistantQuestion}
              style={[uiStyles.input, styles.chatInput]}
              placeholder="Ask: explain rate and return simply, show the key formula, and give me a quick visual."
              placeholderTextColor={colors.inkSoft}
              multiline
            />
            <View style={styles.actionRow}>
              <ActionButton label={assistantLoading ? "Thinking..." : "Ask assistant"} icon="sparkles-outline" onPress={() => void handleAssistantQuestion()} compact />
            </View>
            {assistantAnswer ? (
              <View style={styles.summaryCard}>
                <Text style={styles.cardTitle}>Assistant answer</Text>
                <Text style={styles.assistantText}>{assistantAnswer}</Text>
                {assistantImageUrl ? <Image source={{ uri: assistantImageUrl }} style={styles.assistantImage} resizeMode="contain" /> : null}
              </View>
            ) : null}
          </>
        ) : (
          <EmptyState text="Sync a subject with AI first, then you can ask the assistant about it." />
        )}
      </Panel>

      <Panel title="Advanced" icon="settings-outline">
        <Pressable style={styles.advancedHeader} onPress={() => setShowBackendConfig((current) => !current)}>
          <Text style={styles.cardTitle}>Backend connection</Text>
          <Badge text={showBackendConfig ? "Hide" : "Show"} tone="accent" />
        </Pressable>
        {showBackendConfig ? (
          <View style={styles.summaryCard}>
            <Text style={styles.metaLine}>Keep this collapsed so the backend URL does not get changed by accident.</Text>
            <TextInput
              value={backendBaseUrl}
              onChangeText={setBackendBaseUrl}
              style={uiStyles.input}
              placeholder="https://your-backend.onrender.com"
              placeholderTextColor={colors.inkSoft}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.helperText}>Use your Render URL here. Local computer IPs are only for temporary testing.</Text>
          </View>
        ) : null}
      </Panel>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  copy: {
    color: colors.inkSoft,
    lineHeight: 20,
  },
  subjectCard: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  subjectHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  subjectTitle: {
    color: colors.ink,
    fontWeight: "800",
    fontSize: 16,
  },
  subjectMeta: {
    color: colors.inkSoft,
    fontSize: 12,
    marginTop: 4,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  subjectDetail: {
    gap: 12,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 10,
  },
  cardTitle: {
    color: colors.ink,
    fontWeight: "800",
  },
  metaLine: {
    color: colors.inkSoft,
    lineHeight: 19,
  },
  badgeWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chapterCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 10,
  },
  chapterHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  chapterTitle: {
    color: colors.ink,
    fontWeight: "800",
    fontSize: 14,
  },
  chapterMeta: {
    color: colors.inkSoft,
    fontSize: 12,
    marginTop: 4,
  },
  chapterDetail: {
    gap: 12,
  },
  chapterSummary: {
    color: colors.inkSoft,
    lineHeight: 19,
  },
  questionCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
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
  helperText: {
    color: colors.inkSoft,
    fontSize: 12,
    lineHeight: 18,
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
    backgroundColor: colors.surfaceMuted,
  },
  advancedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  flex: {
    flex: 1,
  },
});
