import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Badge, EmptyState, Panel, ProgressBar } from "../components/ui";
import { StreakRing } from "../components/StreakRing";
import { colors } from "../theme";
import { StudyNextItem } from "../utils/coverage";
import { formatLongDate } from "../utils/study";

type ReadingItem = {
  id: string;
  subject: string;
  readingNumber: number;
  title: string;
  status: string;
  confidence: number;
  nextReview: string;
  revisionCycle?: number;
  reviewHistory?: Array<{ date: string; score: number }>;
};

export function OverviewScreen({
  weekProgress,
  dueTodayReadings,
  dueTomorrowReadings,
  overdueReadings,
  todayPlan,
  planEndDate,
  notificationsEnabled,
  onEnableNotifications,
  onOpenWeekly,
  onOpenStudyReading,
  onMarkReviewUpdated,
  onStartReviewQuiz,
  studyNext,
  studyGarden,
  dueCardCount,
  onStartDailyCards,
  remindersPromptDismissed,
  onDismissReminders,
}: {
  weekProgress: { done: number; total: number; percent: number };
  dueTodayReadings: ReadingItem[];
  dueTomorrowReadings: ReadingItem[];
  overdueReadings: ReadingItem[];
  todayPlan: { current: ReadingItem[]; due: ReadingItem[] };
  planEndDate: string;
  notificationsEnabled: boolean;
  onEnableNotifications: () => Promise<boolean>;
  onOpenWeekly: () => void;
  onOpenStudyReading: (reading: ReadingItem) => void;
  onMarkReviewUpdated: (readingId: string) => void;
  onStartReviewQuiz: (reading: { subject: string; title: string }) => void;
  studyNext: StudyNextItem[];
  studyGarden: {
    streak: number;
    stage: string;
    weekDots: { iso: string; active: boolean }[];
    bloomCount: number;
    progress: number;
    toNextBloom: number;
    studiedToday: boolean;
    mood: "thriving" | "calm" | "storm";
  };
  dueCardCount: number;
  onStartDailyCards: () => void;
  remindersPromptDismissed: boolean;
  onDismissReminders: () => void;
}) {
  const [studyNextOpen, setStudyNextOpen] = useState(false);
  const [streakDetailOpen, setStreakDetailOpen] = useState(false);
  const streakCaption =
    studyGarden.streak === 0
      ? "Study anything today to begin your streak."
      : studyGarden.toNextBloom >= 7
        ? "You just bloomed — a fresh ring begins."
        : `${studyGarden.toNextBloom} day${studyGarden.toNextBloom > 1 ? "s" : ""} to your next bloom.`;
  const reviewsDue = [
    ...overdueReadings.map((reading) => ({ reading, overdue: true })),
    ...dueTodayReadings.map((reading) => ({ reading, overdue: false })),
  ];

  return (
    <>
      <Pressable style={styles.streakCard} onPress={() => setStreakDetailOpen(true)}>
        <View style={styles.streakRow}>
          <StreakRing streak={studyGarden.streak} progress={studyGarden.progress} />
          <View style={styles.flex}>
            <Text style={styles.streakHeading}>{studyGarden.streak === 0 ? "Start your streak" : "Keep it growing"}</Text>
            <Text style={styles.streakSub}>{streakCaption}</Text>
            {studyGarden.bloomCount ? (
              <View style={styles.bloomRow}>
                <View style={styles.bloomDot} />
                <Text style={styles.bloomText}>
                  {studyGarden.bloomCount} bloom{studyGarden.bloomCount === 1 ? "" : "s"} earned
                </Text>
              </View>
            ) : null}
            <Text style={styles.streakTapHint}>Tap for details</Text>
          </View>
        </View>
      </Pressable>

      {!notificationsEnabled && !remindersPromptDismissed ? (
        <View style={styles.reminderPrompt}>
          <Text style={styles.reminderText}>Want a daily nudge so you don't break your streak?</Text>
          <View style={styles.reminderActions}>
            <Pressable style={styles.reminderEnable} onPress={() => void onEnableNotifications()}>
              <Text style={styles.reminderEnableText}>Enable reminders</Text>
            </Pressable>
            <Pressable onPress={onDismissReminders}>
              <Text style={styles.reminderDismiss}>Not now</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <Modal visible={streakDetailOpen} animationType="fade" transparent onRequestClose={() => setStreakDetailOpen(false)}>
        <View style={styles.streakModalBackdrop}>
          <View style={styles.streakModalSheet}>
            <View style={styles.streakModalTop}>
              <StreakRing streak={studyGarden.streak} progress={studyGarden.progress} size={108} />
            </View>
            <Text style={styles.streakModalTitle}>
              {studyGarden.streak}-day streak · {studyGarden.bloomCount} bloom{studyGarden.bloomCount === 1 ? "" : "s"}
            </Text>
            <View style={styles.streakWeekRow}>
              {studyGarden.weekDots.map((dot) => (
                <View key={dot.iso} style={[styles.streakDay, dot.active && styles.streakDayActive]} />
              ))}
            </View>
            <Text style={styles.streakModalSub}>
              Each day you study, the ring fills a little. Complete 7 days in a row and it blooms — you earn a flower (a milestone for a full week of consistency) and a fresh ring begins.{" "}
              {studyGarden.toNextBloom >= 7 ? "You just bloomed!" : `You're ${studyGarden.toNextBloom} day${studyGarden.toNextBloom > 1 ? "s" : ""} from your next bloom.`}
            </Text>
            <Pressable style={styles.streakModalClose} onPress={() => setStreakDetailOpen(false)}>
              <Text style={styles.streakModalCloseText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Panel title="Reviews due" icon="notifications-outline">
        <Text style={styles.purpose}>Spaced reviews — keep what you've already learned from fading.</Text>
        {reviewsDue.length ? (
          reviewsDue.slice(0, 8).map(({ reading, overdue }) => (
            <View key={reading.id} style={styles.reviewTaskCard}>
              <Pressable style={styles.flex} onPress={() => onOpenStudyReading(reading)}>
                <Text style={styles.rowTitle}>{reading.subject}</Text>
                <Text style={styles.rowMeta}>
                  R{reading.readingNumber} · {reading.title}
                </Text>
                <Text style={styles.reviewMeta}>
                  Cycle {reading.revisionCycle || 1} · Revised {reading.reviewHistory?.length || 0} times · Confidence {reading.confidence || 0}/10
                </Text>
              </Pressable>
              <View style={styles.reviewActionWrap}>
                <Badge text={overdue ? "Overdue" : "Due today"} tone="danger" />
                <Pressable style={styles.quizButton} onPress={() => onStartReviewQuiz(reading)}>
                  <Text style={styles.quizButtonText}>Review quiz</Text>
                </Pressable>
                <Pressable style={styles.completeButton} onPress={() => onMarkReviewUpdated(reading.id)}>
                  <Text style={styles.completeButtonText}>Mark revised</Text>
                </Pressable>
              </View>
            </View>
          ))
        ) : (
          <EmptyState text="No reviews due. You're caught up." />
        )}
      </Panel>

      {dueCardCount ? (
        <Panel title="Cards due today" icon="albums-outline">
          <Text style={styles.purpose}>A quick spaced-repetition session — formulas and key facts.</Text>
          <Pressable style={styles.cardsDueButton} onPress={onStartDailyCards}>
            <Text style={styles.cardsDueText}>Review {Math.min(dueCardCount, 15)} card{Math.min(dueCardCount, 15) > 1 ? "s" : ""}</Text>
          </Pressable>
        </Panel>
      ) : null}

      <Panel title="This week's chapters" icon="book-outline">
        <Text style={styles.purpose}>New material on your plan for this week — your main learning.</Text>
        {todayPlan.current.length ? (
          todayPlan.current.map((reading) => (
            <Pressable key={reading.id} style={styles.rowCard} onPress={() => onOpenStudyReading(reading)}>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{reading.subject}</Text>
                <Text style={styles.rowMeta}>
                  Reading {reading.readingNumber}: {reading.title}
                </Text>
              </View>
              <Badge text={reading.status} tone="neutral" />
            </Pressable>
          ))
        ) : (
          <EmptyState text="You've finished this week's chapters." />
        )}
      </Panel>

      {studyNext.length ? (
        <Panel title="Weak spots to revisit" icon="alert-circle-outline">
          <Text style={styles.purpose}>Topics you've missed or haven't tested yet — tap one to drill it.</Text>
          <Pressable style={styles.collapseHeader} onPress={() => setStudyNextOpen((value) => !value)}>
            <Text style={styles.metaText}>
              {studyNext.length} weak topic{studyNext.length > 1 ? "s" : ""}
            </Text>
            <Badge text={studyNextOpen ? "Hide" : "Show"} tone="accent" />
          </Pressable>
          {studyNextOpen
            ? studyNext.map((item) => (
                <Pressable
                  key={`${item.reason}-${item.subject}-${item.chapterTitle}-${item.topic}`}
                  style={styles.studyNextRow}
                  onPress={() => onStartReviewQuiz({ subject: item.subject, title: item.chapterTitle })}
                >
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle}>{item.topic}</Text>
                    <Text style={styles.rowMeta}>
                      {item.subject} · {item.chapterTitle}
                    </Text>
                  </View>
                  <Badge text={item.reason === "weak" ? "Missed" : "Not tested"} tone={item.reason === "weak" ? "warning" : "neutral"} />
                </Pressable>
              ))
            : null}
        </Panel>
      ) : null}

      <View style={styles.planEndCard}>
        <View style={styles.planEndHeader}>
          <View style={styles.planEndIconWrap}>
            <Ionicons name="calendar-clear-outline" size={15} color={colors.primary} />
          </View>
          <Text style={styles.planEndLabel}>Plan ends</Text>
        </View>
        <Text style={styles.planEndValue}>{formatLongDate(planEndDate)}</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  planEndCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  planEndHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  planEndIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  planEndLabel: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  planEndValue: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
  },
  summaryCard: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    gap: 8,
  },
  sectionTitle: {
    color: colors.ink,
    fontWeight: "800",
    fontSize: 14,
  },
  metaText: {
    color: colors.inkSoft,
    fontSize: 12,
  },
  purpose: {
    color: colors.inkSoft,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 2,
  },
  streakCard: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  streakHeading: {
    color: colors.ink,
    fontWeight: "800",
    fontSize: 17,
  },
  streakSub: {
    color: colors.inkSoft,
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  bloomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 8,
  },
  bloomDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  bloomText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "800",
  },
  streakTapHint: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 8,
  },
  reminderPrompt: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
  reminderText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "600",
  },
  reminderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  reminderEnable: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  reminderEnableText: {
    color: colors.surface,
    fontWeight: "800",
    fontSize: 13,
  },
  reminderDismiss: {
    color: colors.inkSoft,
    fontWeight: "700",
    fontSize: 13,
  },
  streakModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(20,50,77,0.6)",
    justifyContent: "center",
    padding: 22,
  },
  streakModalSheet: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 20,
    gap: 14,
    alignItems: "center",
  },
  streakModalTop: {
    alignItems: "center",
  },
  streakModalTitle: {
    color: colors.ink,
    fontWeight: "800",
    fontSize: 16,
    textAlign: "center",
  },
  streakWeekRow: {
    flexDirection: "row",
    gap: 8,
  },
  streakDay: {
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  streakDayActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  streakModalSub: {
    color: colors.inkSoft,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  streakModalClose: {
    alignSelf: "stretch",
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  streakModalCloseText: {
    color: colors.surface,
    fontWeight: "800",
  },
  gardenRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  gardenTitle: {
    color: colors.ink,
    fontWeight: "800",
    fontSize: 17,
  },
  gardenTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  gardenStreak: {
    color: colors.ink,
    fontWeight: "800",
    fontSize: 18,
  },
  gardenSub: {
    color: colors.inkSoft,
    fontSize: 12,
    marginTop: 3,
  },
  gardenPlant: {
    fontSize: 40,
  },
  weekDotsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  weekDot: {
    width: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  weekDotActive: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  gardenFlowersRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  gardenFlowers: {
    fontSize: 18,
    flex: 1,
  },
  gardenReminders: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 13,
  },
  cardsDueButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  cardsDueText: {
    color: colors.surface,
    fontWeight: "800",
    fontSize: 14,
  },
  priorityTitle: {
    color: colors.ink,
    fontWeight: "800",
    fontSize: 16,
  },
  priorityMeta: {
    color: colors.inkSoft,
    lineHeight: 19,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryButtonText: {
    color: colors.surface,
    fontWeight: "800",
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: colors.ink,
    fontWeight: "800",
  },
  rowCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reviewTaskCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "flex-start",
  },
  rowTitle: {
    color: colors.ink,
    fontWeight: "700",
    fontSize: 14,
  },
  rowMeta: {
    color: colors.inkSoft,
    fontSize: 13,
    marginTop: 4,
  },
  flex: {
    flex: 1,
  },
  reviewMeta: {
    color: colors.inkSoft,
    fontSize: 12,
    marginTop: 6,
    lineHeight: 17,
  },
  reviewActionWrap: {
    alignItems: "flex-end",
    gap: 8,
  },
  completeButton: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  completeButtonText: {
    color: colors.ink,
    fontWeight: "800",
    fontSize: 12,
  },
  quizButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quizButtonText: {
    color: colors.surface,
    fontWeight: "800",
    fontSize: 12,
  },
  collapseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  studyNextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
