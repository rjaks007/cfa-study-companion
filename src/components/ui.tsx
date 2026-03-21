import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "../theme";

export function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Ionicons name={icon} size={18} color={colors.primary} />
        <Text style={styles.panelTitle}>{title}</Text>
      </View>
      <View style={styles.panelBody}>{children}</View>
    </View>
  );
}

export function MetricCard({
  label,
  value,
  icon,
  compact,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  compact?: boolean;
}) {
  return (
    <View style={[styles.metricCard, compact && styles.metricCardCompact]}>
      <View style={styles.metricTop}>
        <Ionicons name={icon} size={15} color={colors.inkSoft} />
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

export function ActionButton({
  label,
  icon,
  onPress,
  compact,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  compact?: boolean;
}) {
  return (
    <Pressable style={[styles.actionButton, compact && styles.actionButtonCompact]} onPress={onPress}>
      <Ionicons name={icon} size={15} color={colors.ink} />
      <Text numberOfLines={1} style={styles.actionButtonText}>
        {label}
      </Text>
    </Pressable>
  );
}

export function PrimaryButton({
  label,
  icon,
  onPress,
  small,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  small?: boolean;
}) {
  return (
    <Pressable style={[styles.primaryButton, small && styles.primaryButtonSmall]} onPress={onPress}>
      <Ionicons name={icon} size={16} color={colors.surface} />
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function Badge({
  text,
  tone,
}: {
  text: string;
  tone: "primary" | "neutral" | "warning" | "danger" | "success" | "accent";
}) {
  const palette =
    tone === "primary"
      ? { background: colors.primarySoft, ink: colors.primary }
      : tone === "warning"
        ? { background: colors.warningSoft, ink: colors.warning }
        : tone === "danger"
          ? { background: colors.dangerSoft, ink: colors.danger }
          : tone === "success"
            ? { background: colors.successSoft, ink: colors.success }
            : tone === "accent"
              ? { background: colors.accentSoft, ink: colors.accent }
              : { background: colors.surfaceMuted, ink: colors.inkSoft };

  return (
    <View style={[styles.badge, { backgroundColor: palette.background }]}>
      <Text style={[styles.badgeText, { color: palette.ink }]}>{text}</Text>
    </View>
  );
}

export function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniStatLabel}>{label}</Text>
      <Text style={styles.miniStatValue}>{value}</Text>
    </View>
  );
}

export function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoBlock}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}

export function FieldBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.fieldBlock}>
      <FieldLabel label={label} />
      {children}
    </View>
  );
}

export function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <FieldBlock label={label}>
      <TextInput
        value={value}
        onChangeText={onChange}
        style={styles.input}
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor={colors.inkSoft}
      />
    </FieldBlock>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

export function ProgressBar({ progress }: { progress: number }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, progress))}%` }]} />
    </View>
  );
}

export function ChipSelector({
  options,
  value,
  onChange,
  multiple,
  renderLabel,
}: {
  options: string[];
  value: string | string[];
  onChange: (value: string) => void;
  multiple?: boolean;
  renderLabel?: (value: string) => string;
}) {
  const selectedValues = Array.isArray(value) ? value : [value];
  return (
    <View style={styles.chipWrap}>
      {options.map((option) => {
        const selected = selectedValues.includes(option);
        return (
          <Pressable key={option} style={[styles.chip, selected && styles.chipSelected]} onPress={() => onChange(option)}>
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{renderLabel ? renderLabel(option) : option}</Text>
            {multiple && selected ? <Ionicons name="checkmark-circle" size={15} color={colors.surface} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export const uiStyles = StyleSheet.create({
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 14,
  },
  textarea: {
    minHeight: 96,
  },
  textareaLarge: {
    minHeight: 150,
  },
  inlineFields: {
    flexDirection: "row",
    gap: 10,
  },
  helperText: {
    color: colors.inkSoft,
    fontSize: 12,
    lineHeight: 18,
  },
  twoUp: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  inlineActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  cardBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  panelTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.primary,
  },
  panelBody: {
    padding: 18,
    gap: 12,
  },
  metricCard: {
    flexGrow: 1,
    minWidth: "47%",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
  },
  metricCardCompact: {
    minWidth: "47%",
  },
  metricTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metricLabel: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: "600",
  },
  metricValue: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "800",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexGrow: 1,
  },
  actionButtonCompact: {
    flexGrow: 0,
    minWidth: 0,
    paddingVertical: 10,
  },
  actionButtonText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
    flexShrink: 1,
  },
  primaryButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  primaryButtonSmall: {
    paddingVertical: 10,
  },
  primaryButtonText: {
    color: colors.surface,
    fontWeight: "800",
    fontSize: 14,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  miniStat: {
    flexGrow: 1,
    minWidth: "30%",
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  miniStatLabel: {
    color: colors.inkSoft,
    fontSize: 11,
  },
  miniStatValue: {
    color: colors.ink,
    marginTop: 6,
    fontWeight: "800",
  },
  infoBlock: {
    flexGrow: 1,
    minWidth: "47%",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoLabel: {
    color: colors.inkSoft,
    fontSize: 12,
  },
  infoValue: {
    marginTop: 8,
    color: colors.ink,
    fontSize: 17,
    fontWeight: "800",
  },
  fieldLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  fieldBlock: {
    flex: 1,
    gap: 8,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 14,
  },
  emptyState: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    color: colors.inkSoft,
    lineHeight: 20,
  },
  progressTrack: {
    height: 10,
    backgroundColor: colors.surface,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 999,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700",
  },
  chipTextSelected: {
    color: colors.surface,
  },
});
