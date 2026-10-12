import { Link } from "react-router-dom";
import { useTranslation } from "../lib/LanguageContext";
import { BLOG_POSTS } from "../lib/blogPosts";
import type { Language } from "../lib/i18n/translate";

function formatDate(date: string, language: Language) {
  return new Date(date).toLocaleDateString(language === "ar" ? "ar-u-nu-latn" : "en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function PostCard({ post }: { post: (typeof BLOG_POSTS)[number] }) {
  const { t, language } = useTranslation();
  const isAr = language === "ar";
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
          <span>{isAr ? post.tagAr : post.tag}</span>
          <span className="text-text-secondary/50">·</span>
          <span className="text-text-secondary">{formatDate(post.date, language)}</span>
          <span className="text-text-secondary/50">·</span>
          <span className="text-text-secondary">{t("blog.minRead", { count: post.readMinutes })}</span>
        </div>
        <p className="font-heading font-semibold text-lg leading-snug text-text-primary group-hover:text-secondary-purple transition-colors">
          {isAr ? post.titleAr : post.title}
        </p>
        <p className="text-[14px] leading-relaxed text-text-secondary">{isAr ? post.excerptAr : post.excerpt}</p>
      </div>
    </Link>
  );
}

export default function Blog() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[1040px] px-6 pt-16 sm:pt-20">
        <h1 className="font-heading font-semibold text-3xl sm:text-4xl text-text-primary">{t("blog.title")}</h1>
        <p className="mt-4 max-w-[640px] text-[15px] sm:text-base leading-relaxed text-text-secondary">
          {t("blog.subtitle")}
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
