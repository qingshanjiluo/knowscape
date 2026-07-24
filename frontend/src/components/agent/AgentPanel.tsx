import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Plus, MessageSquare, Send, Loader2, Download, Trash2, Bot, User, Wrench } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useBookStore } from '@/stores/bookStore';

interface Conversation {
  id: string;
  title: string;
  book_id: string | null;
  created_at: string;
  updated_at: string;
}

interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tool_calls?: string;
  tool_results?: string;
  token_usage?: { input: number; output: number; total: number; model?: string };
  created_at: string;
}

interface AgentPanelProps {
  isOpen: boolean;
  onClose: () => void;
  embedded?: boolean;
}

export default function AgentPanel({ isOpen, onClose, embedded }: AgentPanelProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConversations, setShowConversations] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedBookId = useBookStore((s) => s.selectedBookId);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (isOpen) fetchConversations();
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function fetchConversations() {
    try {
      const resp = await fetch('/api/v1/agent/conversations');
      const data = await resp.json();
      setConversations(data);
    } catch {}
  }

  async function loadMessages(convId: string) {
    setActiveConvId(convId);
    setShowConversations(false);
    try {
      const resp = await fetch(`/api/v1/agent/conversations/${convId}/messages`);
      const data = await resp.json();
      setMessages(data);
    } catch {}
  }

  async function createConversation() {
    try {
      const resp = await fetch('/api/v1/agent/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: selectedBookId, title: '新对话' }),
      });
      const conv = await resp.json();
      setConversations(prev => [conv, ...prev]);
      loadMessages(conv.id);
    } catch {}
  }

  async function deleteConversation(convId: string) {
    try {
      await fetch(`/api/v1/agent/conversations/${convId}`, { method: 'DELETE' });
      setConversations(prev => prev.filter(c => c.id !== convId));
      if (activeConvId === convId) {
        setActiveConvId(null);
        setMessages([]);
        setShowConversations(true);
      }
    } catch {}
  }

  async function handleSend() {
    if (!input.trim() || loading) return;
    const userMsg: AgentMessage = {
      id: 'temp-' + Date.now(),
      role: 'user',
      content: input,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const resp = await fetch('/api/v1/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: activeConvId,
          message: userMsg.content,
          book_id: selectedBookId,
        }),
      });
      const data = await resp.json();

      if (!activeConvId && data.conversation_id) {
        setActiveConvId(data.conversation_id);
        fetchConversations();
      }

      const assistantMsg: AgentMessage = {
        id: 'resp-' + Date.now(),
        role: 'assistant',
        content: data.answer || data.detail || '无响应',
        tool_calls: JSON.stringify(data.tool_calls || []),
        tool_results: JSON.stringify(data.tool_results || []),
        token_usage: data.token_usage || undefined,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev.slice(0, -1), userMsg, assistantMsg]);
    } catch (e) {
      const errMsg: AgentMessage = {
        id: 'err-' + Date.now(),
        role: 'assistant',
        content: '请求失败: ' + (e instanceof Error ? e.message : '未知错误'),
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev.slice(0, -1), userMsg, errMsg]);
    }
    setLoading(false);
  }

  async function handleExport() {
    if (!activeConvId) return;
    try {
      const resp = await fetch('/api/v1/agent/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: activeConvId }),
      });
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'conversation.md';
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  }

  if (!isOpen) return null;

  const wrapperClass = embedded
    ? "flex flex-col h-full"
    : "fixed inset-y-0 right-0 z-[60] flex";
  const wrapperStyle = embedded
    ? { backgroundColor: 'var(--color-ks-bg)' }
    : { width: '520px', maxWidth: '90vw' };
  const innerStyle = embedded
    ? {}
    : {
        backgroundColor: 'var(--color-ks-bg)',
        borderLeft: '1px solid var(--color-ks-border)',
        boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
      };

  return (
    <div className={wrapperClass} style={wrapperStyle}>
      <div className="flex-1 flex flex-col h-full" style={innerStyle}>
        {/* Header */}
        <div
          className="flex items-center gap-2 px-4 py-3 shrink-0"
          style={{ borderBottom: '1px solid var(--color-ks-border)' }}
        >
          <Bot size={18} style={{ color: 'var(--color-ks-primary)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--color-ks-text)', fontFamily: 'var(--font-family-ks-heading)' }}>
            AI 助手
          </span>
          {selectedBookId && (
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-text-muted)' }}>
              当前书籍已关联
            </span>
          )}
          <div className="flex items-center gap-1 ml-auto">
            {activeConvId && (
              <button onClick={handleExport} className="p-1.5 rounded cursor-pointer" style={{ color: 'var(--color-ks-text-muted)' }} title="导出对话">
                <Download size={14} />
              </button>
            )}
            <button onClick={() => setShowConversations(!showConversations)} className="p-1.5 rounded cursor-pointer" style={{ color: 'var(--color-ks-text-muted)' }}>
              <MessageSquare size={14} />
            </button>
            <button onClick={onClose} className="p-1.5 rounded cursor-pointer" style={{ color: 'var(--color-ks-text-muted)' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Conversation List */}
          {showConversations && (
            <div
              className="w-48 shrink-0 overflow-y-auto"
              style={{ borderRight: '1px solid var(--color-ks-border)' }}
            >
              <div className="p-2">
                <button
                  onClick={createConversation}
                  className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded text-xs cursor-pointer"
                  style={{ backgroundColor: 'var(--color-ks-primary)', color: 'white' }}
                >
                  <Plus size={12} />
                  新对话
                </button>
              </div>
              {conversations.map(conv => (
                <div
                  key={conv.id}
                  className="group flex items-center gap-1.5 px-2 py-1.5 mx-1 rounded cursor-pointer text-xs"
                  style={{
                    backgroundColor: activeConvId === conv.id ? 'var(--color-ks-hover)' : 'transparent',
                    color: 'var(--color-ks-text-secondary)',
                  }}
                  onClick={() => loadMessages(conv.id)}
                >
                  <MessageSquare size={10} style={{ color: 'var(--color-ks-text-disabled)' }} />
                  <span className="flex-1 truncate">{conv.title}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 cursor-pointer"
                    style={{ color: 'var(--color-ks-text-disabled)' }}
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: 'var(--color-ks-text-muted)' }}>
                  <Bot size={32} style={{ color: 'var(--color-ks-text-disabled)' }} />
                  <p className="text-sm">开始与 AI 助手对话</p>
                  <p className="text-[10px] text-center max-w-[250px]">
                    AI 可以阅读书籍、分析内容、蒸馏知识、生成文档、导出文件等
                  </p>
                  {selectedBookId && (
                    <p className="text-[10px] px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-primary)' }}>
                      已关联当前书籍
                    </p>
                  )}
                </div>
              )}

              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--color-ks-primary)' }}>
                      <Bot size={12} color="white" />
                    </div>
                  )}
                  <div
                    className="max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed"
                    style={{
                      backgroundColor: msg.role === 'user' ? 'var(--color-ks-primary)' : 'var(--color-ks-card)',
                      color: msg.role === 'user' ? 'white' : 'var(--color-ks-text)',
                      border: msg.role === 'user' ? 'none' : '1px solid var(--color-ks-border)',
                    }}
                  >
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-xs max-w-none">
                        <ReactMarkdown>{String(msg.content || '')}</ReactMarkdown>
                      </div>
                    ) : (
                      <span>{msg.content}</span>
                    )}

                    {msg.tool_calls && (() => {
                      try {
                        const calls = JSON.parse(msg.tool_calls);
                        if (calls.length === 0) return null;
                        return (
                          <div className="mt-2 space-y-1">
                            {calls.map((tc: any, i: number) => (
                              <div key={i} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-text-muted)' }}>
                                <Wrench size={8} />
                                <span className="font-mono">{tc.name}</span>
                              </div>
                            ))}
                          </div>
                        );
                      } catch { return null; }
                    })()}

                    {msg.token_usage && (
                      <div className="mt-2 flex items-center gap-2 text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-text-muted)' }}>
                        <span>输入: {msg.token_usage.input.toLocaleString()}</span>
                        <span>输出: {msg.token_usage.output.toLocaleString()}</span>
                        <span>总计: {msg.token_usage.total.toLocaleString()}</span>
                        {msg.token_usage.model && <span className="font-mono">{msg.token_usage.model}</span>}
                      </div>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--color-ks-text-disabled)' }}>
                      <User size={12} color="white" />
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--color-ks-primary)' }}>
                    <Bot size={12} color="white" />
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: 'var(--color-ks-card)', border: '1px solid var(--color-ks-border)', color: 'var(--color-ks-text-muted)' }}>
                    <Loader2 size={12} className="animate-spin" />
                    思考中...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 shrink-0" style={{ borderTop: '1px solid var(--color-ks-border)' }}>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="输入消息..."
                  className="flex-1 text-xs px-3 py-2 rounded-lg outline-none"
                  style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-text)', border: '1px solid var(--color-ks-border)' }}
                  disabled={loading}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                  className="px-3 py-2 rounded-lg text-white text-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: 'var(--color-ks-primary)' }}
                >
                  <Send size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}