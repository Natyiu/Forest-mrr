import prisma from "@Batman/db";

/**
 * Creates a notification visible to all admin users.
 * Fire-and-forget — errors are swallowed so they never break the calling flow.
 */
export async function notifyAdmins(data: {
  title: string;
  description: string;
  tag: string;
  senderId?: string;
}) {
  try {
    const admins = await prisma.user.findMany({
      where: { role: "admin" },
      select: { id: true },
    });

    if (admins.length === 0) return;

    await prisma.notification.create({
      data: {
        title: data.title,
        description: data.description,
        tag: data.tag,
        senderId: data.senderId ?? "system",
        recipients: {
          create: admins.map((a) => ({ userId: a.id })),
        },
      },
    });
  } catch {
    // Swallow — notifications should never break core flows
  }
}

/**
 * Creates a notification for a specific user.
 */
export async function notifyUser(
  userId: string,
  data: {
    title: string;
    description: string;
    tag: string;
    senderId?: string;
  },
) {
  try {
    await prisma.notification.create({
      data: {
        title: data.title,
        description: data.description,
        tag: data.tag,
        senderId: data.senderId ?? "system",
        recipients: {
          create: [{ userId }],
        },
      },
    });
  } catch {
    // Swallow
  }
}
