import type { ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "~web/shared/ui/lib/cn.js";

interface ChatMarkdownProps {
  readonly content: string;
}

/** 코드 노드의 텍스트만 뽑아, 여러 줄이면 블록 코드로 다룬다. */
function nodeText(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(nodeText).join("");
  return "";
}

/** 인라인 코드와 코드 블록·표를 구분해 앱의 시맨틱 토큰으로 렌더링하되, 긴 코드·표는 페이지가 아니라 자기 컨테이너 안에서 가로로 스크롤하게 한다. */
const components: Components = {
  p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
  h1: ({ children }) => (
    <h1 className="mt-3 mb-1.5 first:mt-0 text-[15px] font-semibold text-ink">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-3 mb-1.5 first:mt-0 text-[14px] font-semibold text-ink">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-2.5 mb-1 first:mt-0 text-[13px] font-semibold text-ink">{children}</h3>
  ),
  ul: ({ children }) => (
    <ul className="my-1.5 pl-4 list-disc marker:text-ink-tertiary space-y-0.5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-1.5 pl-4 list-decimal marker:text-ink-tertiary space-y-0.5">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-[1.5]">{children}</li>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-primary underline underline-offset-2 hover:text-primary-hover break-words"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="my-1.5 border-l-2 border-hair-strong pl-2.5 text-ink-subtle">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-2.5 border-0 border-t border-hair" />,
  code: ({ className, children }) => {
    const isBlock = /\blanguage-/.test(className ?? "") || nodeText(children).includes("\n");
    if (isBlock) {
      // 블록 코드의 배경·테두리는 감싸는 <pre>가 준다.
      return <code className={cn("font-mono text-[12px] text-ink", className)}>{children}</code>;
    }
    return (
      <code className="font-mono text-[12px] bg-s2 border border-hair rounded-xs px-1 py-0.5 text-ink">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto bg-s3 border border-hair rounded-sm p-3 leading-[1.5]">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full text-[12px] border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-hair px-2 py-1 text-left font-semibold text-ink bg-s2">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="border border-hair px-2 py-1 text-ink-muted">{children}</td>,
};

export function ChatMarkdown({ content }: ChatMarkdownProps) {
  return (
    <div className="text-[13px] leading-[1.55] text-ink break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
