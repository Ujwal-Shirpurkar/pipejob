import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Renders agent reports. react-markdown escapes HTML by default, so model output can't inject markup. */
export default function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-report text-sm leading-relaxed text-slate-700">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
