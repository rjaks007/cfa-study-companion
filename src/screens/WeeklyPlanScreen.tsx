import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SUBJECT_ORDER } from "../data/cfa";
import { Badge, ChipSelector, EmptyState, FieldLabel, Panel, uiStyles } from "../components/ui";
import { colors } from "../theme";
import { Reading, Subject, WeekPlan } from "../types";
import { formatShortDate } from "../utils/study";

function toneForStatus(status: Reading["status"]) {
  if (status === "done") return "success" as const;
  if (status === "in-progress") return "warning" as const;
  return "neutral" as const;
}

export function WeeklyPlanScreen({
  currentWeek,
  weeks,
  readingMap,
  selectedSubject,
  setSelectedSubject,
  cycleReadingStatus,
  setReadingStudyDate,
  setReadingConfidence,
  resetSubjectForRevision,
  resetAllForRevision,
  targetWeek,
  targetReadingId,
}: {
  currentWeek: number;
  weeks: WeekPlan[];
  readingMap: Record<string, Reading>;
  selectedSubject: Subject;
  setSelectedSubject: (subject: Subject) => void;
  cycleReadingStatus: (readingId: string) => void;
  setReadingStudyDate: (readingId: string, date: string) => void;
  setReadingConfidence: (readingId: string, score: number) => void;
  resetSubjectForRevision: (subject: Subject) => void;
  resetAllForRevision: () => void;
  targetWeek?: number;
  targetReadingId?: string;
}) {
  const [expandedReadingId, setExpandedReadingId] = useState<string>("");
  const [expandedWeeks, setExpandedWeeks] = useState<Record<number, boolean>>(
    Object.fromEntries(weeks.map((week) => [week.week, week.week === currentWeek])),
  );
  const [customDate, setCustomDate] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!targetWeek) return;
    setExpandedWeeks((current) => ({ ...current, [targetWeek]: true }));
  }, [targetWeek]);

  useEffect(() => {
    if (!targetReadingId) return;
    setExpandedReadingId(targetReadingId);
  }, [targetReadingId]);

  const currentWeekReadings = useMemo(() => {
    const week = weeks.find((item) => item.week === currentWeek);
    const rows = (week?.readings || []).map((id) => readingMap[id]).filter(Boolean);
    return rows.filter((reading) => reading.subject === selectedSubject);
  }, [currentWeek, weeks, readingMap, selectedSubject]);

  const focusedWeek = targetWeek || currentWeek;

  const focusedWeekReadings = useMemo(() => {
    const week = weeks.find((item) => item.week === focusedWeek);
    const rows = (week?.readings || []).map((id) => readingMap[id]).filter(Boolean);
    return rows.filter((reading) => reading.subject === selectedSubject);
  }, [focusedWeek, weeks, readingMap, selectedSubject]);

  const targetReading = targetReadingId ? readingMap[targetReadingId] : undefined;

  function toggleWeek(weekNumber: number) {
    setExpandedWeeks((current) => ({ ...current, [weekNumber]: !current[weekNumber] }));
  }

  function renderReadingCard(reading: Reading) {
    const expanded = expandedReadingId === reading.id;
    const dateValue = customDate[reading.id] ?? reading.lastReviewed ?? "";

    return (
      <View key={reading.id} style={styles.readingCard}>
        <Pressable style={styles.rowTop} onPress={() => setExpandedReadingId(expanded ? "" : reading.id)}>
          <View style={styles.flex}>
            <Text style={styles.rowTitle}>
              {reading.subject} · R{reading.readingNumber}
            </Text>
            <Text style={styles.rowMeta}>{reading.title}</Text>
            <Text style={styles.rowMeta}>Cycle {reading.revisionCycle} · Last studied {reading.lastReviewed ? formatShortDate(reading.lastReviewed) : "Not yet"}</Text>
          </View>
          <View style={styles.statusWrap}>
            <Pressable onPress={() => cycleReadingStatus(reading.id)}>
              <Badge text={reading.status} tone={toneForStatus(reading.status)} />
            </Pressable>
          </View>
        </Pressable>

        <View style={styles.quickRow}>
          <Badge text={`Confidence ${reading.confidence || 0}/10`} tone={reading.confidence >= 8 ? "success" : reading.confidence >= 5 ? "accent" : "neutral"} />
          <Badge text={reading.nextReview ? `Next ${formatShortDate(reading.nextReview)}` : "No review date"} tone={reading.nextReview ? "warning" : "neutral"} />
        </View>

        {expanded ? (
          <View style={styles.detailWrap}>
            <View style={styles.dateRow}>
              <TextInput
                value={dateValue}
                onChangeText={(value) => setCustomDate((current) => ({ ...current, [reading.id]: value }))}
                style={[uiStyles.input, styles.dateInput]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.inkSoft}
              />
              <Pressable style={styles.studyButton} onPress={() => setReadingStudyDate(reading.id, dateValue || new Date().toISOString().slice(0, 10))}>
                <Text style={styles.studyButtonText}>Save study date</Text>
              </Pressable>
              <Pressable style={[styles.studyButton, styles.studyTodayButton]} onPress={() => setReadingStudyDate(reading.id, new Date().toISOString().slice(0, 10))}>
                <Text style={[styles.studyButtonText, styles.studyTodayText]}>Study today</Text>
              </Pressable>
            </View>

            <Text style={styles.sectionLabel}>Confidence</Text>
            <View style={styles.confidenceRow}>
              {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => (
                <Pressable key={score} style={[styles.confidenceButton, reading.confidence === score && styles.confidenceButtonActive]} onPress={() => setReadingConfidence(reading.id, score)}>
                  <Text style={[styles.confidenceText, reading.confidence === score && styles.confidenceTextActive]}>{score}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <>
      <Panel title="Weekly plan" icon="calendar-outline">
        <FieldLabel label="Subject filter" />
        <ChipSelector options={SUBJECT_ORDER} value={selectedSubject} onChange={(value) => setSelectedSubject(value as Subject)} />

        <View style={styles.resetRow}>
          <Pressable
            style={styles.resetButton}
            onPress={() =>
              Alert.alert("Reset subject", `Start a new revision cycle for ${selectedSubject}?`, [
                { text: "Cancel", style: "cancel" },
                { text: "Reset", style: "destructive", onPress: () => resetSubjectForRevision(selectedSubject) },
              ])
            }
          >
            <Text style={styles.resetButtonText}>Reset subject for revision</Text>
          </Pressable>
          <Pressable
            style={[styles.resetButton, styles.resetButtonMuted]}
            onPress={() =>
              Alert.alert("Reset all", "Start a new revision cycle for all subjects?", [
                { text: "Cancel", style: "cancel" },
                { text: "Reset all", style: "destructive", onPress: resetAllForRevision },
              ])
            }
          >
            <Text style={[styles.resetButtonText, styles.resetButtonTextMuted]}>Reset all</Text>
          </Pressable>
        </View>
      </Panel>

      <Panel title={`${targetWeek ? "Focused week" : "This week first"} · Week ${focusedWeek}`} icon={targetWeek ? "locate-outline" : "today-outline"}>
        {targetWeek ? (
          <Text style={styles.roadmapCopy}>
            You opened this chapter from Progress, so this panel is locked onto the exact study week for that topic.
          </Text>
        ) : null}
        {targetReading && targetWeek && targetReading.subject === selectedSubject ? (
          renderReadingCard(targetReading)
        ) : focusedWeekReadings.length ? (
          focusedWeekReadings.map(renderReadingCard)
        ) : (
          <EmptyState text="No readings found in this week for the selected subject." />
        )}
      </Panel>

      {targetWeek && targetWeek !== currentWeek ? (
        <Panel title={`Current week preview · Week ${currentWeek}`} icon="today-outline">
          {currentWeekReadings.length ? currentWeekReadings.map(renderReadingCard) : <EmptyState text="No readings this week for the selected subject." />}
        </Panel>
      ) : null}

      <Panel title="Full roadmap" icon="map-outline">
        <Text style={styles.roadmapCopy}>
          Current week is expanded by default. Open any future week to see what is coming next without losing focus on the current plan.
        </Text>
        {weeks.map((week) => {
          const weekReadings = week.readings.map((id) => readingMap[id]).filter(Boolean);
          const filteredReadings = weekReadings.filter((reading) => reading.subject === selectedSubject);
          const rows = filteredReadings.length ? filteredReadings : weekReadings;
          const done = rows.filter((reading) => reading.status === "done").length;
          const progress = rows.length ? Math.round((done / rows.length) * 100) : 0;
          const isExpanded = expandedWeeks[week.week];

          return (
            <View key={week.week} style={[styles.weekCard, week.week === currentWeek && styles.weekCardActive]}>
              <Pressable style={styles.weekHeader} onPress={() => toggleWeek(week.week)}>
                <View style={styles.flex}>
                  <Text style={styles.weekTitle}>Week {week.week}</Text>
                  <Text style={styles.weekMeta}>{week.type}</Text>
                </View>
                <View style={styles.weekBadgeRow}>
                  {week.week === currentWeek ? <Badge text="Current" tone="primary" /> : null}
                  <Badge text={`${progress}%`} tone="neutral" />
                  <Badge text={isExpanded ? "Hide" : "Show"} tone="accent" />
                </View>
              </Pressable>

              {isExpanded ? (
                rows.length ? (
                  rows.map(renderReadingCard)
                ) : (
                  <View style={styles.focusWrap}>
                    {(week.revisionFocus || []).map((item) => (
                      <Badge key={item} text={item} tone="accent" />
                    ))}
                  </View>
                )
              ) : null}
            </View>
          );
        })}
      </Panel>
    </>
  );
}

const styles = StyleSheet.create({
  resetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  resetButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  resetButtonMuted: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resetButtonText: {
    color: colors.surface,
    fontWeight: "800",
  },
  resetButtonTextMuted: {
    color: colors.ink,
  },
  roadmapCopy: {
    color: colors.inkSoft,
    lineHeight: 20,
  },
  weekCard: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 14,
    gap: 12,
  },
  weekCardActive: {
    backgroundColor: "#e7f4f2",
    borderColor: "#9ed5ce",
  },
  weekHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  weekTitle: {
    color: colors.ink,
    fontWeight: "800",
    fontSize: 16,
  },
  weekMeta: {
    color: colors.inkSoft,
    fontSize: 12,
    marginTop: 4,
  },
  weekBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-end",
  },
  readingCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 14,
    gap: 10,
  },
  rowTop: {
    flexDirection: "row",
    gap: 12,
  },
  rowTitle: {
    color: colors.ink,
    fontWeight: "800",
    fontSize: 14,
  },
  rowMeta: {
    color: colors.inkSoft,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
  statusWrap: {
    justifyContent: "center",
  },
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  detailWrap: {
    gap: 10,
    paddingTop: 4,
  },
  dateRow: {
    gap: 10,
  },
  dateInput: {
    backgroundColor: colors.surfaceMuted,
  },
  studyButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  studyTodayButton: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primarySoft,
  },
  studyButtonText: {
    color: colors.ink,
    fontWeight: "700",
  },
  studyTodayText: {
    color: colors.primary,
  },
  sectionLabel: {
    color: colors.ink,
    fontWeight: "800",
    fontSize: 13,
  },
  confidenceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  confidenceButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  confidenceButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  confidenceText: {
    color: colors.ink,
    fontWeight: "800",
  },
  confidenceTextActive: {
    color: colors.surface,
  },
  focusWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  flex: {
    flex: 1,
  },
});
