import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import Button from "../components/Button";
import { getBlogPost } from "../lib/blogPosts";

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function BlogPost() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getBlogPost(slug) : undefined;

  if (!post) {
    return <Navigate to="/blog" replace />;
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-[720px] px-6 pt-16 sm:pt-20">
        <Link to="/blog" className="text-[14px] font-medium text-secondary-purple">
          ← Back to Blog
        </Link>

        <div className="mt-6 flex items-center gap-2 text-[13px] text-secondary-purple font-medium">
          <span>{post.tag}</span>
          <span className="text-text-secondary/50">·</span>
          <span className="text-text-secondary">{formatDate(post.date)}</span>
          <span className="text-text-secondary/50">·</span>
          <span className="text-text-secondary">{post.readMinutes} min read</span>
        </div>

        <h1 className="mt-3 font-heading font-semibold text-3xl sm:text-4xl leading-tight text-text-primary">
          {post.title}
        </h1>

        <div
          className="mt-8 h-[280px] sm:h-[360px] rounded-[20px] bg-cover bg-center"
          style={{ backgroundImage: `url(${post.image})` }}
        />

        <div className="mt-8 flex flex-col gap-5 text-[15px] sm:text-base leading-relaxed text-text-secondary">
          {post.paragraphs.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>
      </div>

      <div className="max-w-[680px] px-6 pt-16 pb-16 sm:pb-20">
        <div className="flex justify-start">
          <Button variant="orange" onClick={() => navigate("/plan")}>
            Start Planning your Trip
          </Button>
        </div>
      </div>
    </div>
  );
}
