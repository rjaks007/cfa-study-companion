import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type ReminderReading = {
  id: string;
  subject: string;
  readingNumber: number;
  title: string;
  nextReview: string;
};

function withLocalTime(isoDate: string, hours: number) {
  const date = new Date(isoDate);
  date.setHours(hours, 0, 0, 0);
  return date;
}

export async function requestReviewNotificationPermission() {
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
  await Notifications.cancelAllScheduledNotificationsAsync();

  const now = new Date();
  const sorted = readings
    .filter((reading) => reading.nextReview)
    .sort((left, right) => new Date(left.nextReview).getTime() - new Date(right.nextReview).getTime())
    .slice(0, 40);

  for (const reading of sorted) {
    const reminderAt = withLocalTime(reading.nextReview, 18);
    reminderAt.setDate(reminderAt.getDate() - 1);

    const dueAt = withLocalTime(reading.nextReview, 8);

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
