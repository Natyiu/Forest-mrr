export const NOTIFICATION_TAGS = [
  "general",
  "announcement",
  "update",
  "maintenance",
  "security",
  "billing",
  "feature",
  "urgent",
] as const;

export type NotificationTag = (typeof NOTIFICATION_TAGS)[number];
