import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Badge, EmptyState, Panel, ProgressBar } from "../components/ui";
import { colors } from "../theme";
import { formatLongDate, formatShortDate } from "../utils/study";

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
  weekProgress,
  dueTomorrowReadings,
  overdueReadings,
  todayPlan,
  planEndDate,
  notificationsEnabled,
  onEnableNotifications,
  onOpenWeekly,
  onOpenPracticeReading,
}: {
  weekProgress: { done: number; total: number; percent: number };
  dueTomorrowReadings: ReadingItem[];
  overdueReadings: ReadingItem[];
  todayPlan: { current: ReadingItem[]; due: ReadingItem[] };
  planEndDate: string;
  notificationsEnabled: boolean;
  onEnableNotifications: () => Promise<boolean>;
  onOpenWeekly: () => void;
  onOpenPracticeReading: (reading: ReadingItem) => void;
}) {
  const nextPriority = overdueReadings[0] || todayPlan.current[0] || dueTomorrowReadings[0];

  return (
    <>
      <View style={styles.planEndCard}>
        <Text style={styles.planEndLabel}>Plan ends</Text>
        <Text style={styles.planEndValue}>{formatLongDate(planEndDate)}</Text>
      </View>

      <Panel title="Today" icon="sunny-outline">
        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>This week completion</Text>
          <ProgressBar progress={weekProgress.percent} />
          <Text style={styles.metaText}>
            {weekProgress.done}/{weekProgress.total || 0} readings done this week
          </Text>
        </View>

        <View style={styles.summaryCard}>
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
            <Text style={styles.metaText}>No immediate priority. You are caught up.</Text>
          )}
        </View>

        <View style={styles.actionRow}>
          <Pressable style={styles.primaryButton} onPress={onOpenWeekly}>
            <Text style={styles.primaryButtonText}>Open weekly plan</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => void onEnableNotifications()}>
            <Text style={styles.secondaryButtonText}>{notificationsEnabled ? "Reminders on" : "Enable reminders"}</Text>
          </Pressable>
        </View>
      </Panel>

      <Panel title="Study now" icon="book-outline">
        {todayPlan.current.length ? (
          todayPlan.current.map((reading) => (
            <Pressable key={reading.id} style={styles.rowCard} onPress={() => onOpenPracticeReading(reading)}>
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
          <EmptyState text="You have finished the current week plan." />
        )}
      </Panel>

      <Panel title="Reviews" icon="notifications-outline">
        <Text style={styles.sectionTitle}>Due tomorrow</Text>
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

        <Text style={styles.sectionTitle}>Overdue</Text>
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
  planEndCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
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
