import { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Send,
  Trash2,
  MessageSquare,
  Maximize2,
  Minimize2,
  BookOpen,
  Loader,
} from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useChatStore } from '@/stores/chatStore';
import { useBookStore } from '@/stores/bookStore';
import ChatMessageItem from './ChatMessageItem';

export default function ChatPanel() {
  const chatOpen = useUIStore((s) => s.chatOpen);
  const toggleChat = useUIStore((s) => s.toggleChat);
  const chatPosition = useUIStore((s) => s.chatPosition);
  const setChatPosition = useUIStore((s) => s.setChatPosition);
  const setHighlightCitation = useUIStore((s) => s.setHighlightCitation);

  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const clearMessages = useChatStore((s) => s.clearMessages);

  const selectedBookId = useBookStore((s) => s.selectedBookId);
  const books = useBookStore((s) => s.books);

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeBook = books.find((b) => b.id === selectedBookId);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    if (!selectedBookId) return;
    sendMessage(selectedBookId, trimmed);
    setInput('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, isStreaming, selectedBookId, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  const handleCitationClick = useCallback(
    (citationId: string) => {
      setHighlightCitation(citationId);
    },
    [setHighlightCitation],
  );

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      setInput(suggestion);
      textareaRef.current?.focus();
    },
    [],
  );

  const togglePosition = useCallback(() => {
    setChatPosition(chatPosition === 'right' ? 'float' : 'right');
  }, [chatPosition, setChatPosition]);

  if (!chatOpen) return null;

  const isFloating = chatPosition === 'float';

  return (
    <div
      className={[
        'flex flex-col overflow-hidden',
        'ks-animate-slide-down',
        isFloating
          ? 'fixed bottom-4 right-4 z-40 rounded-[var(--radius-ks-xl)] shadow-2xl'
          : 'shrink-0 border-l',
      ].join(' ')}
      style={{
        width: isFloating ? 400 : 400,
        height: isFloating ? '70vh' : '100%',
        maxHeight: isFloating ? '70vh' : undefined,
        backgroundColor: 'var(--color-ks-card)',
        border: isFloating ? 'none' : undefined,
        ...(isFloating
          ? { border: '1px solid var(--color-ks-border)' }
          : {}),
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between shrink-0 px-4 h-12"
        style={{ borderBottom: '1px solid var(--color-ks-border)' }}
      >
        <div className="flex items-center gap-2.5">
          <MessageSquare size={15} style={{ color: 'var(--color-ks-primary)' }} />
          <span
            className="text-sm font-semibold font-[var(--font-family-ks-heading)]"
            style={{ color: 'var(--color-ks-text)' }}
          >
            对话
          </span>
          {activeBook && (
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-ks-full)] text-[11px] font-[var(--font-family-ks-heading)]"
              style={{
                backgroundColor: 'var(--color-ks-hover)',
                color: 'var(--color-ks-primary)',
              }}
            >
              <BookOpen size={10} />
              {activeBook.title}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={clearMessages}
            className="p-1.5 rounded-[var(--radius-ks-sm)] cursor-pointer transition-colors hover:opacity-70"
            style={{ color: 'var(--color-ks-text-muted)' }}
            title="清空对话"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={togglePosition}
            className="p-1.5 rounded-[var(--radius-ks-sm)] cursor-pointer transition-colors hover:opacity-70"
            style={{ color: 'var(--color-ks-text-muted)' }}
            title={isFloating ? '固定到侧边' : '浮动窗口'}
          >
            {isFloating ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button
            onClick={toggleChat}
            className="p-1.5 rounded-[var(--radius-ks-sm)] cursor-pointer transition-colors hover:opacity-70"
            style={{ color: 'var(--color-ks-text-muted)' }}
            title="关闭"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
              style={{ backgroundColor: 'var(--color-ks-hover)' }}
            >
              <MessageSquare size={20} style={{ color: 'var(--color-ks-primary)' }} />
            </div>
            <p
              className="text-sm font-[var(--font-family-ks-heading)] mb-1"
              style={{ color: 'var(--color-ks-text)' }}
            >
              开始与书籍对话
            </p>
            <p className="text-xs" style={{ color: 'var(--color-ks-text-muted)' }}>
              基于蒸馏后的内容，向 AI 提问
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <ChatMessageItem
              key={msg.id}
              message={msg}
              onCitationClick={handleCitationClick}
              onSuggestionClick={handleSuggestionClick}
            />
          ))
        )}

        {messages.length > 0 &&
          messages[messages.length - 1].role === 'assistant' &&
          !messages[messages.length - 1].isStreaming &&
          !isStreaming &&
          selectedBookId && (() => {
            const suggestions = [
              '全书核心观点是什么？',
              '各章之间的逻辑关系是？',
              '如何将这些方法应用到实践中？',
            ];
            return (
              <div className="flex flex-wrap gap-1.5 mt-2 ml-7">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(selectedBookId, s)}
                    className="px-2 py-0.5 text-[10px] rounded-full cursor-pointer transition-all hover:opacity-80"
                    style={{
                      border: '1px solid var(--color-ks-border)',
                      color: 'var(--color-ks-text-secondary)',
                      backgroundColor: 'var(--color-ks-card)',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            );
          })()}

        {/* Streaming indicator */}
        {isStreaming && (
          <div className="flex items-start gap-2 mb-4">
            <div
              className="px-3.5 py-2.5 rounded-[var(--radius-ks-sm)_var(--radius-ks-lg)_var(--radius-ks-lg)_var(--radius-ks-lg)]"
              style={{
                backgroundColor: 'var(--color-ks-card)',
                border: '1px solid var(--color-ks-border)',
              }}
            >
              <div className="flex items-center gap-2">
                <Loader
                  size={13}
                  className="ks-animate-spin"
                  style={{ color: 'var(--color-ks-accent)' }}
                />
                <span className="text-xs" style={{ color: 'var(--color-ks-text-muted)' }}>
                  正在思考...
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div
        className="shrink-0 px-3 pb-3 pt-2"
        style={{ borderTop: '1px solid var(--color-ks-border)' }}
      >
        <div
          className="flex items-end gap-2 rounded-[var(--radius-ks-lg)] px-3 py-2"
          style={{
            backgroundColor: 'var(--color-ks-bg)',
            border: '1px solid var(--color-ks-border)',
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="输入你的问题..."
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none min-h-[20px] max-h-[120px]"
            style={{
              color: 'var(--color-ks-text)',
              fontFamily: 'var(--font-family-ks-body)',
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-[var(--radius-ks-md)] cursor-pointer transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80"
            style={{
              backgroundColor: 'var(--color-ks-primary)',
              color: 'white',
            }}
            title="发送 (Ctrl+Enter)"
          >
            <Send size={14} />
          </button>
        </div>
        <div
          className="mt-1.5 text-[10px] text-center font-[var(--font-family-ks-heading)]"
          style={{ color: 'var(--color-ks-text-disabled)' }}
        >
          Ctrl+Enter 发送
        </div>
      </div>
    </div>
  );
}
