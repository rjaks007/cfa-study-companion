import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, PanResponder, Platform, Pressable, RefreshControl, SafeAreaView, StatusBar, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { CloudSyncCard } from "./src/components/CloudSyncCard";
import { MetricCard } from "./src/components/ui";
import { APP_VERSION, TABS } from "./src/constants";
import { useStudyCompanion } from "./src/hooks/useStudyCompanion";
import { OverviewScreen } from "./src/screens/OverviewScreen";
import { PracticeScreen } from "./src/screens/PracticeScreen";
import { ProgressScreen } from "./src/screens/ProgressScreen";
import { WeeklyPlanScreen } from "./src/screens/WeeklyPlanScreen";
import { colors } from "./src/theme";
import { AppTab, Reading, Subject } from "./src/types";
import { buildStudyNext } from "./src/utils/coverage";
import { formatInputDate, parseInputDate } from "./src/utils/study";

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("overview");
  const [weeklyTarget, setWeeklyTarget] = useState<{ week?: number; readingId?: string }>({});
  const [practiceTarget, setPracticeTarget] = useState<{ subject?: Subject; chapterTitle?: string }>({});
  const [reviewRequest, setReviewRequest] = useState<{ subject?: Subject; chapterTitle?: string; nonce?: string }>({});
  // Kept at the app level so the assistant conversation survives switching tabs.
  const [assistantQuestion, setAssistantQuestion] = useState("");
  const [assistantMessages, setAssistantMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  // Kept at the app level so the Practice tab remembers your subject/chapter across tabs.
  const [practiceSubject, setPracticeSubject] = useState<Subject | null>(null);
  const [practiceChapter, setPracticeChapter] = useState("");
  const [dailyCardsRequest, setDailyCardsRequest] = useState<{ nonce?: string }>({});
  const [studySetupDate, setStudySetupDate] = useState("");
  const [setupExpanded, setSetupExpanded] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const scrollRef = useRef<any>(null);
  const study = useStudyCompanion();
  const tabIndex = TABS.findIndex((tab) => tab.id === activeTab);
  const studyNext = useMemo(() => buildStudyNext(study.studyState.uploads), [study.studyState.uploads]);
  const dueCardCount = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return study.studyState.cards.filter((card) => !card.suspended && (!card.nextReview || card.nextReview <= today)).length;
  }, [study.studyState.cards]);

  function startDailyCards() {
    setDailyCardsRequest({ nonce: `daily-${Date.now()}` });
    setActiveTab("practice");
  }

  const [refreshing, setRefreshing] = useState(false);
  async function handleSyncRefresh() {
    if (!study.studyState.syncCode || refreshing) return;
    setRefreshing(true);
    try {
      await study.syncNow();
    } finally {
      setRefreshing(false);
    }
  }
  const syncBusy = refreshing || study.cloudSyncStatus === "syncing";

  useEffect(() => {
    setStudySetupDate(formatInputDate(study.studyState.startDate));
  }, [study.studyState.startDate]);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // iOS standalone PWAs ("Add to Home Screen") are suspended when backgrounded
  // and often resume in a stale, half-frozen JS state — taps misfire across the
  // app until you force-quit and relaunch. To get that clean state automatically,
  // reload the page when it becomes visible again after being hidden a while.
  // Only in standalone mode (a normal Safari tab doesn't have this problem), and
  // only after a real background gap so quick app-switches don't reload.
  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") return;
    const isStandalone =
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      window.matchMedia?.("(display-mode: standalone)")?.matches === true;
    if (!isStandalone) return;
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
      } else if (document.visibilityState === "visible" && hiddenAt) {
        const awayMs = Date.now() - hiddenAt;
        hiddenAt = 0;
        if (awayMs > 45000) window.location.reload();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    const ref = scrollRef.current;
    setTimeout(() => {
      if (!ref) return;
      if (typeof ref.scrollToPosition === "function") {
        ref.scrollToPosition(0, 0, false);
      } else if (typeof ref.scrollTo === "function") {
        ref.scrollTo({ x: 0, y: 0, animated: false });
      }
    }, 0);
  }, [activeTab]);

  function openWeeklyForSubject(subject: Subject) {
    study.setSelectedSubject(subject);
    study.setWeeklySelectedSubject(subject);
    setWeeklyTarget({});
    setActiveTab("weekly");
  }

  function openWeeklyForReading(reading: Reading) {
    study.setSelectedSubject(reading.subject);
    study.setWeeklySelectedSubject(reading.subject);
    study.setSelectedReadingId(reading.id);
    setWeeklyTarget({ week: reading.weekAssigned, readingId: reading.id });
    setActiveTab("weekly");
  }

  function openWeeklyFromOverview(reading: { id: string }) {
    const matched = study.readingMap[reading.id];
    if (!matched) return;
    openWeeklyForReading(matched);
  }

  function clearWeeklyTarget() {
    setWeeklyTarget({});
  }

  function clearPracticeTarget() {
    setPracticeTarget({});
  }

  function openPracticeForReading(reading: Reading) {
    setPracticeTarget({ subject: reading.subject, chapterTitle: reading.title });
    setActiveTab("practice");
  }

  function openPracticeFromOverview(reading: { subject: string; title: string }) {
    setPracticeTarget({ subject: reading.subject as Subject, chapterTitle: reading.title });
    setActiveTab("practice");
  }

  function startReviewQuiz(reading: { subject: string; title: string }) {
    setReviewRequest({ subject: reading.subject as Subject, chapterTitle: reading.title, nonce: `${reading.title}-${Date.now()}` });
    setActiveTab("practice");
  }

  function scrollPracticeBottomIntoView() {
    // KeyboardAwareScrollView already scrolls the focused field into view;
    // the old forced jump is what pushed inputs off-screen, so this is now a no-op.
  }

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gestureState) => Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 18,
        onPanResponderRelease: (_event, gestureState) => {
          if (Math.abs(gestureState.dx) < 60) return;
          if (gestureState.dx < 0 && tabIndex < TABS.length - 1) {
            setActiveTab(TABS[tabIndex + 1].id);
          } else if (gestureState.dx > 0 && tabIndex > 0) {
            setActiveTab(TABS[tabIndex - 1].id);
          }
        },
      }),
    [tabIndex],
  );

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
      <View style={styles.flex}>
        <View style={styles.flex} {...panResponder.panHandlers}>
          <KeyboardAwareScrollView
            innerRef={(ref) => {
              scrollRef.current = ref;
            }}
            style={styles.screen}
            contentContainerStyle={[styles.content, keyboardVisible ? styles.contentKeyboardOpen : styles.contentWithTabs]}
            enableOnAndroid
            enableAutomaticScroll
            extraScrollHeight={Platform.OS === "android" ? 40 : 24}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            refreshControl={
              study.studyState.syncCode ? (
                <RefreshControl refreshing={refreshing} onRefresh={handleSyncRefresh} tintColor={colors.primary} colors={[colors.primary]} />
              ) : undefined
            }
          >
            {activeTab === "overview" ? (
              <View style={styles.hero}>
                <View style={styles.heroBadge}>
                  <Ionicons name="school-outline" size={15} color={colors.primary} />
                  <Text style={styles.heroBadgeText}>CFA Study Companion</Text>
                </View>
                <Text style={styles.heroTitle}>Stay on track. Review at the right time.</Text>
                <View style={styles.metricRow}>
                  <MetricCard label="Week" value={`${study.currentWeek}/26`} icon="calendar-outline" />
                  <MetricCard label="Syllabus" value={`${study.syllabusProgress}%`} icon="checkmark-circle-outline" />
                  <MetricCard label="This week" value={`${study.weekProgress.done}/${study.weekProgress.total || 0}`} icon="list-outline" />
                  <MetricCard label="Due now" value={String(study.dueTodayReadings.length)} icon="notifications-outline" />
                </View>
              </View>
            ) : null}

            {activeTab === "overview" ? (
              <OverviewScreen
                weekProgress={study.weekProgress}
                dueTodayReadings={study.dueTodayReadings}
                dueTomorrowReadings={study.dueTomorrowReadings}
                overdueReadings={study.overdueReadings}
                todayPlan={study.todayPlan}
                planEndDate={study.planEndDate}
                notificationsEnabled={study.studyState.notificationsEnabled}
                onEnableNotifications={study.enableReviewNotifications}
                onOpenWeekly={() => {
                  setWeeklyTarget({});
                  setActiveTab("weekly");
                }}
                onOpenStudyReading={openWeeklyFromOverview}
                onMarkReviewUpdated={study.markReviewUpdated}
                onStartReviewQuiz={startReviewQuiz}
                studyNext={studyNext}
                studyGarden={study.studyGarden}
                dueCardCount={dueCardCount}
                onStartDailyCards={startDailyCards}
                remindersPromptDismissed={study.studyState.remindersPromptDismissed}
                onDismissReminders={study.dismissRemindersPrompt}
              />
            ) : null}
            {activeTab === "overview" ? (
              <Pressable style={styles.setupCard} onPress={() => setSetupExpanded((current) => !current)}>
                <View style={styles.setupHeader}>
                  <Text style={styles.sectionLabel}>Study setup</Text>
                  <Ionicons name={setupExpanded ? "chevron-up-outline" : "chevron-down-outline"} size={18} color={colors.inkSoft} />
                </View>
                <Text style={styles.setupMeta}>Plan starts on {formatInputDate(study.studyState.startDate)}</Text>
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
            ) : null}
            {activeTab === "overview" ? (
              <CloudSyncCard
                syncCode={study.studyState.syncCode}
                syncStatus={study.cloudSyncStatus}
                syncAt={study.cloudSyncAt}
                onInit={study.initSync}
                onJoin={study.joinSync}
                onUnlink={study.unlinkSync}
                onForcePush={study.forcePush}
                onSyncNow={study.syncNow}
              />
            ) : null}
            {activeTab === "overview" ? (
              <Text style={styles.versionText}>v{APP_VERSION}</Text>
            ) : null}

            {activeTab === "weekly" ? (
              <WeeklyPlanScreen
                currentWeek={study.currentWeek}
                weeks={study.studyState.weeks}
                readingMap={study.readingMap}
                getRoadmapReadingTitle={study.getDisplayReadingTitle}
                isRoadmapReadingHidden={study.isRoadmapReadingHidden}
                renameRoadmapReading={study.renameRoadmapReading}
                hideRoadmapReading={study.hideRoadmapReading}
                restoreRoadmapReading={study.restoreRoadmapReading}
                recalculateRoadmap={study.recalculateRoadmap}
                selectedSubject={study.studyState.weeklySelectedSubject}
                setSelectedSubject={study.setWeeklySelectedSubject}
                cycleReadingStatus={study.cycleReadingStatus}
                setReadingStudyDate={study.setReadingStudyDate}
                setReadingConfidence={study.setReadingConfidence}
                markReviewUpdated={study.markReviewUpdated}
                snoozeReview={study.snoozeReview}
                onOpenPracticeReading={startReviewQuiz}
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
                uploads={study.studyState.uploads}
                onOpenSubject={openWeeklyForSubject}
                onOpenReading={openWeeklyForReading}
              />
            ) : null}
            {activeTab === "practice" ? (
              <>
                <View style={styles.sectionIntro}>
                  <View style={styles.sectionIntroHeader}>
                    <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
                    <Text style={styles.sectionIntroTitle}>Practice</Text>
                  </View>
                  <Text style={styles.sectionIntroText}>Build chapter sets, review mistakes, and ask for focused help from your source material.</Text>
                </View>
                <PracticeScreen
                  uploads={study.studyState.uploads}
                  readings={study.studyState.readings}
                  backendBaseUrl={study.studyState.backendBaseUrl}
                  setBackendBaseUrl={study.setBackendBaseUrl}
                  pickPdf={study.pickPdf}
                  syncSubjectWithAi={study.syncSubjectWithAi}
                  syncingSubject={study.syncingSubject}
                  askPracticeAssistant={study.askPracticeAssistant}
                  generatePracticeSet={study.generatePracticeSet}
                  answerGeneratedQuestion={study.answerGeneratedQuestion}
                  saveCurrentPracticeSet={study.saveCurrentPracticeSet}
                  openSavedPracticeSet={study.openSavedPracticeSet}
                  deleteSavedPracticeSet={study.deleteSavedPracticeSet}
                  savePracticeQuestion={study.savePracticeQuestion}
                  deleteSavedQuestion={study.deleteSavedQuestion}
                  analyzeGeneratedPractice={study.analyzeGeneratedPractice}
                  flashcards={study.studyState.cards}
                  generateChapterFlashcards={study.generateChapterFlashcards}
                  addChapterCard={study.addChapterCard}
                  reviewChapterCard={study.reviewChapterCard}
                  deleteFlashcard={study.deleteFlashcard}
                  dailyCardsRequest={dailyCardsRequest}
                  onRequestFocusBottomField={scrollPracticeBottomIntoView}
                  targetSubject={practiceTarget.subject}
                  targetChapterTitle={practiceTarget.chapterTitle}
                  onConsumeTarget={clearPracticeTarget}
                  onConsumeReview={() => setReviewRequest({})}
                  onConsumeDailyCards={() => setDailyCardsRequest({})}
                  reviewRequest={reviewRequest}
                  onCompleteReview={study.completeReviewForReading}
                  assistantQuestion={assistantQuestion}
                  setAssistantQuestion={setAssistantQuestion}
                  assistantMessages={assistantMessages}
                  setAssistantMessages={setAssistantMessages}
                  selectedSubject={practiceSubject}
                  setSelectedSubject={setPracticeSubject}
                  selectedChapter={practiceChapter}
                  setSelectedChapter={setPracticeChapter}
                />
              </>
            ) : null}
          </KeyboardAwareScrollView>

          {study.studyState.syncCode && !keyboardVisible ? (
            <Pressable
              style={styles.syncFab}
              onPress={handleSyncRefresh}
              disabled={syncBusy}
              accessibilityLabel="Sync now"
            >
              {syncBusy ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="sync-outline" size={20} color={colors.primary} />
              )}
            </Pressable>
          ) : null}

          {!keyboardVisible ? (
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
          ) : null}
        </View>
      </View>
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
    paddingTop: Platform.OS === "android" ? 44 : 24,
    gap: 16,
    width: "100%",
    maxWidth: 820,
    alignSelf: "center",
  },
  contentWithTabs: {
    paddingBottom: 32,
  },
  contentKeyboardOpen: {
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
  sectionIntro: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginTop: Platform.OS === "android" ? 6 : 0,
    gap: 6,
  },
  sectionIntroHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionIntroTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "800",
  },
  sectionIntroText: {
    color: colors.inkSoft,
    lineHeight: 20,
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
  setupMeta: {
    color: colors.inkSoft,
    fontSize: 13,
    lineHeight: 18,
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
  tabRow: {
    gap: 10,
  },
  versionText: {
    textAlign: "center",
    fontSize: 11,
    color: colors.inkSoft,
    opacity: 0.7,
    marginTop: 4,
    marginBottom: 4,
  },
  syncFab: {
    position: "absolute",
    right: 16,
    bottom: 96,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#112033",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
    zIndex: 20,
  },
  bottomTabBar: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
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
