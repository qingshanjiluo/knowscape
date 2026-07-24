import { useMemo } from 'react';
import { Lightbulb } from 'lucide-react';
import type { ChatMessage } from '@/types';

interface ChatMessageItemProps {
  message: ChatMessage;
  onCitationClick: (citationId: string) => void;
  onSuggestionClick: (suggestion: string) => void;
}

/**
 * Renders markdown-like content: bold, lists, line breaks.
 * No external library needed -- regex replacement for inline patterns.
 */
function renderMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  lines.forEach((line, i) => {
    const trimmed = line.trim();

    // Empty line -> spacing
    if (trimmed === '') {
      elements.push(<div key={i} className="h-2" />);
      return;
    }

    // Ordered list item
    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
    if (orderedMatch) {
      elements.push(
        <div key={i} className="flex gap-2 py-0.5">
          <span className="shrink-0 w-5 text-right font-[var(--font-family-ks-heading)] font-semibold" style={{ color: 'var(--color-ks-primary)', fontSize: '0.82em' }}>
            {orderedMatch[1]}.
          </span>
          <span>{renderInline(orderedMatch[2])}</span>
        </div>,
      );
      return;
    }

    // Unordered list item
    const unorderedMatch = trimmed.match(/^[-*]\s+(.*)/);
    if (unorderedMatch) {
      elements.push(
        <div key={i} className="flex gap-2 py-0.5">
          <span className="shrink-0 w-1.5 h-1.5 mt-1.5 rounded-full" style={{ backgroundColor: 'var(--color-ks-accent)' }} />
          <span>{renderInline(unorderedMatch[1])}</span>
        </div>,
      );
      return;
    }

    // Regular paragraph
    elements.push(
      <div key={i} className="py-0.5 leading-relaxed">
        {renderInline(trimmed)}
      </div>,
    );
  });

  return elements;
}

/** Render inline patterns: bold, citation tags, inline code */
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  // Match: **bold**, [引N], `code`
  const regex = /(\*\*(.+?)\*\*)|(\[引(\d+)\])|(`(.+?)`)|(\[第(\d+)章\])/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // Bold
      parts.push(
        <strong key={match.index} className="font-semibold" style={{ color: 'var(--color-ks-text)' }}>
          {match[2]}
        </strong>,
      );
    } else if (match[4]) {
      // Citation tag [引N]
      parts.push(
        <span
          key={match.index}
          className="inline-flex items-center px-1.5 py-px mx-0.5 rounded-[var(--radius-ks-full)] text-[11px] font-[var(--font-family-ks-heading)] font-medium cursor-pointer transition-opacity hover:opacity-80"
          style={{ backgroundColor: 'var(--color-ks-accent)', color: 'white' }}
          data-citation={match[4]}
        >
          引{match[4]}
        </span>,
      );
    } else if (match[6]) {
      // Inline code
      parts.push(
        <code
          key={match.index}
          className="px-1 py-0.5 rounded text-[0.88em]"
          style={{
            fontFamily: 'var(--font-family-ks-mono)',
            backgroundColor: 'var(--color-ks-sidebar)',
          }}
        >
          {match[6]}
        </code>,
      );
    } else if (match[8]) {
      // Citation link [第X章]
      parts.push(
        <span
          key={match.index}
          className="cursor-pointer hover:underline"
          style={{ color: 'var(--color-ks-primary)' }}
        >
          [第{match[8]}章]
        </span>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 0 ? text : parts;
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatMessageItem({
  message,
  onCitationClick,
  onSuggestionClick,
}: ChatMessageItemProps) {
  const isUser = message.role === 'user';

  const renderedContent = useMemo(() => renderMarkdown(message.content), [message.content]);

  const citationTags = useMemo(() => {
    if (!message.citations || message.citations.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2.5" style={{ borderTop: '1px solid var(--color-ks-border)' }}>
        {message.citations.map((c) => (
          <span
            key={c.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-ks-full)] text-xs font-[var(--font-family-ks-heading)] font-medium cursor-pointer transition-all hover:opacity-80"
            style={{ backgroundColor: 'var(--color-ks-accent)', color: 'white' }}
            onClick={() => onCitationClick(c.id)}
            title={c.text}
          >
            <span style={{ fontSize: '10px' }}>&#128204;</span>
            引用
          </span>
        ))}
      </div>
    );
  }, [message.citations, onCitationClick]);

  const suggestionsBlock = useMemo(() => {
    if (!message.suggestions || message.suggestions.length === 0) return null;
    return (
      <div className="mt-3 pt-2.5" style={{ borderTop: '1px solid var(--color-ks-border)' }}>
        <div className="flex items-center gap-1.5 mb-2" style={{ color: 'var(--color-ks-text-muted)' }}>
          <Lightbulb size={12} />
          <span className="text-[11px] font-[var(--font-family-ks-heading)]">追问建议</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {message.suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => onSuggestionClick(s)}
              className="text-xs px-2.5 py-1 rounded-[var(--radius-ks-md)] cursor-pointer transition-all duration-150 hover:opacity-80"
              style={{
                backgroundColor: 'var(--color-ks-bg)',
                color: 'var(--color-ks-primary)',
                border: '1px solid var(--color-ks-border)',
                fontFamily: 'var(--font-family-ks-heading)',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    );
  }, [message.suggestions, onSuggestionClick]);

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} mb-4`}>
      {/* Timestamp */}
      <span
        className="text-[10px] mb-1 px-1 font-[var(--font-family-ks-heading)]"
        style={{ color: 'var(--color-ks-text-muted)' }}
      >
        {formatTime(message.timestamp)}
      </span>

      {/* Bubble */}
      <div
        className={[
          'max-w-[85%] px-3.5 py-2.5',
          isUser
            ? 'rounded-[var(--radius-ks-lg)_var(--radius-ks-sm)_var(--radius-ks-lg)_var(--radius-ks-lg)]'
            : 'rounded-[var(--radius-ks-sm)_var(--radius-ks-lg)_var(--radius-ks-lg)_var(--radius-ks-lg)]',
        ].join(' ')}
        style={{
          backgroundColor: isUser ? 'var(--color-ks-primary)' : 'var(--color-ks-card)',
          color: isUser ? 'white' : 'var(--color-ks-text)',
          border: isUser ? 'none' : '1px solid var(--color-ks-border)',
          fontFamily: 'var(--font-family-ks-body)',
          fontSize: '14px',
          lineHeight: 1.7,
          boxShadow: isUser ? 'none' : '0 1px 3px var(--color-ks-shadow)',
        }}
      >
        {/* Message content */}
        <div className={isUser ? '' : 'ks-prose'} style={isUser ? { whiteSpace: 'pre-wrap' } : undefined}>
          {renderedContent}
        </div>

        {/* Streaming indicator */}
        {message.isStreaming && (
          <span className="inline-flex gap-1 ml-1">
            <span className="w-1.5 h-1.5 rounded-full ks-animate-pulse" style={{ backgroundColor: 'var(--color-ks-accent)' }} />
            <span className="w-1.5 h-1.5 rounded-full ks-animate-pulse" style={{ backgroundColor: 'var(--color-ks-accent)', animationDelay: '0.2s' }} />
            <span className="w-1.5 h-1.5 rounded-full ks-animate-pulse" style={{ backgroundColor: 'var(--color-ks-accent)', animationDelay: '0.4s' }} />
          </span>
        )}

        {/* Citation tags (AI only) */}
        {!isUser && citationTags}

        {/* Suggestion buttons (AI only) */}
        {!isUser && suggestionsBlock}
      </div>
    </div>
  );
}
