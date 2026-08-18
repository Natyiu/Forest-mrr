import Link from "next/link";
import { getPublishedPosts } from "@/lib/actions/blog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const metadata = {
  title: "Blog",
  description: "Blog posts and updates.",
};

export default async function BlogPage() {
  const { posts } = await getPublishedPosts({ page: 1, limit: 20 });

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-lg font-semibold tracking-tight">Blog</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Updates and articles.
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-xs text-muted-foreground">No posts yet.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              className="block py-4 border-b border-border/30 last:border-0 hover:bg-muted/20 -mx-2 px-2 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-medium truncate">{post.title}</h2>
                  {post.excerpt && (
                    <p className="text-[11px] text-muted-foreground/60 line-clamp-2 mt-0.5">
                      {post.excerpt}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground/50">
                    {post.author?.name && (
                      <span>{post.author.name}</span>
                    )}
                    {post.publishedAt && (
                      <span>
                        {new Date(post.publishedAt).toLocaleDateString()
                        }
                      </span>
                    )}
                  </div>
                </div>
                {post.author?.image && (
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarImage src={post.author.image} />
                    <AvatarFallback className="text-[8px]">
                      {post.author.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
