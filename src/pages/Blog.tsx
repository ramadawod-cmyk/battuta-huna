import { Link } from "react-router-dom";
import { BLOG_POSTS } from "../lib/blogPosts";

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function PostCard({ post }: { post: (typeof BLOG_POSTS)[number] }) {
  return (
    <Link
      to={`/blog/${post.slug}`}
      className="group flex flex-col overflow-hidden rounded-[20px] border border-text-primary/10 hover:border-text-primary/20 transition-colors"
    >
      <div
        className="h-[200px] bg-cover bg-center"
        style={{ backgroundImage: `url(${post.image})` }}
      />
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-center gap-2 text-[13px] text-secondary-purple font-medium">
          <span>{post.tag}</span>
          <span className="text-text-secondary/50">·</span>
          <span className="text-text-secondary">{formatDate(post.date)}</span>
          <span className="text-text-secondary/50">·</span>
          <span className="text-text-secondary">{post.readMinutes} min read</span>
        </div>
        <p className="font-heading font-semibold text-lg leading-snug text-text-primary group-hover:text-secondary-purple transition-colors">
          {post.title}
        </p>
        <p className="text-[14px] leading-relaxed text-text-secondary">{post.excerpt}</p>
      </div>
    </Link>
  );
}

export default function Blog() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[1040px] px-6 pt-16 sm:pt-20">
        <h1 className="font-heading font-semibold text-3xl sm:text-4xl text-text-primary">The Battuta Blog</h1>
        <p className="mt-4 max-w-[640px] text-[15px] sm:text-base leading-relaxed text-text-secondary">
          Stories, history, and ideas for travelers who want more than a list of landmarks.
        </p>
      </div>

      <div className="max-w-[1040px] px-6 mt-10 pb-16 sm:pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {BLOG_POSTS.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      </div>
    </div>
  );
}
