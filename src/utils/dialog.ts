import { Alert, Platform } from "react-native";

// react-native-web's Alert.alert is a no-op, so native popups silently do
// nothing in the web/PWA build. These helpers fall back to the browser's
// window.alert/confirm on web and use the real RN Alert on native.

export function notify(title: string, message?: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.alert([title, message].filter(Boolean).join("\n\n"));
    }
    return;
  }
  Alert.alert(title, message);
}

export function confirmAction(options: {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  const { title, message, confirmLabel = "OK", cancelLabel = "Cancel", destructive, onConfirm } = options;
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.confirm([title, message].filter(Boolean).join("\n\n"))) {
      onConfirm();
    }
    return;
  }
  Alert.alert(title, message, [
    { text: cancelLabel, style: "cancel" },
    { text: confirmLabel, style: destructive ? "destructive" : "default", onPress: onConfirm },
  ]);
}
