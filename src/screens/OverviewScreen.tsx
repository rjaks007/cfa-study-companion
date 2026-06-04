import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
  studyGarden: { streak: number; stage: string; weekDots: { iso: string; active: boolean }[]; bloomCount: number; progress: number; toNextBloom: number };
  dueCardCount: number;
  onStartDailyCards: () => void;
}) {
  const [studyNextOpen, setStudyNextOpen] = useState(false);
  const reviewsDue = [
    ...overdueReadings.map((reading) => ({ reading, overdue: true })),
    ...dueTodayReadings.map((reading) => ({ reading, overdue: false })),
  ];

  return (
    <>
      <View style={styles.gardenCard}>
        <View style={styles.gardenRow}>
          <StreakRing streak={studyGarden.streak} progress={studyGarden.progress} />
          <View style={styles.flex}>
            <Text style={styles.gardenTitle}>{studyGarden.streak === 0 ? "Start your streak" : "Keep it growing!"}</Text>
            <Text style={styles.gardenSub}>
              {studyGarden.streak === 0
                ? "Do any review, quiz, or card today to plant your first flower 🌱"
                : studyGarden.toNextBloom >= 7
                  ? "You just bloomed 🌸 — a fresh ring begins."
                  : `${studyGarden.toNextBloom} day${studyGarden.toNextBloom > 1 ? "s" : ""} to your next flower 🌷`}
            </Text>
            {studyGarden.bloomCount ? (
              <Text style={styles.gardenFlowers} numberOfLines={1}>
                {Array.from({ length: Math.min(studyGarden.bloomCount, 12) })
                  .map((_, index) => ["🌷", "🌻", "🌸", "🌼", "🌹"][index % 5])
                  .join(" ")}
                {studyGarden.bloomCount > 12 ? ` +${studyGarden.bloomCount - 12}` : ""}
              </Text>
            ) : null}
          </View>
        </View>

        <Pressable onPress={() => void onEnableNotifications()}>
          <Text style={styles.gardenReminders}>{notificationsEnabled ? "Daily reminders on ✓" : "Enable daily reminders"}</Text>
        </Pressable>
      </View>

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
  gardenCard: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
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
