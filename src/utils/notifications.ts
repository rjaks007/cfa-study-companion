import Constants from "expo-constants";

type ReminderReading = {
  id: string;
  subject: string;
  readingNumber: number;
  title: string;
  nextReview: string;
  pendingReview?: boolean;
  pendingReviewDate?: string;
};

function withLocalTime(isoDate: string, hours: number) {
  const date = new Date(isoDate);
  date.setHours(hours, 0, 0, 0);
  return date;
}

function isExpoGo() {
  return Constants.appOwnership === "expo";
}

async function loadNotifications() {
  const Notifications = await import("expo-notifications");

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  return Notifications;
}

export async function requestReviewNotificationPermission() {
  if (isExpoGo()) {
    return false;
  }

  const Notifications = await loadNotifications();
  const existing = await Notifications.getPermissionsAsync();
  let finalStatus = existing.status;

  if (finalStatus !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }

  if (finalStatus !== "granted") {
    return false;
  }

  await Notifications.setNotificationChannelAsync("review-reminders", {
    name: "Review reminders",
    importance: Notifications.AndroidImportance.DEFAULT,
  });

  return true;
}

export async function scheduleReviewNotifications(readings: ReminderReading[]) {
  if (isExpoGo()) {
    return;
  }

  const Notifications = await loadNotifications();
  await Notifications.cancelAllScheduledNotificationsAsync();

  const now = new Date();
  const sorted = readings
    .map((reading) => ({
      ...reading,
      effectiveReviewDate: reading.pendingReview && reading.pendingReviewDate ? reading.pendingReviewDate : reading.nextReview,
    }))
    .filter((reading) => reading.effectiveReviewDate)
    .sort((left, right) => new Date(left.effectiveReviewDate).getTime() - new Date(right.effectiveReviewDate).getTime())
    .slice(0, 40);

  for (const reading of sorted) {
    const reminderAt = withLocalTime(reading.effectiveReviewDate, 18);
    reminderAt.setDate(reminderAt.getDate() - 1);

    const dueAt = withLocalTime(reading.effectiveReviewDate, 8);

    if (reminderAt.getTime() > now.getTime()) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Review tomorrow",
          body: `${reading.subject} · R${reading.readingNumber} ${reading.title}`,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminderAt,
          channelId: "review-reminders",
        },
      });
    }

    if (dueAt.getTime() > now.getTime()) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Review due today",
          body: `${reading.subject} · R${reading.readingNumber} ${reading.title}`,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: dueAt,
          channelId: "review-reminders",
        },
      });
    }
  }
}
