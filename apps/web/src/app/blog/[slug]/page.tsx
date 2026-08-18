import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getPostBySlug } from "@/lib/actions/blog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return { title: "Post not found" };

  const title = post.metaTitle || post.title;
  const description =
    post.metaDescription || post.excerpt || post.title;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: post.ogImage ? [post.ogImage] : undefined,
      type: "article",
      publishedTime: post.publishedAt?.toISOString(),
      authors: post.author?.name ? [post.author.name] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: post.ogImage ? [post.ogImage] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const initials = post.author?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "?";

  return (
    <article className="max-w-2xl mx-auto px-4 py-12">
      <Link
        href="/blog"
        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground mb-6"
      >
        <ChevronLeft className="h-3 w-3" />
        Back to blog
      </Link>

      <header className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight mb-3">
          {post.title}
        </h1>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {post.author && (
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={post.author.image ?? undefined} />
                <AvatarFallback className="text-[8px]">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span>{post.author.name}</span>
            </div>
          )}
          {post.publishedAt && (
            <>
              {post.author && <span>·</span>}
              <time dateTime={post.publishedAt.toISOString()}>
                {new Date(post.publishedAt).toLocaleDateString()
                }
              </time>
            </>
          )}
        </div>
      </header>

      <div
        className="blog-content text-xs text-muted-foreground leading-relaxed space-y-3 [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-foreground [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:text-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2 [&_strong]:text-foreground [&_code]:bg-muted [&_code]:px-1 [&_code]:py-px [&_code]:rounded [&_code]:text-[11px] [&_pre]:bg-muted [&_pre]:border [&_pre]:border-border/40 [&_pre]:p-3 [&_pre]:overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />
    </article>
  );
}
