import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
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
    accuracy: answered && correct >= 0 ? Math.round((correct / Math.max(answered, 1)) * 100) : 0,
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
    .sort((left, right) => {
      if (left.stats.accuracy === right.stats.accuracy) return right.stats.wrong - left.stats.wrong;
      return left.stats.accuracy - right.stats.accuracy;
    })[0];

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
    .map((chapter) => {
      const stats = computeChapterScore(chapter, upload.userAnswers);
      return {
        chapter,
        stats,
      };
    })
    .filter((item) => item.stats.wrong > 0)
    .sort((left, right) => right.stats.wrong - left.stats.wrong || left.stats.accuracy - right.stats.accuracy);

  const primary = wrongChapters[0];
  const focusTopics = wrongChapters.flatMap((item) => item.chapter.revisionFocus).filter(Boolean);
  const uniqueFocusTopics = Array.from(new Set(focusTopics)).slice(0, 5);

  return {
    weakestChapter: primary?.chapter.readingTitle || "Answer more questions to unlock this",
    notesSummary: primary?.chapter.notesSummary || "Once you answer more questions, the app will turn your weak areas into a sharper revision brief.",
    focusTopics: uniqueFocusTopics,
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
  askPracticeAssistant: (subject: Subject, question: string, extraContext?: Record<string, unknown>) => Promise<string>;
}) {
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});
  const [assistantSubject, setAssistantSubject] = useState<Subject | null>(null);
  const [assistantQuestion, setAssistantQuestion] = useState("");
  const [assistantAnswer, setAssistantAnswer] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);

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
      Alert.alert("AI sync complete", `The ${subject} PDFs were sent to your backend and the app turned the response into chapter questions.`);
    } catch (error) {
      Alert.alert("AI sync failed", error instanceof Error ? error.message : "The backend sync did not complete.");
    }
  }

  const readySubjects = uploads.filter((upload) => upload.readyForReview);
  const parsedSubjects = uploads.filter((upload) => upload.parsedChapters.length > 0);
  const overallReadyText = parsedSubjects.length ? parsedSubjects.map((item) => item.subject).join(", ") : "none yet";

  useEffect(() => {
    if (!assistantSubject && parsedSubjects[0]) {
      setAssistantSubject(parsedSubjects[0].subject);
    }
  }, [assistantSubject, parsedSubjects]);

  const subjectSummaries = useMemo(
    () =>
      Object.fromEntries(
        uploads.map((upload) => [
          upload.subject,
          computeOverallSummary(upload),
        ]),
      ),
    [uploads],
  );

  async function handleAssistantQuestion() {
    if (!assistantSubject || !assistantQuestion.trim()) return;
    try {
      setAssistantLoading(true);
      const answer = await askPracticeAssistant(assistantSubject, assistantQuestion.trim());
      setAssistantAnswer(answer);
    } catch (error) {
      Alert.alert("Study assistant failed", error instanceof Error ? error.message : "The assistant could not answer right now.");
    } finally {
      setAssistantLoading(false);
    }
  }

  return (
    <>
      <Panel title="Practice" icon="library-outline">
        <Text style={styles.copy}>
          Upload notes and question-bank PDFs, let AI split them chapter-wise, answer inside the app, and use the summary to see which areas still need another pass.
        </Text>
      </Panel>

      <Panel title="Connect backend" icon="cloud-outline">
        <Text style={styles.copy}>
          Add your backend URL here. The phone app sends PDFs there, and the backend talks to OpenAI securely with your API key.
        </Text>
        <TextInput
          value={backendBaseUrl}
          onChangeText={setBackendBaseUrl}
          style={uiStyles.input}
          placeholder="https://your-backend.onrender.com"
          placeholderTextColor={colors.inkSoft}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.helperText}>If you use Render, paste the `https://...onrender.com` link here.</Text>
      </Panel>

      <Panel title="Upload materials" icon="document-attach-outline">
        {uploads.length ? (
          uploads.map((upload) => {
            const summary = subjectSummaries[upload.subject];
            const expanded = Boolean(expandedSubjects[upload.subject]);
            const studyFocus = computeStudyFocus(upload);

            return (
              <View key={upload.subject} style={styles.uploadCard}>
                <Pressable style={styles.uploadHeader} onPress={() => setExpandedSubjects((current) => ({ ...current, [upload.subject]: !expanded }))}>
                  <View style={styles.flex}>
                    <Text style={styles.uploadTitle}>{upload.subject}</Text>
                    <Text style={styles.uploadMeta}>
                      {upload.parsedChapters.length ? `${upload.parsedChapters.length} chapters parsed` : `Detected chapters: ${upload.chaptersDetected}`}
                    </Text>
                  </View>
                  <View style={styles.uploadBadgeStack}>
                    <Badge text={upload.uploadStatus} tone={upload.uploadStatus === "Parsed with AI" ? "success" : upload.uploadStatus === "AI sync failed" ? "danger" : "neutral"} />
                    {upload.parsedChapters.length ? <Badge text={`${summary.totalAnswered}/${summary.totalQuestions} answered`} tone="accent" /> : null}
                  </View>
                </Pressable>

                <View style={styles.buttonRow}>
                  <ActionButton label={upload.notesPdfName || "Add notes PDF"} icon="document-outline" onPress={() => handlePick(upload.subject, "notesPdfName")} compact />
                  <ActionButton label={upload.questionBankPdfName || "Add Q-bank PDF"} icon="albums-outline" onPress={() => handlePick(upload.subject, "questionBankPdfName")} compact />
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
                  <>
                    <Text style={styles.uploadMeta}>Notes: {upload.notesPdfName ? "uploaded" : "pending"}</Text>
                    <Text style={styles.uploadMeta}>Question bank: {upload.questionBankPdfName ? "uploaded" : "pending"}</Text>
                    {upload.lastSyncAt ? <Text style={styles.uploadMeta}>Last AI sync: {upload.lastSyncAt}</Text> : null}

                    {upload.parsedChapters.length ? (
                      <View style={styles.summaryPanel}>
                        <Text style={styles.statusTitle}>Practice summary</Text>
                        <View style={styles.summaryRow}>
                          <Badge text={`Answered ${summary.totalAnswered}/${summary.totalQuestions}`} tone="accent" />
                          <Badge text={`Correct ${summary.totalCorrect}`} tone="success" />
                          <Badge text={`Wrong ${summary.totalWrong}`} tone="danger" />
                          <Badge text={`Accuracy ${summary.accuracy}%`} tone="warning" />
                        </View>
                        <Text style={styles.statusLine}>Weakest area right now: {summary.weakestArea}</Text>
                        <View style={styles.buttonRow}>
                          <ActionButton label="Reset answers" icon="refresh-outline" onPress={() => resetPracticeAnswers(upload.subject)} compact />
                        </View>
                        <View style={styles.studyFocusCard}>
                          <Text style={styles.statusTitle}>What to study next</Text>
                          <Text style={styles.statusLine}>Weakest chapter: {studyFocus.weakestChapter}</Text>
                          <Text style={styles.statusLine}>{studyFocus.notesSummary}</Text>
                          {studyFocus.focusTopics.length ? (
                            <View style={styles.summaryRow}>
                              {studyFocus.focusTopics.map((topic) => (
                                <Badge key={topic} text={topic} tone="accent" />
                              ))}
                            </View>
                          ) : null}
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
                                <>
                                  {chapter.notesSummary ? <Text style={styles.chapterSummary}>{chapter.notesSummary}</Text> : null}
                                  {chapter.revisionFocus.length ? (
                                    <View style={styles.summaryRow}>
                                      {chapter.revisionFocus.map((item) => (
                                        <Badge key={item} text={item} tone="warning" />
                                      ))}
                                    </View>
                                  ) : null}
                                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <View style={styles.questionStack}>
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
                                                const revealCorrect = Boolean(selected && question.answer && option.trim().toLowerCase() === question.answer.trim().toLowerCase());
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
                                  </ScrollView>
                                </>
                              ) : null}
                            </View>
                          );
                        })}
                      </View>
                    ) : upload.aiSummary ? (
                      <View style={styles.aiSummaryCard}>
                        <Text style={styles.statusTitle}>Latest AI output</Text>
                        <Text style={styles.aiSummaryText}>{upload.aiSummary}</Text>
                      </View>
                    ) : null}
                  </>
                ) : null}
              </View>
            );
          })
        ) : (
          <EmptyState text="No uploads yet." />
        )}
      </Panel>

      <Panel title="What AI is doing here" icon="sparkles-outline">
        <View style={styles.modeCard}>
          <Text style={styles.modeTitle}>Current flow</Text>
          <Text style={styles.modeMeta}>1. Upload notes and question bank.</Text>
          <Text style={styles.modeMeta}>2. AI groups questions chapter-wise.</Text>
          <Text style={styles.modeMeta}>3. You answer inside the app and get a score summary.</Text>
          <Text style={styles.modeMeta}>4. The weakest chapter becomes clear from your results.</Text>
        </View>
        <Text style={styles.copy}>Subjects parsed so far: {overallReadyText}.</Text>
      </Panel>

      <Panel title="What comes next" icon="construct-outline">
        <Text style={styles.copy}>
          The next upgrade can generate new reinforcement questions from the chapters you get wrong most often, so the app becomes more like a personal tutor instead of only a tracker.
        </Text>
      </Panel>

      <Panel title="Study assistant" icon="chatbubble-ellipses-outline">
        <Text style={styles.copy}>
          Ask about your notes, wrong answers, chapter traps, or exam tips. The assistant uses the material you already uploaded for that subject.
        </Text>
        {parsedSubjects.length ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subjectChipRow}>
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
              placeholder="Ask: what topics should I revise in Rate and Return?"
              placeholderTextColor={colors.inkSoft}
              multiline
            />
            <View style={styles.buttonRow}>
              <ActionButton
                label={assistantLoading ? "Thinking..." : "Ask assistant"}
                icon="sparkles-outline"
                onPress={() => void handleAssistantQuestion()}
                compact
              />
            </View>
            {assistantAnswer ? (
              <View style={styles.aiSummaryCard}>
                <Text style={styles.statusTitle}>Assistant answer</Text>
                <Text style={styles.aiSummaryText}>{assistantAnswer}</Text>
              </View>
            ) : null}
          </>
        ) : (
          <EmptyState text="Sync a subject with AI first, then you can ask the assistant about it." />
        )}
      </Panel>
    </>
  );
}

const styles = StyleSheet.create({
  copy: {
    color: colors.inkSoft,
    lineHeight: 20,
  },
  uploadCard: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  uploadHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
  },
  uploadBadgeStack: {
    gap: 6,
    alignItems: "flex-end",
  },
  uploadTitle: {
    color: colors.ink,
    fontWeight: "800",
  },
  uploadMeta: {
    color: colors.inkSoft,
    fontSize: 12,
    marginTop: 2,
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
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
  summaryPanel: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 10,
  },
  studyFocusCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 8,
  },
  statusTitle: {
    color: colors.ink,
    fontWeight: "800",
  },
  statusLine: {
    color: colors.inkSoft,
    lineHeight: 19,
  },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chapterCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
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
  chapterSummary: {
    color: colors.inkSoft,
    lineHeight: 19,
  },
  questionStack: {
    gap: 12,
  },
  questionCard: {
    width: 300,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    gap: 10,
    marginRight: 10,
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
    backgroundColor: colors.surfaceMuted,
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
    backgroundColor: colors.surfaceMuted,
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
  modeCard: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  modeTitle: {
    color: colors.ink,
    fontWeight: "800",
  },
  modeMeta: {
    color: colors.inkSoft,
    lineHeight: 19,
  },
  aiSummaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 6,
  },
  aiSummaryText: {
    color: colors.inkSoft,
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
    minHeight: 90,
    textAlignVertical: "top",
  },
  flex: {
    flex: 1,
  },
});
