import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from "react-native";
import { MetricCard, MiniStat } from "./src/components/ui";
import { TABS } from "./src/constants";
import { useStudyCompanion } from "./src/hooks/useStudyCompanion";
import { OverviewScreen } from "./src/screens/OverviewScreen";
import { PracticeScreen } from "./src/screens/PracticeScreen";
import { ProgressScreen } from "./src/screens/ProgressScreen";
import { WeeklyPlanScreen } from "./src/screens/WeeklyPlanScreen";
import { colors } from "./src/theme";
import { AppTab, Reading, Subject } from "./src/types";
import { formatInputDate, parseInputDate } from "./src/utils/study";

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("overview");
  const [weeklyTarget, setWeeklyTarget] = useState<{ week?: number; readingId?: string }>({});
  const [studySetupDate, setStudySetupDate] = useState("");
  const study = useStudyCompanion();

  useEffect(() => {
    setStudySetupDate(formatInputDate(study.studyState.startDate));
  }, [study.studyState.startDate]);

  function openWeeklyForSubject(subject: Subject) {
    study.setSelectedSubject(subject);
    setWeeklyTarget({});
    setActiveTab("weekly");
  }

  function openWeeklyForReading(reading: Reading) {
    study.setSelectedSubject(reading.subject);
    study.setSelectedReadingId(reading.id);
    setWeeklyTarget({ week: reading.weekAssigned, readingId: reading.id });
    setActiveTab("weekly");
  }

  if (!study.isHydrated) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading your CFA study desk...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <View style={styles.heroBadge}>
              <Ionicons name="school-outline" size={15} color={colors.primary} />
              <Text style={styles.heroBadgeText}>CFA Study Companion</Text>
            </View>
            <Text style={styles.heroTitle}>Stay on track. Review at the right time.</Text>
            <Text style={styles.heroSubtitle}>
              Built for a clean CFA workflow: see this week, update chapters fast, track confidence, and let review dates organize themselves.
            </Text>
            <View style={styles.metricRow}>
              <MetricCard label="Week" value={`${study.currentWeek}/26`} icon="calendar-outline" />
              <MetricCard label="Syllabus" value={`${study.syllabusProgress}%`} icon="checkmark-circle-outline" />
              <MetricCard label="This week" value={`${study.weekProgress.done}/${study.weekProgress.total || 0}`} icon="list-outline" />
              <MetricCard label="Due tomorrow" value={String(study.dueTomorrowReadings.length)} icon="notifications-outline" />
            </View>
            <View style={styles.setupCard}>
              <Text style={styles.sectionLabel}>Study setup</Text>
              <TextInput
                value={studySetupDate}
                onChangeText={setStudySetupDate}
                onBlur={() => {
                  const parsed = parseInputDate(studySetupDate);
                  if (parsed) {
                    study.setStartDate(parsed);
                    setStudySetupDate(formatInputDate(parsed));
                  } else {
                    setStudySetupDate(formatInputDate(study.studyState.startDate));
                  }
                }}
                style={styles.input}
                placeholder="DD/MM/YYYY"
                placeholderTextColor={colors.inkSoft}
              />
              <View style={styles.setupStatsRow}>
                <MiniStat label="Plan end" value={formatInputDate(study.planEndDate)} />
                <MiniStat label="Readiness" value={`${study.examReadiness}%`} />
                <MiniStat label="Overdue" value={String(study.overdueReadings.length)} />
              </View>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
            {TABS.map((tab) => (
              <Pressable key={tab.id} style={[styles.tabChip, activeTab === tab.id && styles.tabChipActive]} onPress={() => setActiveTab(tab.id)}>
                <Ionicons name={tab.icon as keyof typeof Ionicons.glyphMap} size={16} color={activeTab === tab.id ? colors.surface : colors.inkSoft} />
                <Text style={[styles.tabChipText, activeTab === tab.id && styles.tabChipTextActive]}>{tab.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {activeTab === "overview" ? (
            <OverviewScreen
              currentWeek={study.currentWeek}
              syllabusProgress={study.syllabusProgress}
              weekProgress={study.weekProgress}
              dueTomorrowReadings={study.dueTomorrowReadings}
              overdueReadings={study.overdueReadings}
              todayPlan={study.todayPlan}
              notificationsEnabled={study.studyState.notificationsEnabled}
              onEnableNotifications={study.enableReviewNotifications}
              onOpenWeekly={() => {
                setWeeklyTarget({});
                setActiveTab("weekly");
              }}
            />
          ) : null}

          {activeTab === "weekly" ? (
            <WeeklyPlanScreen
              currentWeek={study.currentWeek}
              weeks={study.studyState.weeks}
              readingMap={study.readingMap}
              selectedSubject={study.studyState.selectedSubject}
              setSelectedSubject={study.setSelectedSubject}
              cycleReadingStatus={study.cycleReadingStatus}
              setReadingStudyDate={study.setReadingStudyDate}
              setReadingConfidence={study.setReadingConfidence}
              resetSubjectForRevision={study.resetSubjectForRevision}
              resetAllForRevision={study.resetAllForRevision}
              targetWeek={weeklyTarget.week}
              targetReadingId={weeklyTarget.readingId}
            />
          ) : null}

          {activeTab === "progress" ? (
            <ProgressScreen
              subjectStats={study.subjectStats}
              readings={study.studyState.readings}
              onOpenSubject={openWeeklyForSubject}
              onOpenReading={openWeeklyForReading}
            />
          ) : null}
          {activeTab === "practice" ? (
            <PracticeScreen
              uploads={study.studyState.uploads}
              backendBaseUrl={study.studyState.backendBaseUrl}
              setBackendBaseUrl={study.setBackendBaseUrl}
              pickPdf={study.pickPdf}
              syncSubjectWithAi={study.syncSubjectWithAi}
              syncingSubject={study.syncingSubject}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
  },
  content: {
    padding: 18,
    paddingTop: Platform.OS === "android" ? 30 : 22,
    gap: 16,
    paddingBottom: 28,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    color: colors.inkSoft,
    fontSize: 15,
  },
  hero: {
    backgroundColor: colors.surface,
    borderRadius: 26,
    padding: 18,
    marginTop: Platform.OS === "android" ? 8 : 0,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 16,
  },
  heroBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  heroBadgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 33,
    fontWeight: "800",
    color: colors.ink,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.inkSoft,
  },
  metricRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  setupCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 22,
    padding: 14,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.inkSoft,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 14,
  },
  setupStatsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  tabRow: {
    gap: 10,
  },
  tabChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabChipText: {
    color: colors.inkSoft,
    fontWeight: "700",
  },
  tabChipTextActive: {
    color: colors.surface,
  },
});
