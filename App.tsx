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
  const [setupExpanded, setSetupExpanded] = useState(false);
  const study = useStudyCompanion();
  const activeTabMeta = TABS.find((tab) => tab.id === activeTab);

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

  function clearWeeklyTarget() {
    setWeeklyTarget({});
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
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.flex}>
          <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {activeTab === "overview" ? (
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
                <Pressable style={styles.setupCard} onPress={() => setSetupExpanded((current) => !current)}>
                  <View style={styles.setupHeader}>
                    <Text style={styles.sectionLabel}>Study setup</Text>
                    <Ionicons name={setupExpanded ? "chevron-up-outline" : "chevron-down-outline"} size={18} color={colors.inkSoft} />
                  </View>
                  <View style={styles.setupStatsRow}>
                    <MiniStat label="Plan end" value={formatInputDate(study.planEndDate)} />
                    <MiniStat label="Readiness" value={`${study.examReadiness}%`} />
                    <MiniStat label="Overdue" value={String(study.overdueReadings.length)} />
                  </View>
                  {setupExpanded ? (
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
                  ) : null}
                </Pressable>
              </View>
            ) : (
              <View style={styles.compactHeader}>
                <Text style={styles.compactTitle}>{activeTabMeta?.label}</Text>
                <Text style={styles.compactSubtitle}>
                  {activeTab === "weekly"
                    ? "Keep this week moving, then look ahead only when you need to."
                    : activeTab === "progress"
                      ? "See every subject clearly, then jump into updates fast."
                      : "Turn uploaded material into questions, insights, and revision help."}
                </Text>
              </View>
            )}

            {activeTab === "overview" ? (
              <OverviewScreen
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
                onConsumeTarget={clearWeeklyTarget}
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
                answerPracticeQuestion={study.answerPracticeQuestion}
                resetPracticeAnswers={study.resetPracticeAnswers}
                askPracticeAssistant={study.askPracticeAssistant}
              />
            ) : null}
          </ScrollView>

          <View style={styles.bottomTabBar}>
            {TABS.map((tab) => (
              <Pressable key={tab.id} style={styles.bottomTab} onPress={() => setActiveTab(tab.id)}>
                <View style={[styles.bottomTabIconWrap, activeTab === tab.id && styles.bottomTabIconWrapActive]}>
                  <Ionicons name={tab.icon as keyof typeof Ionicons.glyphMap} size={18} color={activeTab === tab.id ? colors.surface : colors.inkSoft} />
                </View>
                <Text style={[styles.bottomTabText, activeTab === tab.id && styles.bottomTabTextActive]}>{tab.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
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
    paddingBottom: 130,
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
  setupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  compactHeader: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 8,
  },
  compactTitle: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "800",
  },
  compactSubtitle: {
    color: colors.inkSoft,
    lineHeight: 20,
  },
  bottomTabBar: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: Platform.OS === "ios" ? 18 : 14,
    backgroundColor: colors.surface,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    shadowColor: "#112033",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  bottomTab: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  bottomTabIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  bottomTabIconWrapActive: {
    backgroundColor: colors.primary,
  },
  bottomTabText: {
    fontSize: 11,
    color: colors.inkSoft,
    fontWeight: "700",
  },
  bottomTabTextActive: {
    color: colors.primary,
  },
});
