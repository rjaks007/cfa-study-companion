import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "../theme";

type SyncStatus = "idle" | "syncing" | "ok" | "error";

function statusLabel(status: SyncStatus, savedAt: number) {
  if (status === "syncing") return "Syncing…";
  if (status === "error") return "Last sync failed — will retry";
  if (status === "ok") {
    if (!savedAt) return "Synced";
    const mins = Math.round((Date.now() - savedAt) / 60000);
    if (mins <= 0) return "Synced just now";
    if (mins === 1) return "Synced 1 min ago";
    if (mins < 60) return `Synced ${mins} mins ago`;
    return "Synced";
  }
  return "Not syncing";
}

export function CloudSyncCard({
  syncCode,
  syncStatus,
  syncAt,
  onInit,
  onJoin,
  onUnlink,
  onForcePush,
  onSyncNow,
}: {
  syncCode: string;
  syncStatus: SyncStatus;
  syncAt: number;
  onInit: () => Promise<string>;
  onJoin: (code: string) => Promise<void>;
  onUnlink: () => void;
  onForcePush: () => Promise<void>;
  onSyncNow: () => Promise<"updated" | "current" | "pushed" | "error" | "no-sync">;
}) {
  const [expanded, setExpanded] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleInit() {
    try {
      setBusy(true);
      const code = await onInit();
      Alert.alert("Sync started", `Your sync code is:\n\n${code}\n\nEnter this exact code on your other devices to share this data.`);
    } catch (error) {
      Alert.alert("Couldn't start sync", error instanceof Error ? error.message : "Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    try {
      setBusy(true);
      await onJoin(joinCode);
      setJoinCode("");
      Alert.alert("Connected", "This device now shares the synced data. It pulled the latest copy.");
    } catch (error) {
      Alert.alert("Couldn't connect", error instanceof Error ? error.message : "Check the code and try again.");
    } finally {
      setBusy(false);
    }
  }

  function handleUnlink() {
    Alert.alert("Stop syncing?", "This device will keep its data but stop sharing changes. Your cloud copy is untouched.", [
      { text: "Cancel", style: "cancel" },
      { text: "Stop sync", style: "destructive", onPress: onUnlink },
    ]);
  }

  async function handleSyncNow() {
    try {
      setBusy(true);
      const result = await onSyncNow();
      if (result === "updated") Alert.alert("Updated", "Pulled the latest data from your other device.");
      else if (result === "current") Alert.alert("Up to date", "This device already has the latest data.");
      else if (result === "pushed") Alert.alert("Saved", "This device had unsynced changes — pushed them to the cloud.");
      else if (result === "error") Alert.alert("Sync failed", "Couldn't reach the cloud. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleForcePush() {
    try {
      setBusy(true);
      await onForcePush();
      Alert.alert("Pushed", "This device's data is now the latest cloud copy.");
    } catch (error) {
      Alert.alert("Push failed", error instanceof Error ? error.message : "Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  const dotColor = syncStatus === "error" ? colors.danger : syncStatus === "ok" ? colors.success : colors.inkSoft;

  return (
    <View style={styles.card}>
      <Pressable style={styles.header} onPress={() => setExpanded((v) => !v)}>
        <View style={styles.headerLeft}>
          <Ionicons name="cloud-outline" size={18} color={colors.ink} />
          <Text style={styles.title}>Cloud sync & backup</Text>
        </View>
        <Ionicons name={expanded ? "chevron-up-outline" : "chevron-down-outline"} size={18} color={colors.inkSoft} />
      </Pressable>

      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Text style={styles.statusText}>{syncCode ? statusLabel(syncStatus, syncAt) : "Not set up — your data lives only on this device"}</Text>
        {syncStatus === "syncing" ? <ActivityIndicator size="small" color={colors.inkSoft} style={styles.spinner} /> : null}
      </View>

      {expanded ? (
        <View style={styles.body}>
          {syncCode ? (
            <>
              <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => void handleSyncNow()} disabled={busy}>
                <Ionicons name="sync-outline" size={16} color="#fff" />
                <Text style={styles.btnPrimaryText}>Sync now</Text>
              </Pressable>
              <Text style={styles.hint}>Pulls the latest from your other devices. Tap this after editing on the iPad to bring changes here without restarting.</Text>

              <Text style={styles.label}>Your sync code</Text>
              <View style={styles.codeBox}>
                <Text style={styles.codeText}>{syncCode}</Text>
              </View>
              <Text style={styles.hint}>Enter this exact code on your iPad / web to share this data. Changes sync automatically.</Text>

              <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => void handleForcePush()} disabled={busy}>
                <Ionicons name="cloud-upload-outline" size={16} color={colors.ink} />
                <Text style={styles.btnGhostText}>Force push this device's data</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.btnDanger]} onPress={handleUnlink} disabled={busy}>
                <Text style={styles.btnDangerText}>Stop syncing on this device</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.hint}>Sync keeps your phone, iPad and web in one shared, backed-up dataset.</Text>

              <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => void handleInit()} disabled={busy}>
                <Ionicons name="add-circle-outline" size={16} color="#fff" />
                <Text style={styles.btnPrimaryText}>Start sync (get a new code)</Text>
              </Pressable>

              <Text style={styles.orText}>or join an existing code</Text>
              <View style={styles.joinRow}>
                <TextInput
                  value={joinCode}
                  onChangeText={(t) => setJoinCode(t.toUpperCase())}
                  placeholder="8-CHAR CODE"
                  placeholderTextColor={colors.inkSoft}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  style={styles.joinInput}
                  maxLength={8}
                />
                <Pressable style={[styles.btn, styles.btnPrimary, styles.joinBtn]} onPress={() => void handleJoin()} disabled={busy || !joinCode.trim()}>
                  <Text style={styles.btnPrimaryText}>Join</Text>
                </Pressable>
              </View>
              <Text style={styles.warn}>Joining replaces this device's data with the cloud copy.</Text>
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 15, fontWeight: "700", color: colors.ink },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, color: colors.inkSoft, flexShrink: 1 },
  spinner: { marginLeft: 4 },
  body: { marginTop: 14, gap: 10 },
  label: { fontSize: 12, fontWeight: "700", color: colors.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 },
  codeBox: { backgroundColor: colors.surfaceMuted, borderRadius: 12, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  codeText: { fontSize: 26, fontWeight: "800", color: colors.ink, letterSpacing: 6 },
  hint: { fontSize: 12, color: colors.inkSoft, lineHeight: 17 },
  warn: { fontSize: 11, color: colors.danger },
  orText: { fontSize: 12, color: colors.inkSoft, textAlign: "center", marginTop: 4 },
  joinRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  joinInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    letterSpacing: 4,
    color: colors.ink,
    backgroundColor: colors.surfaceMuted,
  },
  joinBtn: { paddingVertical: 12, paddingHorizontal: 18 },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
  btnPrimary: { backgroundColor: colors.accent },
  btnPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  btnGhost: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  btnGhostText: { color: colors.ink, fontWeight: "600", fontSize: 14 },
  btnDanger: { backgroundColor: "transparent" },
  btnDangerText: { color: colors.danger, fontWeight: "600", fontSize: 13 },
});
