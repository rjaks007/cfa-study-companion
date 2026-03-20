import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Badge, EmptyState, InfoBlock, Panel, ProgressBar, uiStyles } from "../components/ui";
import { colors } from "../theme";
import { formatShortDate } from "../utils/study";

type ReadingItem = {
  id: string;
  subject: string;
  readingNumber: number;
  title: string;
  status: string;
  confidence: number;
  nextReview: string;
};

export function OverviewScreen({
  currentWeek,
  syllabusProgress,
  weekProgress,
  dueTomorrowReadings,
  overdueReadings,
  todayPlan,
  notificationsEnabled,
  onEnableNotifications,
  onOpenWeekly,
}: {
  currentWeek: number;
  syllabusProgress: number;
  weekProgress: { done: number; total: number; percent: number };
  dueTomorrowReadings: ReadingItem[];
  overdueReadings: ReadingItem[];
  todayPlan: { current: ReadingItem[]; due: ReadingItem[] };
  notificationsEnabled: boolean;
  onEnableNotifications: () => Promise<boolean>;
  onOpenWeekly: () => void;
}) {
  const nextPriority = overdueReadings[0] || todayPlan.current[0] || dueTomorrowReadings[0];

  return (
    <>
      <Panel title="Overview" icon="home-outline">
        <View style={uiStyles.twoUp}>
          <InfoBlock label="Current week" value={`Week ${currentWeek}`} />
          <InfoBlock label="Syllabus" value={`${syllabusProgress}%`} />
          <InfoBlock label="This week" value={`${weekProgress.done}/${weekProgress.total || 0}`} />
          <InfoBlock label="Due tomorrow" value={String(dueTomorrowReadings.length)} />
        </View>

        <View style={styles.progressWrap}>
          <Text style={styles.sectionTitle}>This week completion</Text>
          <ProgressBar progress={weekProgress.percent} />
          <Text style={styles.progressMeta}>{weekProgress.percent}% complete</Text>
        </View>

        <View style={styles.priorityCard}>
          <Text style={styles.sectionTitle}>Next priority</Text>
          {nextPriority ? (
            <>
              <Text style={styles.priorityTitle}>{nextPriority.subject}</Text>
              <Text style={styles.priorityMeta}>
                R{nextPriority.readingNumber} · {nextPriority.title}
              </Text>
              <View style={styles.badgeRow}>
                <Badge text={nextPriority.status} tone={nextPriority.status === "done" ? "success" : "neutral"} />
                {nextPriority.nextReview ? <Badge text={`Review ${formatShortDate(nextPriority.nextReview)}`} tone="accent" /> : null}
              </View>
            </>
          ) : (
            <Text style={styles.progressMeta}>No immediate priority. You are caught up.</Text>
          )}
          <View style={styles.actionRow}>
            <Pressable style={styles.jumpButton} onPress={onOpenWeekly}>
              <Text style={styles.jumpButtonText}>Open weekly plan</Text>
            </Pressable>
            <Pressable style={[styles.jumpButton, styles.secondaryButton]} onPress={() => void onEnableNotifications()}>
              <Text style={[styles.jumpButtonText, styles.secondaryButtonText]}>
                {notificationsEnabled ? "Reminders on" : "Enable reminders"}
              </Text>
            </Pressable>
          </View>
        </View>
      </Panel>

      <Panel title="Today’s plan" icon="sunny-outline">
        <Text style={styles.sectionTitle}>Study now</Text>
        {todayPlan.current.length ? (
          todayPlan.current.map((reading) => (
            <View key={reading.id} style={styles.rowCard}>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{reading.subject}</Text>
                <Text style={styles.rowMeta}>
                  Reading {reading.readingNumber}: {reading.title}
                </Text>
              </View>
              <Badge text={reading.status} tone="neutral" />
            </View>
          ))
        ) : (
          <EmptyState text="You have finished the current week plan." />
        )}

        <Text style={styles.sectionTitle}>Review due tomorrow</Text>
        {dueTomorrowReadings.length ? (
          dueTomorrowReadings.slice(0, 4).map((reading) => (
            <View key={reading.id} style={styles.rowCard}>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{reading.subject}</Text>
                <Text style={styles.rowMeta}>
                  R{reading.readingNumber} · {reading.title}
                </Text>
              </View>
              <Badge text="Tomorrow" tone="warning" />
            </View>
          ))
        ) : (
          <EmptyState text="No reviews are due tomorrow." />
        )}

        <Text style={styles.sectionTitle}>Overdue reviews</Text>
        {overdueReadings.length ? (
          overdueReadings.slice(0, 4).map((reading) => (
            <View key={reading.id} style={styles.rowCard}>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{reading.subject}</Text>
                <Text style={styles.rowMeta}>
                  R{reading.readingNumber} · {reading.title}
                </Text>
              </View>
              <Badge text="Overdue" tone="danger" />
            </View>
          ))
        ) : (
          <EmptyState text="No overdue reviews right now." />
        )}
      </Panel>
    </>
  );
}

const styles = StyleSheet.create({
  progressWrap: {
    gap: 8,
  },
  sectionTitle: {
    color: colors.ink,
    fontWeight: "800",
    fontSize: 14,
  },
  progressMeta: {
    color: colors.inkSoft,
    fontSize: 12,
  },
  priorityCard: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    gap: 8,
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
  jumpButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  jumpButtonText: {
    color: colors.surface,
    fontWeight: "800",
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.ink,
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
});
