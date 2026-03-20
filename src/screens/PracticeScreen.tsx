import React from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { ActionButton, Badge, EmptyState, Panel, uiStyles } from "../components/ui";
import { colors } from "../theme";
import { Subject, UploadRecord } from "../types";

export function PracticeScreen({
  uploads,
  backendBaseUrl,
  setBackendBaseUrl,
  pickPdf,
  syncSubjectWithAi,
  syncingSubject,
}: {
  uploads: UploadRecord[];
  backendBaseUrl: string;
  setBackendBaseUrl: (value: string) => void;
  pickPdf: (subject: Subject, type: "notesPdfName" | "questionBankPdfName") => Promise<boolean>;
  syncSubjectWithAi: (subject: Subject) => Promise<unknown>;
  syncingSubject: Subject | null;
}) {
  async function handlePick(subject: Subject, type: "notesPdfName" | "questionBankPdfName") {
    try {
      await pickPdf(subject, type);
    } catch {
      Alert.alert("Picker failed", "I could not open the document picker on this device.");
    }
  }

  async function handleAiSync(subject: Subject) {
    try {
      await syncSubjectWithAi(subject);
      Alert.alert("AI sync complete", `The ${subject} PDFs were sent to your backend and parsed response was saved in the app.`);
    } catch (error) {
      Alert.alert("AI sync failed", error instanceof Error ? error.message : "The backend sync did not complete.");
    }
  }

  const readySubjects = uploads.filter((upload) => upload.readyForReview);

  return (
    <>
      <Panel title="Practice" icon="library-outline">
        <Text style={styles.copy}>
          This section is meant to become your chapter-wise practice engine: notes summary on one side, question tracker on the other, and AI support to identify weak areas and generate similar reinforcement questions.
        </Text>
        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>Planned chapter workflow</Text>
          <Text style={styles.statusLine}>Upload notes and question-bank PDFs for a subject.</Text>
          <Text style={styles.statusLine}>AI maps the questions chapter-wise using the notes for extra context.</Text>
          <Text style={styles.statusLine}>You answer questions chapter by chapter and get a summary of weak areas at the end.</Text>
        </View>
        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>Current status right now</Text>
          <Text style={styles.statusLine}>The app still only stores which files were uploaded.</Text>
          <Text style={styles.statusLine}>It does not yet read the PDF contents, extract questions, classify chapters, or generate similar AI questions.</Text>
        </View>
      </Panel>

      <Panel title="Why notes are kept" icon="document-text-outline">
        <Text style={styles.copy}>
          Notes are still useful in the long-term design. Once AI parsing is added, notes can help map question-bank items to the right chapter, improve summaries, and generate better revision aids and flashcards.
        </Text>
      </Panel>

      <Panel title="Connect backend" icon="cloud-outline">
        <Text style={styles.copy}>
          Add the URL of your backend server here. The phone app will send uploaded PDFs to that server, and the server will call OpenAI securely using your API key.
        </Text>
        <TextInput
          value={backendBaseUrl}
          onChangeText={setBackendBaseUrl}
          style={uiStyles.input}
          placeholder="http://192.168.1.10:8787"
          placeholderTextColor={colors.inkSoft}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.helperText}>
          Use `http://YOUR-COMPUTER-IP:8787` while testing locally on Wi-Fi, then replace it with your deployed backend URL later.
        </Text>
      </Panel>

      <Panel title="Upload materials" icon="document-attach-outline">
        {uploads.length ? (
          uploads.map((upload) => (
            <View key={upload.subject} style={styles.uploadCard}>
              <View style={styles.uploadHeader}>
                <View style={styles.flex}>
                  <Text style={styles.uploadTitle}>{upload.subject}</Text>
                  <Text style={styles.uploadMeta}>Detected chapters: {upload.chaptersDetected}</Text>
                </View>
                <Badge text={upload.uploadStatus} tone={upload.readyForReview ? "success" : "neutral"} />
              </View>
              <View style={styles.buttonRow}>
                <ActionButton label={upload.notesPdfName || "Add notes PDF"} icon="document-outline" onPress={() => handlePick(upload.subject, "notesPdfName")} compact />
                <ActionButton label={upload.questionBankPdfName || "Add Q-bank PDF"} icon="albums-outline" onPress={() => handlePick(upload.subject, "questionBankPdfName")} compact />
                {upload.readyForReview ? (
                  <ActionButton
                    label={syncingSubject === upload.subject ? "Syncing..." : "Sync with AI"}
                    icon="sparkles-outline"
                    onPress={() => void handleAiSync(upload.subject)}
                    compact
                  />
                ) : null}
              </View>
              <Text style={styles.uploadMeta}>Notes: {upload.notesPdfName ? "uploaded" : "pending"}</Text>
              <Text style={styles.uploadMeta}>Question bank: {upload.questionBankPdfName ? "uploaded" : "pending"}</Text>
              {upload.lastSyncAt ? <Text style={styles.uploadMeta}>Last AI sync: {upload.lastSyncAt}</Text> : null}
              {upload.aiError ? <Text style={styles.errorText}>Error: {upload.aiError}</Text> : null}
              {upload.aiSummary ? (
                <View style={styles.aiSummaryCard}>
                  <Text style={styles.statusTitle}>Latest AI output</Text>
                  <Text style={styles.aiSummaryText} numberOfLines={8}>
                    {upload.aiSummary}
                  </Text>
                </View>
              ) : null}
            </View>
          ))
        ) : (
          <EmptyState text="No uploads yet." />
        )}
      </Panel>

      <Panel title="AI-ready workflow" icon="sparkles-outline">
        <View style={styles.modeCard}>
          <Text style={styles.modeTitle}>Future AI flow</Text>
          <Text style={styles.modeMeta}>1. Upload notes and question bank.</Text>
          <Text style={styles.modeMeta}>2. Backend extracts PDF text or runs OCR.</Text>
          <Text style={styles.modeMeta}>3. AI groups questions chapter-wise and subject-wise.</Text>
          <Text style={styles.modeMeta}>4. You choose chapter practice, mixed practice, or exam mode.</Text>
          <Text style={styles.modeMeta}>5. The app shows total wrong answers and weak chapters.</Text>
          <Text style={styles.modeMeta}>6. AI generates similar follow-up questions to solidify the concept.</Text>
        </View>
        <Text style={styles.copy}>Ready subjects so far: {readySubjects.length ? readySubjects.map((item) => item.subject).join(", ") : "none yet"}.</Text>
      </Panel>
    </>
  );
}

const styles = StyleSheet.create({
  copy: {
    color: colors.inkSoft,
    lineHeight: 20,
  },
  statusCard: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  statusTitle: {
    color: colors.ink,
    fontWeight: "800",
  },
  statusLine: {
    color: colors.inkSoft,
    lineHeight: 19,
  },
  uploadCard: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  uploadHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
  },
  uploadTitle: {
    color: colors.ink,
    fontWeight: "800",
  },
  uploadMeta: {
    color: colors.inkSoft,
    fontSize: 12,
    marginTop: 2,
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  modeCard: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  modeTitle: {
    color: colors.ink,
    fontWeight: "800",
  },
  modeMeta: {
    color: colors.inkSoft,
    lineHeight: 19,
  },
  flex: {
    flex: 1,
  },
  helperText: {
    color: colors.inkSoft,
    fontSize: 12,
    lineHeight: 18,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 18,
  },
  aiSummaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 6,
  },
  aiSummaryText: {
    color: colors.inkSoft,
    lineHeight: 18,
  },
});
