import { useState, useCallback, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  ChevronLeft,
  Sparkles,
  FileText,
  Loader,
  CheckCircle2,
  FileCode,
  FileImage,
  Target,
  Download,
} from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useChatStore } from '@/stores/chatStore';
import { useBookStore } from '@/stores/bookStore';
import { exportApi } from '@/api';
import { Button, ProgressBar } from '@/components/ui';
import {
  DISTILL_CATEGORY_LABELS,
  DISTILL_CATEGORY_COLORS,
  type DistillCategory,
  type GenerateTarget,
} from '@/types';

// ─── Target Options ───

const TARGET_OPTIONS: { key: GenerateTarget; label: string; description: string }[] = [
  { key: 'byType', label: '按类型汇总', description: '将所有论点按类型分组整理' },
  { key: 'crossChapter', label: '跨章对比', description: '对比不同章节中相似主题的观点' },
  { key: 'byTopic', label: '按主题提取', description: '围绕特定主题提取关键内容' },
  { key: 'freeform', label: '自由指定', description: '使用自定义指令生成文档' },
];

const CONFIG_PRESETS: { id: string; label: string; description: string; icon: React.ReactNode; color: string }[] = [
  { id: 'full', label: '全书综合文档', description: '综合所有章节的核心内容，生成全面分析文档', icon: <FileText size={13} />, color: 'var(--color-ks-warning)' },
  { id: 'method', label: '方法转化与应用', description: '提取可用内容并转化为可执行方法与行动路径', icon: <Target size={13} />, color: '#E040FB' },
];

const FORMAT_OPTIONS: { key: 'markdown' | 'pdf' | 'html'; label: string; icon: React.ReactNode }[] = [
  { key: 'markdown', label: 'Markdown', icon: <FileCode size={13} /> },
  { key: 'pdf', label: 'PDF', icon: <FileText size={13} /> },
  { key: 'html', label: 'HTML', icon: <FileImage size={13} /> },
];

const ALL_CATEGORIES: DistillCategory[] = [
  'methodology', 'principles', 'strategies', 'models',
  'caseStudies', 'dataEvidence', 'perspectives',
];

export default function DeepGenPanel() {
  const setViewMode = useUIStore((s) => s.setViewMode);

  const selectedBookId = useBookStore((s) => s.selectedBookId);
  const books = useBookStore((s) => s.books);

  const generateProgress = useChatStore((s) => s.progress);
  const isGenerating = useChatStore((s) => s.isStreaming);
  const startGeneration = useChatStore((s) => s.startGeneration);

  const [realDocs, setRealDocs] = useState<any[]>([]);

  useEffect(() => {
    if (selectedBookId) {
      fetch(`/api/v1/list-generated?book_id=${selectedBookId}`)
        .then(r => r.json())
        .then(data => {
          const items = Array.isArray(data) ? data : [];
          setRealDocs(items.map(d => ({
            ...d,
            type: d.type || (d.chapterIdx !== undefined ? 'chapter' : 'generated'),
          })));
        })
        .catch(() => {});
    } else {
      setRealDocs([]);
    }
  }, [selectedBookId]);

  const activeBook = books.find((b) => b.id === selectedBookId);

  // Config state
  const [target, setTarget] = useState<GenerateTarget>('byType');
  const [selectedTypes, setSelectedTypes] = useState<DistillCategory[]>(['methodology', 'principles']);
  const [outputFormat, setOutputFormat] = useState<'markdown' | 'pdf' | 'html'>('markdown');
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedConfig, setSelectedConfig] = useState('full');

  // Toggle a category in the selection
  const toggleCategory = useCallback((cat: DistillCategory) => {
    setSelectedTypes((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  }, []);

  // Start generation
  const handleStart = useCallback(() => {
    if (!selectedBookId) return;
    
    const methodPrompt = selectedConfig === 'method' ? `
请严格遵守以下输出规范，基于已上传书籍的蒸馏内容，完成"方法转化与应用设计"：

一、可用内容提取
1. 本书中哪些内容可以直接用于实际问题解决（必须具体列出）
2. 这些内容分别属于什么类型（方法/原则/策略/模型等）
3. 这些内容各自适合解决什么类型的问题

二、方法转化与步骤设计
1. 将抽象内容拆解为清晰步骤
2. 说明每一步应该如何执行
3. 指出执行过程中需要注意的关键点

三、典型应用场景
1. 列出若干典型场景
2. 说明在每个场景中应如何使用这些方法
3. 说明使用后可能带来的结果或变化

四、执行路径设计
1. 如果从零开始，应优先使用哪些内容
2. 使用顺序应如何安排
3. 如何逐步推进与深化

五、关键注意事项
1. 使用这些方法时可能出现的常见问题
2. 哪些情况不适合直接使用
3. 执行过程中需要注意的限制或边界

六、长期使用与复用方式
1. 这些内容如何长期使用
2. 是否可以形成稳定的方法或习惯
3. 如何在不同场景中重复使用

七、整体应用总结
1. 本书最值得应用的核心内容是什么
2. 优先建议使用的部分
3. 使用后可能带来的核心变化

要求：所有内容必须基于已上传资料，每一条必须包含具体操作说明，形成可执行内容。
` : '';

    const customPromptFinal = methodPrompt || customPrompt || '';
    
    startGeneration(target, customPromptFinal);
  }, [selectedBookId, target, startGeneration, selectedConfig, customPrompt]);

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--color-ks-bg)' }}>
      {/* Header */}
      <div
        className="shrink-0 flex items-center gap-3 px-5 h-12"
        style={{
          backgroundColor: 'var(--color-ks-card)',
          borderBottom: '1px solid var(--color-ks-border)',
        }}
      >
        <button
          onClick={() => setViewMode('library')}
          className="p-1.5 rounded-[var(--radius-ks-sm)] cursor-pointer transition-colors hover:opacity-70"
          style={{ color: 'var(--color-ks-text-muted)' }}
          title="返回书架"
        >
          <ChevronLeft size={16} />
        </button>
        <Sparkles size={15} style={{ color: 'var(--color-ks-accent)' }} />
        <span
          className="text-sm font-semibold font-[var(--font-family-ks-heading)]"
          style={{ color: 'var(--color-ks-text)' }}
        >
          深度生成
        </span>
        {activeBook && (
          <span
            className="text-xs font-[var(--font-family-ks-heading)]"
            style={{ color: 'var(--color-ks-text-muted)' }}
          >
            / {activeBook.title}
          </span>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-[640px] mx-auto space-y-6">

          {/* ─── Configuration Section ─── */}
          <section
            className="rounded-[var(--radius-ks-lg)] p-5"
            style={{
              backgroundColor: 'var(--color-ks-card)',
              border: '1px solid var(--color-ks-border)',
            }}
          >
            <h3
              className="text-sm font-semibold font-[var(--font-family-ks-heading)] mb-4"
              style={{ color: 'var(--color-ks-text)' }}
            >
              生成配置
            </h3>

            {/* Generate Target Radio Group */}
            <div className="mb-5">
              <label
                className="block text-xs font-[var(--font-family-ks-heading)] font-medium mb-2"
                style={{ color: 'var(--color-ks-text-secondary)' }}
              >
                生成目标
              </label>
              <div className="grid grid-cols-2 gap-2">
                {TARGET_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setTarget(opt.key)}
                    className="flex flex-col items-start p-3 rounded-[var(--radius-ks-md)] cursor-pointer transition-all duration-150 text-left"
                    style={{
                      backgroundColor: target === opt.key ? 'var(--color-ks-hover)' : 'var(--color-ks-bg)',
                      border: `1px solid ${target === opt.key ? 'var(--color-ks-primary)' : 'var(--color-ks-border)'}`,
                    }}
                  >
                    <span
                      className="text-xs font-[var(--font-family-ks-heading)] font-medium"
                      style={{ color: target === opt.key ? 'var(--color-ks-primary)' : 'var(--color-ks-text)' }}
                    >
                      {opt.label}
                    </span>
                    <span
                      className="text-[11px] mt-0.5 leading-snug"
                      style={{ color: 'var(--color-ks-text-muted)' }}
                    >
                      {opt.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Config Presets */}
            <div className="mb-5">
              <label
                className="block text-xs font-[var(--font-family-ks-heading)] font-medium mb-2"
                style={{ color: 'var(--color-ks-text-secondary)' }}
              >
                文档类型
              </label>
              <div className="grid grid-cols-2 gap-2">
                {CONFIG_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => setSelectedConfig(preset.id)}
                    className="flex items-center gap-2 p-3 rounded-[var(--radius-ks-md)] cursor-pointer transition-all duration-150 text-left"
                    style={{
                      backgroundColor: selectedConfig === preset.id ? 'var(--color-ks-hover)' : 'var(--color-ks-bg)',
                      border: `1px solid ${selectedConfig === preset.id ? preset.color : 'var(--color-ks-border)'}`,
                    }}
                  >
                    <span style={{ color: preset.color }}>{preset.icon}</span>
                    <div>
                      <span
                        className="text-xs font-[var(--font-family-ks-heading)] font-medium block"
                        style={{ color: selectedConfig === preset.id ? preset.color : 'var(--color-ks-text)' }}
                      >
                        {preset.label}
                      </span>
                      <span
                        className="text-[10px] leading-snug block"
                        style={{ color: 'var(--color-ks-text-muted)' }}
                      >
                        {preset.description}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Type Checkboxes */}
            <div className="mb-5">
              <label
                className="block text-xs font-[var(--font-family-ks-heading)] font-medium mb-2"
                style={{ color: 'var(--color-ks-text-secondary)' }}
              >
                内容类型
              </label>
              <div className="flex flex-wrap gap-2">
                {ALL_CATEGORIES.map((cat) => {
                  const isActive = selectedTypes.includes(cat);
                  return (
                    <button
                      key={cat}
                      onClick={() => toggleCategory(cat)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-ks-full)] text-xs font-[var(--font-family-ks-heading)] font-medium cursor-pointer transition-all duration-150"
                      style={{
                        backgroundColor: isActive ? DISTILL_CATEGORY_COLORS[cat] : 'var(--color-ks-bg)',
                        color: isActive ? 'white' : 'var(--color-ks-text-secondary)',
                        border: `1px solid ${isActive ? DISTILL_CATEGORY_COLORS[cat] : 'var(--color-ks-border)'}`,
                      }}
                    >
                      {isActive && (
                        <CheckCircle2 size={11} />
                      )}
                      {DISTILL_CATEGORY_LABELS[cat]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Output Format Radio */}
            <div className="mb-5">
              <label
                className="block text-xs font-[var(--font-family-ks-heading)] font-medium mb-2"
                style={{ color: 'var(--color-ks-text-secondary)' }}
              >
                输出格式
              </label>
              <div className="flex gap-2">
                {FORMAT_OPTIONS.map((fmt) => (
                  <button
                    key={fmt.key}
                    onClick={() => setOutputFormat(fmt.key)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-[var(--radius-ks-md)] text-xs font-[var(--font-family-ks-heading)] font-medium cursor-pointer transition-all duration-150"
                    style={{
                      backgroundColor: outputFormat === fmt.key ? 'var(--color-ks-primary)' : 'var(--color-ks-bg)',
                      color: outputFormat === fmt.key ? 'white' : 'var(--color-ks-text-secondary)',
                      border: `1px solid ${outputFormat === fmt.key ? 'var(--color-ks-primary)' : 'var(--color-ks-border)'}`,
                    }}
                  >
                    {fmt.icon}
                    {fmt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Prompt (shown when target is 'freeform') */}
            {target === 'freeform' && (
              <div className="mb-5">
                <label
                  className="block text-xs font-[var(--font-family-ks-heading)] font-medium mb-2"
                  style={{ color: 'var(--color-ks-text-secondary)' }}
                >
                  自定义指令
                </label>
                <textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="描述你想要生成的内容...&#10;&#10;例如：请提取所有与「决策」相关的论点，并按时间顺序排列，附上原文引用。"
                  rows={4}
                  className="w-full px-3 py-2.5 text-sm rounded-[var(--radius-ks-md)] outline-none resize-none leading-relaxed"
                  style={{
                    backgroundColor: 'var(--color-ks-bg)',
                    border: '1px solid var(--color-ks-border)',
                    color: 'var(--color-ks-text)',
                    fontFamily: 'var(--font-family-ks-body)',
                  }}
                />
              </div>
            )}

            {/* Start Button */}
            <Button
              variant="primary"
              size="lg"
              loading={isGenerating}
              disabled={isGenerating || selectedTypes.length === 0}
              onClick={handleStart}
              icon={<Sparkles size={15} />}
              className="w-full"
            >
              {isGenerating ? '生成中...' : '开始生成'}
            </Button>
          </section>

          {/* ─── Generation Progress ─── */}
          {isGenerating && (
            <section
              className="rounded-[var(--radius-ks-lg)] p-5 ks-animate-fade-in"
              style={{
                backgroundColor: 'var(--color-ks-card)',
                border: '1px solid var(--color-ks-border)',
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Loader
                  size={14}
                  className="ks-animate-spin"
                  style={{ color: 'var(--color-ks-accent)' }}
                />
                <span
                  className="text-sm font-[var(--font-family-ks-heading)] font-medium"
                  style={{ color: 'var(--color-ks-text)' }}
                >
                  正在生成文档...
                </span>
              </div>
              <ProgressBar value={generateProgress} height={6} showLabel animated className="mb-2" />
              <div className="flex items-center justify-between">
                <span
                  className="text-[11px] font-[var(--font-family-ks-heading)]"
                  style={{ color: 'var(--color-ks-text-muted)' }}
                >
                  预计剩余时间: {Math.max(1, Math.round((100 - generateProgress) * 0.3))}s
                </span>
                <span
                  className="text-[11px] font-[var(--font-family-ks-heading)] tabular-nums"
                  style={{ color: 'var(--color-ks-text-muted)' }}
                >
                  {Math.round(generateProgress)}%
                </span>
              </div>
              {/* Streaming preview placeholder */}
              <div
                className="mt-3 p-3 rounded-[var(--radius-ks-md)] text-xs leading-relaxed"
                style={{
                  backgroundColor: 'var(--color-ks-bg)',
                  border: '1px solid var(--color-ks-border)',
                  color: 'var(--color-ks-text-secondary)',
                  fontFamily: 'var(--font-family-ks-mono)',
                  maxHeight: 120,
                  overflow: 'hidden',
                }}
              >
                <span style={{ color: 'var(--color-ks-text-muted)' }}>{'>'}</span> 正在从蒸馏结果中提取{' '}
                {selectedTypes.map((t) => DISTILL_CATEGORY_LABELS[t]).join('、')} 内容...
                <span className="ks-animate-pulse inline-block ml-1" style={{ color: 'var(--color-ks-accent)' }}>|</span>
              </div>
            </section>
          )}

          {/* ─── Results Section ─── */}
          {realDocs.length > 0 && (
            <section>
              <h3
                className="text-sm font-semibold font-[var(--font-family-ks-heading)] mb-3"
                style={{ color: 'var(--color-ks-text)' }}
              >
                已生成文档 ({realDocs.length})
              </h3>
              <div className="space-y-3">
                {realDocs.map((doc) => (
                  <div
                    key={doc.id || doc.title}
                    className="flex items-start gap-3 p-3 rounded-[var(--radius-ks-md)] transition-colors duration-150"
                    style={{ backgroundColor: 'var(--color-ks-card)', border: '1px solid var(--color-ks-border)' }}
                  >
                    <div className="p-1.5 rounded-md" style={{ backgroundColor: doc.type === 'mindmap' ? 'rgba(74, 111, 165, 0.1)' : doc.type === 'summary' ? 'rgba(81, 207, 102, 0.1)' : 'rgba(255, 183, 77, 0.1)' }}>
                      <FileText size={16} style={{ color: doc.type === 'mindmap' ? 'var(--color-ks-primary)' : doc.type === 'summary' ? 'var(--color-ks-success)' : 'var(--color-ks-warning)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium truncate" style={{ color: 'var(--color-ks-text)' }}>
                          <ReactMarkdown components={{ p: 'span' }}>{doc.title || ''}</ReactMarkdown>
                        </div>
                      </div>
                      <p className="text-xs mt-1 truncate" style={{ color: 'var(--color-ks-text-muted)' }}>
                        {doc.type === 'generated' ? (doc.customPrompt || 'AI 生成') : `${doc.pointsCount || 0} 个深层知识点`}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        if (!selectedBookId) return;
                        try {
                          const blob = await exportApi.exportBook(selectedBookId, outputFormat || 'markdown');
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `export.${outputFormat === 'pdf' ? 'pdf' : outputFormat === 'html' ? 'html' : 'md'}`;
                          a.click();
                          URL.revokeObjectURL(url);
                        } catch {}
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[10px] cursor-pointer shrink-0"
                      style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-text-secondary)', border: '1px solid var(--color-ks-border)' }}
                    >
                      <Download size={10} />
                      导出文档
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Empty State */}
          {realDocs.length === 0 && !isGenerating && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
                style={{ backgroundColor: 'var(--color-ks-hover)' }}
              >
                <Sparkles size={22} style={{ color: 'var(--color-ks-accent)' }} />
              </div>
              <p
                className="text-sm font-[var(--font-family-ks-heading)]"
                style={{ color: 'var(--color-ks-text-muted)' }}
              >
                配置生成参数后开始
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-ks-text-disabled)' }}>
                AI 将基于蒸馏结果生成结构化文档
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

