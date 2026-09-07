import Link from "next/link";
import { ImagePlaceholder, MetaRow, TagQuiet } from "@/components/site/kit";

export interface PostSummary {
  slug: string;
  title: string;
  excerpt: string;
  category: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  date: string;
  readTime: string | null;
  author: string | null;
}

/** Grid card, identical on the news index and the related band (handoff 06 §4). */
export function PostCard({ post }: { post: PostSummary }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="reveal flex flex-col overflow-hidden rounded-[18px] border border-[var(--line)] bg-white shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-[180ms] ease-[cubic-bezier(.2,.7,.3,1)] hover:-translate-y-1 hover:shadow-[var(--shadow-post)]"
    >
      <div className="h-[186px]">
        <ImagePlaceholder label={post.imageAlt || post.title} src={post.imageUrl} />
      </div>
      <div className="flex flex-1 flex-col px-6 pb-[26px] pt-[22px]">
        {post.category ? <div><TagQuiet>{post.category}</TagQuiet></div> : null}
        <h3 className="mb-[9px] mt-3.5 text-[length:var(--fs-17-5)] font-bold leading-[1.3] tracking-[-.01em]">
          {post.title}
        </h3>
        {post.excerpt ? (
          <p className="flex-1 text-[length:var(--fs-14)] leading-[1.58] text-[var(--mut)]">{post.excerpt}</p>
        ) : (
          <div className="flex-1" />
        )}
        <div className="mt-4">
          <MetaRow items={[post.date, post.readTime]} />
        </div>
      </div>
    </Link>
  );
}
