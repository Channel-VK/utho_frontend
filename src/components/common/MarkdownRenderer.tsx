import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Copy, Check, Terminal } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  isUser?: boolean;
}

interface CodeBlockProps {
  code: string;
  language?: string;
  isUser?: boolean;
}

function extractText(node: React.ReactNode): string {
  if (node === null || node === undefined) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (React.isValidElement(node) && (node.props as { children?: React.ReactNode })?.children) {
    return extractText((node.props as { children?: React.ReactNode }).children);
  }
  return '';
}

const CodeBlock: React.FC<CodeBlockProps> = ({ code, language, isUser = false }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    let success = false;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
        success = true;
      }
    } catch {
      // Clipboard writeText rejected (e.g. non-secure HTTP origin or permissions)
      success = false;
    }

    if (!success) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = code;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const res = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (res) {
          success = true;
        }
      } catch {
        success = false;
      }
    }

    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className={`my-2.5 rounded-xl border overflow-hidden text-xs font-mono shadow-xs transition-all ${
        isUser
          ? 'bg-black/60 border-white/15 text-slate-100'
          : 'bg-[#181B22] border-black/[0.12] text-[#F3F4F6]'
      }`}
    >
      <div
        className={`flex items-center justify-between px-3 py-1.5 border-b text-[10px] font-sans tracking-wide uppercase select-none ${
          isUser
            ? 'bg-white/5 border-white/10 text-white/70'
            : 'bg-white/[0.04] border-white/[0.08] text-[#9CA3AF]'
        }`}
      >
        <div className="flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-[#9CA3AF]" />
          <span className="font-semibold text-[10px] lowercase text-[#D1D5DB]">
            {language || 'code'}
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className={`px-2 py-0.5 rounded text-[10px] font-sans font-medium transition-colors flex items-center gap-1 cursor-pointer ${
            copied
              ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
              : 'hover:bg-white/10 text-white/80 border border-transparent'
          }`}
          title="Copy code to clipboard"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 text-white/70" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="p-3 overflow-x-auto leading-relaxed select-text font-mono text-[11px]">
        <pre className="m-0 p-0 font-mono">
          <code className="font-mono text-[#E2E8F0] whitespace-pre">{code}</code>
        </pre>
      </div>
    </div>
  );
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, isUser = false }) => {
  const safeContent = typeof content === 'string' ? content : content ? JSON.stringify(content, null, 2) : '';

  if (!safeContent.trim()) {
    return null;
  }

  return (
    <div
      className={`markdown-content text-xs leading-relaxed break-words [overflow-wrap:anywhere] ${
        isUser ? 'text-white' : 'text-[#111318]'
      }`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          h1: ({ children, node: _node, ...rest }) => (
            <h1
              className={`text-base font-bold my-2 pb-1 border-b tracking-tight ${
                isUser ? 'text-white border-white/20' : 'text-[#111318] border-black/[0.08]'
              }`}
              {...rest}
            >
              {children}
            </h1>
          ),
          h2: ({ children, node: _node, ...rest }) => (
            <h2
              className={`text-[15px] font-bold my-2 tracking-tight ${
                isUser ? 'text-white' : 'text-[#111318]'
              }`}
              {...rest}
            >
              {children}
            </h2>
          ),
          h3: ({ children, node: _node, ...rest }) => (
            <h3
              className={`text-[13px] font-bold my-1.5 tracking-tight ${
                isUser ? 'text-white' : 'text-[#111318]'
              }`}
              {...rest}
            >
              {children}
            </h3>
          ),
          h4: ({ children, node: _node, ...rest }) => (
            <h4
              className={`text-xs font-bold my-1 tracking-tight ${
                isUser ? 'text-white/95' : 'text-[#111318]'
              }`}
              {...rest}
            >
              {children}
            </h4>
          ),
          p: ({ children, node: _node, ...rest }) => (
            <p className="my-1.5 first:mt-0 last:mb-0 leading-relaxed text-xs" {...rest}>
              {children}
            </p>
          ),
          ul: ({ children, node: _node, ...rest }) => (
            <ul
              className={`my-1.5 pl-4 list-disc space-y-1 ${
                isUser ? 'marker:text-white/70' : 'marker:text-[#767D8C]'
              }`}
              {...rest}
            >
              {children}
            </ul>
          ),
          ol: ({ children, node: _node, ...rest }) => (
            <ol
              className={`my-1.5 pl-4 list-decimal space-y-1 ${
                isUser ? 'marker:text-white/70' : 'marker:text-[#767D8C]'
              }`}
              {...rest}
            >
              {children}
            </ol>
          ),
          li: ({ children, node: _node, ...rest }) => (
            <li className="leading-relaxed text-xs my-0.5" {...rest}>
              {children}
            </li>
          ),
          strong: ({ children, node: _node, ...rest }) => (
            <strong className={`font-semibold ${isUser ? 'text-white' : 'text-[#111318]'}`} {...rest}>
              {children}
            </strong>
          ),
          em: ({ children, node: _node, ...rest }) => (
            <em className="italic" {...rest}>
              {children}
            </em>
          ),
          blockquote: ({ children, node: _node, ...rest }) => (
            <blockquote
              className={`my-2 pl-3 border-l-2 text-xs italic ${
                isUser ? 'border-white/40 text-white/80' : 'border-[#111318]/30 text-[#4A505C]'
              }`}
              {...rest}
            >
              {children}
            </blockquote>
          ),
          table: ({ children, node: _node, ...rest }) => (
            <div
              className={`overflow-x-auto my-2 rounded-lg border ${
                isUser ? 'border-white/15' : 'border-black/[0.08]'
              }`}
            >
              <table className="w-full text-left text-xs border-collapse" {...rest}>
                {children}
              </table>
            </div>
          ),
          th: ({ children, node: _node, ...rest }) => (
            <th
              className={`px-2.5 py-1.5 text-[11px] font-semibold border-b ${
                isUser
                  ? 'bg-white/10 text-white border-white/15'
                  : 'bg-black/[0.04] text-[#111318] border-black/[0.08]'
              }`}
              {...rest}
            >
              {children}
            </th>
          ),
          td: ({ children, node: _node, ...rest }) => (
            <td
              className={`px-2.5 py-1.5 text-[11px] border-b ${
                isUser ? 'border-white/10 text-white/90' : 'border-black/[0.05] text-[#111318]'
              }`}
              {...rest}
            >
              {children}
            </td>
          ),
          a: ({ href, children, node: _node, ...rest }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={`underline underline-offset-2 ${
                isUser ? 'text-blue-300 hover:text-blue-200' : 'text-[#236B52] hover:text-[#111318]'
              } transition-colors`}
              {...rest}
            >
              {children}
            </a>
          ),
          hr: ({ node: _node, ...rest }) => (
            <hr
              className={`my-2.5 border-t ${
                isUser ? 'border-white/15' : 'border-black/[0.08]'
              }`}
              {...rest}
            />
          ),
          code: ({ children, className: codeClassName, node: _node, ...rest }) => (
            <code
              className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-medium ${
                isUser
                  ? 'bg-white/15 text-white border border-white/20'
                  : 'bg-black/[0.06] text-[#111318] border border-black/[0.08]'
              } ${codeClassName || ''}`}
              {...rest}
            >
              {children}
            </code>
          ),
          pre: ({ children }) => {
            const child = Array.isArray(children) ? children[0] : children;
            const codeElement = React.isValidElement(child) ? child : null;
            const rawCode = codeElement?.props && (codeElement.props as { children?: React.ReactNode })?.children
              ? extractText((codeElement.props as { children?: React.ReactNode }).children)
              : extractText(children);
            const code = rawCode.replace(/\n$/, '');
            const className = (codeElement?.props as { className?: string })?.className || '';
            const match = /language-(\w+)/.exec(className);
            const language = match ? match[1] : '';

            return (
              <CodeBlock
                code={code}
                language={language}
                isUser={isUser}
              />
            );
          },
        }}
      >
        {safeContent}
      </ReactMarkdown>
    </div>
  );
};
