"use server";

import { auth } from "@Batman/auth";
import prisma from "@Batman/db";
import { headers } from "next/headers";

async function requireAuth() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Unauthorized");
  return session;
}

async function requireAdmin() {
  const session = await requireAuth();
  if (session.user.role !== "admin") throw new Error("Forbidden");
  return session;
}

import { FEEDBACK_CATEGORIES } from "@/lib/feedback-categories";

export async function submitFeedback(data: {
  category: string;
  message: string;
}) {
  const session = await requireAuth();

  if (!data.message.trim()) throw new Error("Message is required");
  if (!FEEDBACK_CATEGORIES.some((c) => c.value === data.category)) {
    throw new Error("Invalid category");
  }

  return prisma.feedback.create({
    data: {
      userId: session.user.id,
      category: data.category,
      message: data.message.trim(),
    },
  });
}

export async function getUserFeedback() {
  const session = await requireAuth();

  return prisma.feedback.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

export async function getAdminFeedback(params?: {
  page?: number;
  limit?: number;
  category?: string;
  status?: string;
}) {
  await requireAdmin();

  const page = params?.page ?? 1;
  const limit = params?.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (params?.category && params.category !== "all") {
    where.category = params.category;
  }
  if (params?.status && params.status !== "all") {
    where.status = params.status;
  }

  const [items, total] = await Promise.all([
    prisma.feedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.feedback.count({ where }),
  ]);

  const userIds = [...new Set(items.map((i) => i.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true, image: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  return {
    feedback: items.map((item) => ({
      ...item,
      user: userMap.get(item.userId) ?? null,
    })),
    total,
    pages: Math.ceil(total / limit),
    currentPage: page,
  };
}

export async function updateFeedbackStatus(
  id: string,
  status: string,
  adminNote?: string
) {
  await requireAdmin();

  const validStatuses = ["open", "reviewed", "planned", "resolved", "closed"];
  if (!validStatuses.includes(status)) throw new Error("Invalid status");

  return prisma.feedback.update({
    where: { id },
    data: {
      status,
      ...(adminNote !== undefined && { adminNote }),
    },
  });
}

export async function getAdminFeedbackStats() {
  await requireAdmin();

  const [total, open, reviewed, planned, resolved] = await Promise.all([
    prisma.feedback.count(),
    prisma.feedback.count({ where: { status: "open" } }),
    prisma.feedback.count({ where: { status: "reviewed" } }),
    prisma.feedback.count({ where: { status: "planned" } }),
    prisma.feedback.count({ where: { status: "resolved" } }),
  ]);

  return { total, open, reviewed, planned, resolved };
}
