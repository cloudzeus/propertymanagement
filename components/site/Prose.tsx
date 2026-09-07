import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

/**
 * Article body typography (handoff 06 part B §4). 18px/1.75 prose ink, amber
 * "›" list markers, amber-ruled blockquotes as the pull quote, and a drop cap
 * on the first paragraph only.
 *
 * Authors write Markdown; `>` becomes a pull quote and the component set the
 * handoff names (PullQuote, TakeawayBox) is expressed through it rather than as
 * separate slots, so a translated article stays structurally identical to its
 * source without a bespoke editor.
 */
export function Prose({ children }: { children: string }) {
  return (
    <div
      className={[
        "text-[17px] leading-[1.75] text-[var(--prose-ink)] sm:text-[18px]",
        "[&>p]:mb-[26px]",
        // Drop cap, first paragraph only.
        "[&>p:first-of-type]:dropcap",
        "[&_h2]:mb-[18px] [&_h2]:mt-12 [&_h2]:text-[24px] [&_h2]:font-extrabold [&_h2]:leading-[1.2] [&_h2]:tracking-[-.02em] [&_h2]:text-[var(--txt)] sm:[&_h2]:text-[29px]",
        "[&_h3]:mb-3 [&_h3]:mt-9 [&_h3]:text-[24px] [&_h3]:font-extrabold [&_h3]:tracking-[-.015em] [&_h3]:text-[var(--txt)]",
        // Lists: no bullets — an amber "›" marker does the work.
        "[&_ul]:mb-7 [&_ul]:flex [&_ul]:list-none [&_ul]:flex-col [&_ul]:gap-[13px] [&_ul]:p-0",
        "[&_ul>li]:relative [&_ul>li]:pl-6 [&_ul>li]:text-[17px] [&_ul>li]:leading-[1.6]",
        "[&_ul>li]:before:absolute [&_ul>li]:before:left-0 [&_ul>li]:before:font-extrabold [&_ul>li]:before:text-[var(--accent)] [&_ul>li]:before:content-['›']",
        "[&_ol]:mb-7 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol>li]:mb-2",
        // Pull quote — the rule does the work, no quotation marks.
        "[&_blockquote]:my-10 [&_blockquote]:border-l-[3px] [&_blockquote]:border-[var(--accent)] [&_blockquote]:py-1.5 [&_blockquote]:pl-7 [&_blockquote]:text-[21px] [&_blockquote]:font-semibold [&_blockquote]:leading-[1.42] [&_blockquote]:tracking-[-.012em] [&_blockquote]:text-[var(--txt)] sm:[&_blockquote]:text-[25px]",
        "[&_blockquote>p]:mb-0",
        "[&_a]:text-[var(--accent)] [&_a]:border-b [&_a]:border-[rgba(242,162,60,.4)] hover:[&_a]:border-[var(--accent)]",
        "[&_img]:my-8 [&_img]:rounded-[18px]",
        "[&_hr]:my-10 [&_hr]:border-[var(--line2)]",
        "[&_table]:mb-7 [&_table]:w-full [&_table]:text-[15px] [&_th]:border-b [&_th]:border-[var(--line)] [&_th]:py-2.5 [&_th]:text-left [&_td]:border-b [&_td]:border-[var(--line2)] [&_td]:py-2.5",
        "[&_code]:rounded [&_code]:bg-[var(--paper)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[15px]",
      ].join(" ")}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

/** "Key takeaways" panel — an amber-✓ list on the recessed paper surface. */
export function TakeawayBox({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <aside className="my-11 rounded-[18px] border border-[var(--line)] bg-[var(--paper)] px-8 py-[30px]">
      <div className="u-caps mb-[18px] text-[12px] font-extrabold tracking-[.12em] text-[var(--mut2)]">
        {label}
      </div>
      <ul className="flex flex-col gap-[13px]">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3.5 text-[17px] leading-[1.6]">
            <span aria-hidden className="font-extrabold text-[var(--accent)]">✓</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
