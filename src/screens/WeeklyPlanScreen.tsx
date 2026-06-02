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
  getRoadmapReadingTitle,
  isRoadmapReadingHidden,
  renameRoadmapReading,
  hideRoadmapReading,
  restoreRoadmapReading,
  recalculateRoadmap,
  selectedSubject,
  setSelectedSubject,
  cycleReadingStatus,
  setReadingStudyDate,
  setReadingConfidence,
  markReviewUpdated,
  snoozeReview,
  onOpenPracticeReading,
  resetSubjectForRevision,
  resetAllForRevision,
  targetWeek,
  targetReadingId,
  onConsumeTarget,
}: {
  currentWeek: number;
  weeks: WeekPlan[];
  readingMap: Record<string, Reading>;
  getRoadmapReadingTitle: (readingId: string, fallback: string) => string;
  isRoadmapReadingHidden: (readingId: string) => boolean;
  renameRoadmapReading: (readingId: string, alias: string) => void;
  hideRoadmapReading: (readingId: string) => void;
  restoreRoadmapReading: (readingId: string) => void;
  recalculateRoadmap: () => void;
  selectedSubject: Subject;
  setSelectedSubject: (subject: Subject) => void;
  cycleReadingStatus: (readingId: string) => void;
  setReadingStudyDate: (readingId: string, date: string) => void;
  setReadingConfidence: (readingId: string, score: number) => void;
  markReviewUpdated: (readingId: string) => void;
  snoozeReview: (readingId: string, days?: number) => void;
  onOpenPracticeReading: (reading: Reading) => void;
  resetSubjectForRevision: (subject: Subject) => void;
  resetAllForRevision: () => void;
  targetWeek?: number;
  targetReadingId?: string;
  onConsumeTarget?: () => void;
}) {
  const FILTER_ALL = "All subjects";
  const [expandedReadingId, setExpandedReadingId] = useState<string>("");
  const [expandedWeeks, setExpandedWeeks] = useState<Record<number, boolean>>(
    Object.fromEntries(weeks.map((week) => [week.week, week.week === currentWeek])),
  );
  const [customDate, setCustomDate] = useState<Record<string, string>>({});
  const [roadmapTitleDrafts, setRoadmapTitleDrafts] = useState<Record<string, string>>({});
  const [roadmapEditorOpen, setRoadmapEditorOpen] = useState<Record<string, boolean>>({});
  const [hiddenSectionOpen, setHiddenSectionOpen] = useState(false);
  const [recentJump, setRecentJump] = useState<{ week?: number; readingId?: string }>({});
  // Default to showing the whole week ("All"); the user narrows by tapping a subject.
  const [filterValue, setFilterValue] = useState<string>(FILTER_ALL);

  useEffect(() => {
    if (!targetWeek && !targetReadingId) return;

    setExpandedWeeks((current) => ({
      ...current,
      ...(targetWeek ? { [targetWeek]: true } : {}),
    }));

    if (targetReadingId) {
      setExpandedReadingId(targetReadingId);
    }

    setRecentJump({
      week: targetWeek,
      readingId: targetReadingId,
    });

    onConsumeTarget?.();
  }, [onConsumeTarget, targetReadingId, targetWeek]);

  const currentWeekReadings = useMemo(() => {
    const baseWeek = recentJump.week || currentWeek;
    const week = weeks.find((item) => item.week === baseWeek);
    const rows = (week?.readings || []).map((id) => readingMap[id]).filter(Boolean).filter((reading) => !isRoadmapReadingHidden(reading.id));
    return filterValue === FILTER_ALL ? rows : rows.filter((reading) => reading.subject === filterValue);
  }, [FILTER_ALL, currentWeek, filterValue, isRoadmapReadingHidden, readingMap, recentJump.week, weeks]);

  const roadmapWeeks = useMemo(() => {
    if (filterValue === FILTER_ALL) return weeks;

    return weeks.filter((week) => {
      if (week.week === currentWeek) return true;
      return week.readings.some((id) => readingMap[id]?.subject === filterValue);
    });
  }, [FILTER_ALL, currentWeek, filterValue, readingMap, weeks]);

  const hiddenRoadmapReadings = useMemo(() => {
    const rows = Object.values(readingMap)
      .filter((reading) => isRoadmapReadingHidden(reading.id))
      .map((reading) => ({ reading, week: reading.weekAssigned }))
      .sort((left, right) => left.week - right.week || left.reading.readingNumber - right.reading.readingNumber);
    return filterValue === FILTER_ALL ? rows : rows.filter(({ reading }) => reading.subject === filterValue);
  }, [FILTER_ALL, filterValue, isRoadmapReadingHidden, readingMap]);

  function displayReadingTitle(reading: Reading) {
    return getRoadmapReadingTitle(reading.id, reading.title);
  }

  function toggleWeek(weekNumber: number) {
    setExpandedWeeks((current) => ({ ...current, [weekNumber]: !current[weekNumber] }));
  }

  function renderReadingCard(reading: Reading, options?: { hiddenMode?: boolean }) {
    const expanded = expandedReadingId === reading.id;
    const dateValue = customDate[reading.id] ?? reading.lastReviewed ?? "";
    const highlighted = recentJump.readingId === reading.id;
    const hiddenMode = Boolean(options?.hiddenMode);
    const displayTitle = displayReadingTitle(reading);
    const draftValue = roadmapTitleDrafts[reading.id] ?? displayTitle;
    const editorOpen = Boolean(roadmapEditorOpen[reading.id]);

    return (
      <View key={reading.id} style={[styles.readingCard, highlighted && styles.readingCardHighlighted]}>
        <Pressable style={styles.rowTop} onPress={() => setExpandedReadingId(expanded ? "" : reading.id)}>
          <View style={styles.flex}>
            <Text style={styles.rowTitle}>
              {reading.subject} · R{reading.readingNumber}
            </Text>
            <Text style={styles.rowMeta}>{displayTitle}</Text>
            <Text style={styles.rowMeta}>Cycle {reading.revisionCycle} · Last studied {reading.lastReviewed ? formatShortDate(reading.lastReviewed) : "Not yet"}</Text>
            {hiddenMode ? <Text style={styles.rowMeta}>Hidden from roadmap · Originally Week {reading.weekAssigned}</Text> : null}
          </View>
          <View style={styles.statusWrap}>
            <Pressable onPress={() => cycleReadingStatus(reading.id)}>
              <Badge text={reading.status} tone={toneForStatus(reading.status)} />
            </Pressable>
          </View>
        </Pressable>

        <View style={styles.quickRow}>
          <Badge text={`Confidence ${reading.confidence || 0}/10`} tone={reading.confidence >= 8 ? "success" : reading.confidence >= 5 ? "accent" : "neutral"} />
          <Badge text={reading.pendingReview ? "Revision due" : reading.nextReview ? `Next ${formatShortDate(reading.nextReview)}` : "No review date"} tone={reading.pendingReview ? "danger" : reading.nextReview ? "warning" : "neutral"} />
        </View>

        {expanded ? (
          <View style={styles.detailWrap}>
            {reading.pendingReview ? (
              <View style={styles.reviewDuePanel}>
                <Text style={styles.reviewDueTitle}>Review due now</Text>
                <Text style={styles.reviewDueCopy}>
                  Confirm the revision here after you actually revise the chapter. Opening the chapter alone will not clear it.
                </Text>
                <View style={styles.reviewDueActions}>
                  <Pressable style={styles.markRevisionButton} onPress={() => markReviewUpdated(reading.id)}>
                    <Text style={styles.markRevisionButtonText}>Mark revised</Text>
                  </Pressable>
                  <Pressable style={[styles.markRevisionButton, styles.practiceButton]} onPress={() => onOpenPracticeReading(reading)}>
                    <Text style={[styles.markRevisionButtonText, styles.practiceButtonText]}>Review quiz</Text>
                  </Pressable>
                  <Pressable style={[styles.markRevisionButton, styles.snoozeButton]} onPress={() => snoozeReview(reading.id, 1)}>
                    <Text style={[styles.markRevisionButtonText, styles.snoozeButtonText]}>Snooze 1 day</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

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

            <Pressable
              style={styles.editorToggle}
              onPress={() =>
                setRoadmapEditorOpen((current) => ({
                  ...current,
                  [reading.id]: !current[reading.id],
                }))
              }
            >
              <Text style={styles.sectionLabel}>Edit roadmap name</Text>
              <Badge text={editorOpen ? "Hide" : "Show"} tone="accent" />
            </Pressable>
            {editorOpen ? (
              <>
                <TextInput
                  value={draftValue}
                  onChangeText={(value) => setRoadmapTitleDrafts((current) => ({ ...current, [reading.id]: value }))}
                  onBlur={() => {
                    const value = roadmapTitleDrafts[reading.id] ?? displayTitle;
                    const trimmed = value.trim();
                    renameRoadmapReading(reading.id, trimmed);
                    setRoadmapTitleDrafts((current) => ({ ...current, [reading.id]: trimmed || displayTitle }));
                  }}
                  style={[uiStyles.input, styles.titleInput]}
                  placeholder="Rename this roadmap chapter"
                  placeholderTextColor={colors.inkSoft}
                />
                <View style={styles.renameRow}>
                  <Pressable
                    style={styles.studyButton}
                    onPress={() => {
                      const value = (roadmapTitleDrafts[reading.id] ?? displayTitle).trim();
                      renameRoadmapReading(reading.id, value);
                      setRoadmapTitleDrafts((current) => ({ ...current, [reading.id]: value || displayTitle }));
                    }}
                  >
                    <Text style={styles.studyButtonText}>Save name</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.studyButton, styles.resetButtonMuted]}
                    onPress={() => {
                      setRoadmapTitleDrafts((current) => ({ ...current, [reading.id]: reading.title }));
                      renameRoadmapReading(reading.id, "");
                    }}
                  >
                    <Text style={styles.resetButtonTextMuted}>Use original</Text>
                  </Pressable>
                  {hiddenMode ? (
                    <Pressable
                      style={[styles.studyButton, styles.restoreButton]}
                      onPress={() => restoreRoadmapReading(reading.id)}
                    >
                      <Text style={styles.restoreButtonText}>Restore</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      style={[styles.studyButton, styles.hideButton]}
                      onPress={() => hideRoadmapReading(reading.id)}
                    >
                      <Text style={styles.hideButtonText}>Hide</Text>
                    </Pressable>
                  )}
                </View>
              </>
            ) : null}

          </View>
        ) : null}
      </View>
    );
  }

  return (
    <>
      <Panel title="Weekly plan" icon="calendar-outline">
        <FieldLabel label="Subject filter" />
        <ChipSelector
          options={[FILTER_ALL, ...SUBJECT_ORDER]}
          value={filterValue}
          onChange={(value) => {
            setFilterValue(value);
            if (value !== FILTER_ALL) setSelectedSubject(value as Subject);
          }}
        />

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

      <Panel title={`Week ${recentJump.week || currentWeek}`} icon="today-outline">
        {currentWeekReadings.length ? (
          currentWeekReadings.map((reading) => renderReadingCard(reading))
        ) : (
          <EmptyState text="No readings found in this week for the selected filter." />
        )}
      </Panel>

      <Panel title="Full roadmap" icon="map-outline">
        <Text style={styles.roadmapCopy}>
          {filterValue === FILTER_ALL
            ? "Current week is expanded by default. You can rename or hide any wrong chapter label, and restore it later from the hidden list."
            : "Showing the current week plus only the weeks where this subject appears, so the roadmap stays focused."}
        </Text>
        <Pressable
          style={styles.recalcButton}
          onPress={() =>
            Alert.alert("Recalculate roadmap", "Rebuild the roadmap weeks from the current chapter list?", [
              { text: "Cancel", style: "cancel" },
              { text: "Recalculate", style: "default", onPress: recalculateRoadmap },
            ])
          }
        >
          <Text style={styles.recalcButtonText}>Recalculate roadmap</Text>
        </Pressable>
        {roadmapWeeks.map((week) => {
          const weekReadings = week.readings.map((id) => readingMap[id]).filter(Boolean).filter((reading) => !isRoadmapReadingHidden(reading.id));
          const filteredReadings = filterValue === FILTER_ALL ? weekReadings : weekReadings.filter((reading) => reading.subject === filterValue);
          const rows = filteredReadings.length ? filteredReadings : weekReadings;
          const done = rows.filter((reading) => reading.status === "done").length;
          const progress = rows.length ? Math.round((done / rows.length) * 100) : 0;
          const isExpanded = expandedWeeks[week.week];

          return (
            <View
              key={week.week}
              style={[
                styles.weekCard,
                week.week === currentWeek && styles.weekCardActive,
                recentJump.week === week.week && styles.weekCardTargeted,
              ]}
            >
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
                  rows.map((reading) => renderReadingCard(reading))
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

        <View style={styles.hiddenSection}>
          <Pressable style={styles.hiddenSectionHeader} onPress={() => setHiddenSectionOpen((current) => !current)}>
            <Text style={styles.weekTitle}>Hidden chapters</Text>
            <View style={styles.hiddenSectionHeaderRight}>
              <Badge text={`${hiddenRoadmapReadings.length}`} tone="neutral" />
              <Badge text={hiddenSectionOpen ? "Hide" : "Show"} tone="accent" />
            </View>
          </Pressable>
          {hiddenSectionOpen ? (
            <>
              <Text style={styles.hiddenSectionCopy}>
                These chapters are hidden from the roadmap until you restore them.
              </Text>
              {hiddenRoadmapReadings.length ? (
                hiddenRoadmapReadings.map(({ reading }) => renderReadingCard(reading, { hiddenMode: true }))
              ) : (
                <EmptyState text="No hidden chapters." />
              )}
            </>
          ) : null}
        </View>
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
  recalcButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 12,
  },
  recalcButtonText: {
    color: colors.primary,
    fontWeight: "800",
  },
  hiddenSection: {
    gap: 12,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  hiddenSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  hiddenSectionHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  hiddenSectionCopy: {
    color: colors.inkSoft,
    lineHeight: 18,
    fontSize: 12,
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
  weekCardTargeted: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
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
  readingCardHighlighted: {
    borderColor: colors.accent,
    backgroundColor: "#f8fbff",
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
  titleInput: {
    backgroundColor: colors.surface,
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
  renameRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  editorToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
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
  markRevisionButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  markRevisionButtonText: {
    color: colors.surface,
    fontWeight: "800",
  },
  reviewDuePanel: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 10,
  },
  reviewDueTitle: {
    color: colors.ink,
    fontWeight: "800",
    fontSize: 14,
  },
  reviewDueCopy: {
    color: colors.inkSoft,
    fontSize: 12,
    lineHeight: 18,
  },
  reviewDueActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  practiceButton: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  practiceButtonText: {
    color: colors.ink,
  },
  snoozeButton: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  snoozeButtonText: {
    color: colors.inkSoft,
  },
  hideButton: {
    backgroundColor: "#fff2f2",
    borderWidth: 1,
    borderColor: "#f4b4b4",
  },
  hideButtonText: {
    color: "#bc3a3a",
  },
  restoreButton: {
    backgroundColor: "#eef7f1",
    borderWidth: 1,
    borderColor: "#c5e4ce",
  },
  restoreButtonText: {
    color: "#2b7a4b",
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
