import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { Mermaid } from "./Mermaid";
import { headingId } from "@/lib/help/anchors";

const textOf = (n: React.ReactNode): string => (typeof n === "string" || typeof n === "number" ? String(n) : Array.isArray(n) ? n.map(textOf).join("") : n && typeof n === "object" && "props" in n ? textOf((n as { props: { children?: React.ReactNode } }).props.children) : "");
/** Headings get stable ids (see lib/help/anchors) so help links and the drawer can scroll to a section. */
const heading = (Tag: "h2" | "h3" | "h4") => function Heading({ children }: { children?: React.ReactNode }) { return <Tag id={headingId(textOf(children))}>{children}</Tag>; };

const components = {
  h2: heading("h2"), h3: heading("h3"), h4: heading("h4"),
  code({ className, children, ...rest }: { className?: string; children?: React.ReactNode }) {
    if (className === "language-mermaid") return <Mermaid code={String(children ?? "").replace(/\n$/, "")} />;
    return <code className={className} {...rest}>{children}</code>;
  },
  pre({ children }: { children?: React.ReactNode }) {
    // A mermaid block renders its own container; keep <pre> for ordinary code.
    const child = Array.isArray(children) ? children[0] : children;
    const cls = (child as { props?: { className?: string } } | null)?.props?.className;
    return cls === "language-mermaid" ? <>{children}</> : <pre>{children}</pre>;
  },
};

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-slate max-w-none space-y-4 leading-relaxed [&_h2]:mt-8 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:text-xl [&_h3]:font-semibold [&_p]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_a]:text-blue-600 [&_a]:underline [&_table]:w-full [&_th]:text-left [&_th]:border-b [&_td]:border-b [&_th]:py-2 [&_td]:py-2">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
