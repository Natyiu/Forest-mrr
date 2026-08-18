"use server";

import { auth } from "@Batman/auth";
import prisma from "@Batman/db";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Unauthorized");
  if (session.user.role !== "admin") throw new Error("Forbidden");
  return session;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export async function getAdminPosts(opts: {
  page?: number;
  limit?: number;
  published?: boolean | null;
}) {
  await requireAdmin();

  const page = opts.page ?? 1;
  const limit = opts.limit ?? 15;
  const skip = (page - 1) * limit;

  const where =
    opts.published === null || opts.published === undefined
      ? {}
      : { published: opts.published };

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        author: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    }),
    prisma.post.count({ where }),
  ]);

  return {
    posts,
    total,
    pages: Math.ceil(total / limit),
    currentPage: page,
  };
}

export async function getPostById(id: string) {
  await requireAdmin();

  return prisma.post.findUnique({
    where: { id },
    include: {
      author: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
  });
}

export async function createPost(data: {
  title: string;
  slug?: string;
  excerpt?: string;
  content: string;
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
  published?: boolean;
}) {
  const session = await requireAdmin();

  const slug =
    data.slug?.trim() ||
    slugify(data.title) ||
    `post-${Date.now()}`;

  const existing = await prisma.post.findUnique({ where: { slug } });
  const finalSlug = existing ? `${slug}-${Date.now()}` : slug;

  const publishedAt =
    data.published === true ? new Date() : null;

  const post = await prisma.post.create({
    data: {
      title: data.title,
      slug: finalSlug,
      excerpt: data.excerpt ?? "",
      content: data.content,
      metaTitle: data.metaTitle || null,
      metaDescription: data.metaDescription || null,
      ogImage: data.ogImage || null,
      published: data.published ?? false,
      publishedAt,
      authorId: session.user.id,
    },
    include: {
      author: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
  });

  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  return post;
}

export async function updatePost(
  id: string,
  data: {
    title?: string;
    slug?: string;
    excerpt?: string;
    content?: string;
    metaTitle?: string;
    metaDescription?: string;
    ogImage?: string;
    published?: boolean;
  }
) {
  await requireAdmin();

  const existing = await prisma.post.findUnique({ where: { id } });
  if (!existing) throw new Error("Post not found");

  const updateData: Record<string, unknown> = {};

  if (data.title !== undefined) updateData.title = data.title;
  if (data.slug !== undefined) updateData.slug = data.slug.trim() || existing.slug;
  if (data.excerpt !== undefined) updateData.excerpt = data.excerpt;
  if (data.content !== undefined) updateData.content = data.content;
  if (data.metaTitle !== undefined) updateData.metaTitle = data.metaTitle || null;
  if (data.metaDescription !== undefined)
    updateData.metaDescription = data.metaDescription || null;
  if (data.ogImage !== undefined) updateData.ogImage = data.ogImage || null;

  if (data.published !== undefined) {
    updateData.published = data.published;
    updateData.publishedAt = data.published ? (existing.publishedAt ?? new Date()) : null;
  }

  const post = await prisma.post.update({
    where: { id },
    data: updateData,
    include: {
      author: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
  });

  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  revalidatePath(`/blog/${post.slug}`);
  return post;
}

export async function deletePost(id: string) {
  await requireAdmin();

  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) throw new Error("Post not found");

  await prisma.post.delete({ where: { id } });

  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  revalidatePath(`/blog/${post.slug}`);
}

// Public (no auth required)
export async function getPublishedPosts(opts: {
  page?: number;
  limit?: number;
}) {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 10;
  const skip = (page - 1) * limit;

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where: { published: true },
      orderBy: { publishedAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        publishedAt: true,
        metaTitle: true,
        metaDescription: true,
        ogImage: true,
        author: {
          select: { name: true, image: true },
        },
      },
    }),
    prisma.post.count({ where: { published: true } }),
  ]);

  return {
    posts,
    total,
    pages: Math.ceil(total / limit),
    currentPage: page,
  };
}

export async function getPostBySlug(slug: string) {
  const post = await prisma.post.findUnique({
    where: { slug, published: true },
    include: {
      author: {
        select: { id: true, name: true, image: true },
      },
    },
  });
  return post;
}
