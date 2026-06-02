import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Badge, EmptyState, Panel, ProgressBar } from "../components/ui";
import { colors } from "../theme";
import { Reading, Subject, UploadRecord } from "../types";
import { buildTopicCoverage } from "../utils/coverage";

export function ProgressScreen({
  subjectStats,
  readings,
  uploads,
  onOpenSubject,
  onOpenReading,
}: {
  subjectStats: Array<{ subject: Subject; total: number; done: number; avg: number; due: number; progress: number }>;
  readings: Reading[];
  uploads: UploadRecord[];
  onOpenSubject: (subject: Subject) => void;
  onOpenReading: (reading: Reading) => void;
}) {
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});

  function toggleSubject(subject: Subject) {
    setExpandedSubjects((current) => ({ ...current, [subject]: !current[subject] }));
  }

  const uploadBySubject = useMemo(() => {
    const map = {} as Record<string, UploadRecord>;
    uploads.forEach((upload) => {
      map[upload.subject] = upload;
    });
    return map;
  }, [uploads]);

  return (
    <>
      <Panel title="Progress" icon="bar-chart-outline">
        <Text style={styles.copy}>Tap a subject to open or hide its chapters. Tap any chapter card to jump into Weekly Plan with that reading opened and highlighted in its own week.</Text>
        {subjectStats.map((stat) => {
          const subjectReadings = readings.filter((reading) => reading.subject === stat.subject);
          const isExpanded = expandedSubjects[stat.subject] ?? false;

          return (
            <View key={stat.subject} style={styles.subjectCard}>
              <Pressable style={styles.subjectHeader} onPress={() => toggleSubject(stat.subject)}>
                <View style={styles.flex}>
                  <Text style={styles.subjectTitle}>{stat.subject}</Text>
                  <Text style={styles.subjectMeta}>
                    {stat.done}/{stat.total} done · Avg confidence {stat.avg}/10 · {stat.due} due
                  </Text>
                </View>
                <View style={styles.headerBadges}>
                  <Badge text={`Done ${stat.progress}%`} tone={stat.progress >= 80 ? "success" : stat.progress >= 40 ? "accent" : "neutral"} />
                  <Badge text={isExpanded ? "Hide" : "Open"} tone="accent" />
                </View>
              </Pressable>

              <ProgressBar progress={stat.progress} />
              <Pressable style={styles.jumpLine} onPress={() => onOpenSubject(stat.subject)}>
                <Text style={styles.jumpText}>Open weekly plan</Text>
              </Pressable>

              {isExpanded ? (
                <View style={styles.readingList}>
                  {subjectReadings.map((reading) => (
                    <Pressable key={reading.id} style={styles.readingRow} onPress={() => onOpenReading(reading)}>
                      <View style={styles.readingLead}>
                        <Text style={styles.readingChipTitle}>R{reading.readingNumber}</Text>
                        <View style={styles.readingTextBlock}>
                          <Text numberOfLines={1} style={styles.readingRowTitle}>
                            {reading.title}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.readingMetrics}>
                        <Badge
                          text={reading.pendingReview ? "Due" : reading.status === "done" ? "Done" : reading.status === "in-progress" ? "Studying" : "Not started"}
                          tone={reading.pendingReview ? "danger" : reading.status === "done" ? "success" : reading.status === "in-progress" ? "warning" : "neutral"}
                        />
                        <Badge text={`C${reading.confidence || 0}`} tone={reading.confidence >= 8 ? "success" : reading.confidence >= 5 ? "accent" : "danger"} />
                        {(() => {
                          const upload = uploadBySubject[reading.subject];
                          const coverage = upload ? buildTopicCoverage(upload, reading.title) : null;
                          if (!coverage || !coverage.total) return null;
                          return (
                            <Badge
                              text={`Mastery ${coverage.percent}%`}
                              tone={coverage.percent >= 80 ? "success" : coverage.percent >= 40 ? "accent" : "neutral"}
                            />
                          );
                        })()}
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </Panel>

      {!readings.length ? (
        <Panel title="No data" icon="information-circle-outline">
          <EmptyState text="Your progress will appear here once the study plan is loaded." />
        </Panel>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  copy: {
    color: colors.inkSoft,
    lineHeight: 20,
  },
  subjectCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  subjectHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
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
  headerBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-end",
  },
  jumpLine: {
    alignSelf: "flex-start",
  },
  jumpText: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 13,
  },
  readingList: {
    gap: 8,
  },
  readingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  readingLead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  readingTextBlock: {
    flex: 1,
  },
  readingChipTitle: {
    color: colors.ink,
    fontWeight: "800",
    fontSize: 12,
    minWidth: 28,
  },
  readingRowTitle: {
    color: colors.ink,
    fontWeight: "700",
    fontSize: 13,
  },
  readingChipMeta: {
    color: colors.inkSoft,
    fontSize: 12,
    marginTop: 3,
  },
  readingMetrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "flex-end",
    maxWidth: "46%",
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  studyNextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  studyNextTopic: {
    color: colors.ink,
    fontWeight: "700",
    fontSize: 14,
  },
  studyNextMeta: {
    color: colors.inkSoft,
    fontSize: 12,
    marginTop: 3,
  },
  flex: {
    flex: 1,
  },
});
