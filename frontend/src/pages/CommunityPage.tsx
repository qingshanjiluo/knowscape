// ─── 知境（KnowScape）知识社区页面 ───

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Search,
  ChevronDown,
  Plus,
  Eye,
  Heart,
  MessageCircle,
  Users,
  BookOpen,
  Check,
  Calendar,
  Clock,
  Send,
} from 'lucide-react';
import { useBookStore } from '@/stores/bookStore';
import Modal from '@/components/ui/Modal';
import type { DistillCategory } from '@/types';

/* ═══════════════════════════════════════════
   Types & Mock Data
   ═══════════════════════════════════════════ */

type SortOption = 'latest' | 'popular' | 'rated';

const CATEGORY_TABS: { value: DistillCategory | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'methodology', label: '方法' },
  { value: 'principles', label: '原则' },
  { value: 'strategies', label: '策略' },
  { value: 'models', label: '模型' },
  { value: 'caseStudies', label: '案例' },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'latest', label: '最新' },
  { value: 'popular', label: '最热' },
  { value: 'rated', label: '好评' },
];

const CATEGORY_COLORS: Record<DistillCategory, string> = {
  methodology: 'var(--color-ks-cat-method)',
  principles: 'var(--color-ks-cat-principle)',
  strategies: 'var(--color-ks-cat-strategy)',
  models: 'var(--color-ks-cat-model)',
  caseStudies: 'var(--color-ks-cat-case)',
  dataEvidence: 'var(--color-ks-cat-data)',
  perspectives: 'var(--color-ks-cat-perspective)',
};

const CATEGORY_LABELS: Record<DistillCategory, string> = {
  methodology: '方法',
  principles: '原则',
  strategies: '策略',
  models: '模型',
  caseStudies: '案例',
  dataEvidence: '数据',
  perspectives: '观点',
};

interface CommunityResource {
  id: string;
  title: string;
  coverColor: string;
  bookTitle: string;
  uploaderName: string;
  uploaderInitial: string;
  categories: DistillCategory[];
  description: string;
  views: number;
  likes: number;
  comments: number;
  isCoReading: boolean;
}

/** 默认标签：用于发布资源时的类型选择 */
const DEFAULT_TAGS: DistillCategory[] = [
  'methodology', 'principles', 'strategies', 'models', 'caseStudies',
];

/* ═══════════════════════════════════════════
   CommunityPage Component
   ═══════════════════════════════════════════ */

export default function CommunityPage() {
  const books = useBookStore((s) => s.books);

  // ── Filter state ──
  const [activeCategory, setActiveCategory] = useState<DistillCategory | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('latest');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);

  // ── API data state ──
  const [apiResources, setApiResources] = useState<any[]>([]);
  const [apiCoReading, setApiCoReading] = useState<any[]>([]);
  const [apiStats, setApiStats] = useState({ resources: 0, users: 0, co_reading: 0 });

  // ── Modal state ──
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishBook, setPublishBook] = useState('');
  const [publishTitle, setPublishTitle] = useState('');
  const [publishDesc, setPublishDesc] = useState('');
  const [publishTags, setPublishTags] = useState<DistillCategory[]>([]);

  // ── Detail modal state ──
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailResource, setDetailResource] = useState<any>(null);
  const [detailComments, setDetailComments] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const openDetail = useCallback(async (id: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailResource(null);
    setDetailComments([]);
    setCommentText('');
    try {
      const resp = await fetch('/api/v1/community/resources/' + id);
      const data = await resp.json();
      setDetailResource(data);
      setDetailComments(data.comments || []);
    } catch {
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const submitComment = useCallback(async () => {
    if (!commentText.trim() || !detailResource) return;
    setCommentSubmitting(true);
    try {
      const token = (await import('@/stores/authStore')).useAuthStore.getState().token;
      const resp = await fetch('/api/v1/community/resources/' + detailResource.id + '/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
        },
        body: JSON.stringify({ content: commentText.trim() }),
      });
      if (resp.ok) {
        const comment = await resp.json();
        setDetailComments((prev) => [...prev, comment]);
        setDetailResource((prev: any) => prev ? { ...prev, comments_count: (prev.comments_count || 0) + 1 } : prev);
        setCommentText('');
      }
    } catch {
    } finally {
      setCommentSubmitting(false);
    }
  }, [commentText, detailResource]);

  // ── Fetch community data from API ──
  useEffect(function() {
    Promise.all([
      fetch('/api/v1/community/resources?category=' + activeCategory + '&sort=' + sortBy + (searchQuery ? '&search=' + encodeURIComponent(searchQuery) : '')).then(function(r) { return r.json(); }),
      fetch('/api/v1/community/co-reading').then(function(r) { return r.json(); }),
      fetch('/api/v1/community/stats').then(function(r) { return r.json(); }),
    ]).then(function([resources, coReading, stats]) {
      setApiResources(resources && resources.data ? (resources.data.items || []) : []);
      setApiCoReading(coReading && coReading.data ? (Array.isArray(coReading.data) ? coReading.data : []) : []);
      setApiStats(stats && stats.data ? stats.data : { resources: 0, users: 0, co_reading: 0 });
    }).catch(function() {});
  }, [activeCategory, sortBy, searchQuery]);

  // ── Filter resources ──
  const filteredResources = useMemo(() => {
    let result = [...apiResources];
    if (activeCategory !== 'all') {
      result = result.filter((r) => r.categories.includes(activeCategory));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.bookTitle.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q),
      );
    }
    if (sortBy === 'popular') {
      result.sort((a, b) => b.views - a.views);
    } else if (sortBy === 'rated') {
      result.sort((a, b) => b.likes - a.likes);
    }
    // 'latest' stays in default order
    return result;
  }, [activeCategory, sortBy, searchQuery]);

  const togglePublishTag = useCallback((tag: DistillCategory) => {
    setPublishTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }, []);

  const handlePublish = async () => {
    if (!publishTitle.trim()) return;
    try {
      const token = (await import('@/stores/authStore')).useAuthStore.getState().token;
      const resp = await       fetch('/api/v1/community/resource', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
        },
        body: JSON.stringify({
          title: publishTitle,
          description: publishDesc,
          book_id: publishBook || null,
          categories: publishTags,
        }),
      });
      if (resp.ok) {
        setPublishModalOpen(false);
        setPublishBook('');
        setPublishTitle('');
        setPublishDesc('');
        setPublishTags([]);
        fetch('/api/v1/community/resources').then(r => r.json()).then(d => setApiResources(d.items || []));
      }
    } catch {}
  };

  const sortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? '最新';

  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{ backgroundColor: 'var(--color-ks-bg)' }}
    >
      <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-6">
        {/* ═══ Header Section ═══ */}
        <section className="flex flex-col gap-3">
          <h1
            className="text-2xl font-bold"
            style={{
              fontFamily: 'var(--font-family-ks-heading)',
              color: 'var(--color-ks-text)',
            }}
          >
            知识社区
          </h1>
          <p
            className="text-sm"
            style={{ color: 'var(--color-ks-text-secondary)' }}
          >
            分享蒸馏成果，与志同道合的读者一起探索
          </p>

          {/* Stats bar */}
          <div
            className="flex items-center gap-6 py-3 px-4 rounded-[var(--radius-ks-md)] mt-1"
            style={{
              backgroundColor: 'var(--color-ks-card)',
              border: '1px solid var(--color-ks-border)',
            }}
          >
            <StatItem icon={<BookOpen size={14} />} value={apiStats.resources + ' 个资源'} label="已发布" color="var(--color-ks-primary)" />
            <StatItem icon={<Users size={14} />} value={apiStats.users + ' 人'} label="活跃读者" color="var(--color-ks-success)" />
            <StatItem icon={<Clock size={14} />} value={apiStats.co_reading + ' 本'} label="共读进行中" color="var(--color-ks-accent)" />
          </div>
        </section>

        {/* ═══ Filter / Sort Bar ═══ */}
        <section
          className="flex flex-col gap-3 p-4 rounded-[var(--radius-ks-lg)]"
          style={{
            backgroundColor: 'var(--color-ks-card)',
            border: '1px solid var(--color-ks-border)',
            boxShadow: '0 1px 2px var(--color-ks-shadow)',
          }}
        >
          {/* Top row: tabs + sort + search + publish button */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Category tabs */}
            <div className="flex items-center gap-1 flex-1 min-w-0 flex-wrap">
              {CATEGORY_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setActiveCategory(tab.value)}
                  className={[
                    'px-3 py-1.5 text-xs font-medium rounded-[var(--radius-ks-sm)] cursor-pointer transition-all duration-150 whitespace-nowrap',
                  ].join(' ')}
                  style={{
                    fontFamily: 'var(--font-family-ks-heading)',
                    backgroundColor:
                      activeCategory === tab.value
                        ? 'var(--color-ks-primary)'
                        : 'transparent',
                    color:
                      activeCategory === tab.value
                        ? 'white'
                        : 'var(--color-ks-text-secondary)',
                    border:
                      activeCategory === tab.value
                        ? '1px solid var(--color-ks-primary)'
                        : '1px solid transparent',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Sort dropdown */}
            <div className="relative">
              <button
                onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-[var(--radius-ks-sm)] cursor-pointer transition-colors duration-150 hover:opacity-80"
                style={{
                  fontFamily: 'var(--font-family-ks-heading)',
                  backgroundColor: 'var(--color-ks-bg)',
                  border: '1px solid var(--color-ks-border)',
                  color: 'var(--color-ks-text-secondary)',
                }}
              >
                {sortLabel}
                <ChevronDown size={12} />
              </button>
              {sortDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setSortDropdownOpen(false)}
                  />
                  <div
                    className="absolute right-0 top-full mt-1 z-20 min-w-[100px] py-1 rounded-[var(--radius-ks-md)] shadow-lg ks-animate-slide-down"
                    style={{
                      backgroundColor: 'var(--color-ks-card)',
                      border: '1px solid var(--color-ks-border)',
                    }}
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => {
                          setSortBy(opt.value);
                          setSortDropdownOpen(false);
                        }}
                        className="w-full px-3 py-1.5 text-xs text-left cursor-pointer transition-colors duration-100 hover:bg-[var(--color-ks-hover)]"
                        style={{
                          fontFamily: 'var(--font-family-ks-heading)',
                          color: sortBy === opt.value ? 'var(--color-ks-primary)' : 'var(--color-ks-text-secondary)',
                          backgroundColor: sortBy === opt.value ? 'var(--color-ks-hover)' : 'transparent',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Search */}
            <div
              className="flex items-center gap-2 h-8 px-2.5 rounded-[var(--radius-ks-sm)] min-w-[180px]"
              style={{
                backgroundColor: 'var(--color-ks-bg)',
                border: '1px solid var(--color-ks-border)',
              }}
            >
              <Search size={13} style={{ color: 'var(--color-ks-text-muted)', flexShrink: 0 }} />
              <input
                type="text"
                placeholder="搜索资源..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-xs outline-none placeholder:text-[var(--color-ks-text-disabled)]"
                style={{
                  color: 'var(--color-ks-text)',
                  fontFamily: 'var(--font-family-ks-heading)',
                }}
              />
            </div>

            {/* Publish button */}
            <button
              onClick={() => setPublishModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-[var(--radius-ks-sm)] cursor-pointer transition-opacity duration-150 hover:opacity-90 shrink-0"
              style={{
                fontFamily: 'var(--font-family-ks-heading)',
                backgroundColor: 'var(--color-ks-primary)',
                color: 'white',
              }}
            >
              <Plus size={13} />
              发布资源
            </button>
          </div>
        </section>

        {/* ═══ Resource Cards Grid ═══ */}
        <section>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredResources.map((resource) => (
              <ResourceCard key={resource.id} resource={resource} onClick={() => openDetail(resource.id)} />
            ))}
          </div>
          {filteredResources.length === 0 && (
            <div
              className="text-center py-16 text-sm"
              style={{ color: 'var(--color-ks-text-muted)' }}
            >
              未找到匹配的资源
            </div>
          )}
        </section>

        {/* ═══ Co-reading Section ═══ */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: 'var(--color-ks-success)' }}
            />
            <h2
              className="text-base font-semibold"
              style={{
                fontFamily: 'var(--font-family-ks-heading)',
                color: 'var(--color-ks-text)',
              }}
            >
              共读进行中
            </h2>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
            {Array.isArray(apiCoReading) ? apiCoReading.map((item) => (
              <CoReadingCard key={item.id} item={item} />
            )) : null}
          </div>
        </section>
      </div>

      {/* ═══ Publish Modal ═══ */}
      <Modal
        isOpen={publishModalOpen}
        onClose={() => setPublishModalOpen(false)}
        title="发布资源"
        size="md"
      >
        <div className="flex flex-col gap-5">
          {/* 选择书籍 */}
          <div className="flex flex-col gap-1.5">
            <label
              className="text-xs font-medium"
              style={{
                fontFamily: 'var(--font-family-ks-heading)',
                color: 'var(--color-ks-text-secondary)',
              }}
            >
              选择书籍
            </label>
            <select
              value={publishBook}
              onChange={(e) => setPublishBook(e.target.value)}
              className="h-9 px-3 text-sm rounded-[var(--radius-ks-sm)] outline-none cursor-pointer appearance-none"
              style={{
                fontFamily: 'var(--font-family-ks-heading)',
                backgroundColor: 'var(--color-ks-bg)',
                border: '1px solid var(--color-ks-border)',
                color: 'var(--color-ks-text)',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23999490' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 10px center',
                paddingRight: '32px',
              }}
            >
              <option value="">请选择...</option>
              {books
                .filter((b) => b.status === 'completed')
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title} — {b.author}
                  </option>
                ))}
            </select>
          </div>

          {/* 资源标题 */}
          <div className="flex flex-col gap-1.5">
            <label
              className="text-xs font-medium"
              style={{
                fontFamily: 'var(--font-family-ks-heading)',
                color: 'var(--color-ks-text-secondary)',
              }}
            >
              资源标题
            </label>
            <input
              type="text"
              placeholder="例：认知红利 · 核心论点精华"
              value={publishTitle}
              onChange={(e) => setPublishTitle(e.target.value)}
              className="h-9 px-3 text-sm rounded-[var(--radius-ks-sm)] outline-none"
              style={{
                fontFamily: 'var(--font-family-ks-heading)',
                backgroundColor: 'var(--color-ks-bg)',
                border: '1px solid var(--color-ks-border)',
                color: 'var(--color-ks-text)',
              }}
            />
          </div>

          {/* 资源描述 */}
          <div className="flex flex-col gap-1.5">
            <label
              className="text-xs font-medium"
              style={{
                fontFamily: 'var(--font-family-ks-heading)',
                color: 'var(--color-ks-text-secondary)',
              }}
            >
              资源描述
            </label>
            <textarea
              placeholder="简要描述资源内容和适用人群..."
              value={publishDesc}
              onChange={(e) => setPublishDesc(e.target.value)}
              rows={3}
              className="px-3 py-2 text-sm rounded-[var(--radius-ks-sm)] outline-none resize-none"
              style={{
                fontFamily: 'var(--font-family-ks-heading)',
                backgroundColor: 'var(--color-ks-bg)',
                border: '1px solid var(--color-ks-border)',
                color: 'var(--color-ks-text)',
              }}
            />
          </div>

          {/* 选择类型 */}
          <div className="flex flex-col gap-2">
            <label
              className="text-xs font-medium"
              style={{
                fontFamily: 'var(--font-family-ks-heading)',
                color: 'var(--color-ks-text-secondary)',
              }}
            >
              选择类型
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {DEFAULT_TAGS.map((tag) => {
                const selected = publishTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => togglePublishTag(tag)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-[var(--radius-ks-full)] cursor-pointer transition-all duration-150"
                    style={{
                      fontFamily: 'var(--font-family-ks-heading)',
                      backgroundColor: selected ? CATEGORY_COLORS[tag] : 'transparent',
                      color: selected ? 'white' : 'var(--color-ks-text-secondary)',
                      border: selected
                        ? `1px solid ${CATEGORY_COLORS[tag]}`
                        : '1px solid var(--color-ks-border)',
                    }}
                  >
                    {selected && <Check size={11} />}
                    {CATEGORY_LABELS[tag]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Publish action */}
          <div
            className="flex items-center justify-end gap-3 pt-3"
            style={{ borderTop: '1px solid var(--color-ks-border)' }}
          >
            <button
              onClick={() => setPublishModalOpen(false)}
              className="px-4 py-2 text-xs font-medium rounded-[var(--radius-ks-sm)] cursor-pointer transition-opacity duration-150 hover:opacity-80"
              style={{
                fontFamily: 'var(--font-family-ks-heading)',
                backgroundColor: 'transparent',
                color: 'var(--color-ks-text-secondary)',
                border: '1px solid var(--color-ks-border)',
              }}
            >
              取消
            </button>
            <button
              onClick={handlePublish}
              disabled={!publishBook || !publishTitle.trim()}
              className={[
                'inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-[var(--radius-ks-sm)] transition-opacity duration-150',
                !publishBook || !publishTitle.trim()
                  ? 'opacity-40 cursor-not-allowed pointer-events-none'
                  : 'cursor-pointer hover:opacity-90',
              ].join(' ')}
              style={{
                fontFamily: 'var(--font-family-ks-heading)',
                backgroundColor: 'var(--color-ks-primary)',
                color: 'white',
              }}
            >
              <Plus size={13} />
              发布
            </button>
          </div>
        </div>
      </Modal>

      {/* ═══ Resource Detail Modal ═══ */}
      <Modal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={detailResource?.title || '资源详情'}
        size="lg"
      >
        {detailLoading ? (
          <div className="flex items-center justify-center py-12">
            <div
              className="w-5 h-5 border-2 rounded-full animate-spin"
              style={{
                borderColor: 'var(--color-ks-border)',
                borderTopColor: 'var(--color-ks-primary)',
              }}
            />
          </div>
        ) : detailResource ? (
          <div className="flex flex-col gap-5">
            {/* Resource info */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                {(detailResource.categories || []).map((cat: string) => (
                  <span
                    key={cat}
                    className="inline-flex items-center px-2 py-px text-[11px] leading-5 rounded-[var(--radius-ks-full)] font-medium"
                    style={{
                      fontFamily: 'var(--font-family-ks-heading)',
                      backgroundColor: `${CATEGORY_COLORS[cat] || 'var(--color-ks-primary)'}18`,
                      color: CATEGORY_COLORS[cat] || 'var(--color-ks-primary)',
                    }}
                  >
                    {CATEGORY_LABELS[cat] || cat}
                  </span>
                ))}
              </div>
              <p
                className="text-sm leading-relaxed"
                style={{ color: 'var(--color-ks-text-secondary)' }}
              >
                {detailResource.description}
              </p>
              {detailResource.content && (
                <div
                  className="text-sm leading-relaxed mt-1 p-3 rounded-[var(--radius-ks-sm)]"
                  style={{
                    backgroundColor: 'var(--color-ks-bg)',
                    border: '1px solid var(--color-ks-border)',
                    color: 'var(--color-ks-text)',
                  }}
                >
                  {detailResource.content}
                </div>
              )}
              <div
                className="flex items-center gap-4 text-xs pt-2"
                style={{
                  borderTop: '1px solid var(--color-ks-border)',
                  color: 'var(--color-ks-text-muted)',
                }}
              >
                <span className="inline-flex items-center gap-1">
                  <Eye size={12} />
                  {detailResource.views} 浏览
                </span>
                <span className="inline-flex items-center gap-1">
                  <Heart size={12} />
                  {detailResource.likes} 点赞
                </span>
                <span className="inline-flex items-center gap-1">
                  <MessageCircle size={12} />
                  {detailComments.length} 评论
                </span>
                <span
                  className="text-xs ml-auto"
                  style={{ color: 'var(--color-ks-text-disabled)' }}
                >
                  by {detailResource.author_name || '匿名'}
                </span>
              </div>
            </div>

            {/* Comment input */}
            <div
              className="flex items-start gap-2 pt-3"
              style={{ borderTop: '1px solid var(--color-ks-border)' }}
            >
              <div
                className="flex-1 min-h-[36px] px-3 py-2 text-sm rounded-[var(--radius-ks-sm)] outline-none resize-none"
                style={{
                  fontFamily: 'var(--font-family-ks-heading)',
                  backgroundColor: 'var(--color-ks-bg)',
                  border: '1px solid var(--color-ks-border)',
                  color: 'var(--color-ks-text)',
                }}
              >
                <textarea
                  placeholder="写下你的评论..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows={2}
                  className="w-full bg-transparent text-sm outline-none resize-none placeholder:text-[var(--color-ks-text-disabled)]"
                  style={{
                    fontFamily: 'var(--font-family-ks-heading)',
                    color: 'var(--color-ks-text)',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      submitComment();
                    }
                  }}
                />
              </div>
              <button
                onClick={submitComment}
                disabled={!commentText.trim() || commentSubmitting}
                className={[
                  'inline-flex items-center justify-center w-9 h-9 rounded-[var(--radius-ks-sm)] shrink-0 transition-opacity duration-150',
                  !commentText.trim() || commentSubmitting
                    ? 'opacity-40 cursor-not-allowed pointer-events-none'
                    : 'cursor-pointer hover:opacity-90',
                ].join(' ')}
                style={{
                  backgroundColor: 'var(--color-ks-primary)',
                  color: 'white',
                }}
              >
                <Send size={14} />
              </button>
            </div>

            {/* Comments list */}
            <div className="flex flex-col gap-3">
              {detailComments.length === 0 ? (
                <div
                  className="text-center py-8 text-xs"
                  style={{ color: 'var(--color-ks-text-muted)' }}
                >
                  暂无评论，来说点什么吧
                </div>
              ) : (
                detailComments.map((comment: any) => (
                  <div
                    key={comment.id}
                    className="flex flex-col gap-1.5 p-3 rounded-[var(--radius-ks-sm)]"
                    style={{
                      backgroundColor: 'var(--color-ks-bg)',
                      border: '1px solid var(--color-ks-border)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs font-medium"
                        style={{
                          fontFamily: 'var(--font-family-ks-heading)',
                          color: 'var(--color-ks-text)',
                        }}
                      >
                        {comment.author_name || '匿名用户'}
                      </span>
                      <span
                        className="text-[11px]"
                        style={{ color: 'var(--color-ks-text-disabled)' }}
                      >
                        {comment.created_at ? new Date(comment.created_at + 'Z').toLocaleString('zh-CN', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        }) : ''}
                      </span>
                    </div>
                    <p
                      className="text-xs leading-relaxed"
                      style={{ color: 'var(--color-ks-text-secondary)' }}
                    >
                      {comment.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════ */

function StatItem({
  icon,
  value,
  label,
  color,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center justify-center w-7 h-7 rounded-[var(--radius-ks-sm)]"
        style={{ backgroundColor: color, color: 'white' }}
      >
        {icon}
      </div>
      <div className="flex flex-col">
        <span
          className="text-sm font-semibold leading-tight tabular-nums"
          style={{
            fontFamily: 'var(--font-family-ks-heading)',
            color: 'var(--color-ks-text)',
          }}
        >
          {value}
        </span>
        <span
          className="text-[11px] leading-tight"
          style={{ color: 'var(--color-ks-text-muted)' }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}

function ResourceCard({ resource, onClick }: { resource: CommunityResource; onClick?: () => void }) {
  const [liked, setLiked] = useState(false);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const resp = await fetch('/api/v1/community/resources/' + resource.id + '/like', { method: 'POST' });
      const data = await resp.json();
      setLiked(data.liked);
    } catch {}
  };

  return (
    <div
      className="group flex flex-col overflow-hidden rounded-[var(--radius-ks-lg)] transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
      style={{
        backgroundColor: 'var(--color-ks-card)',
        border: '1px solid var(--color-ks-border)',
        boxShadow: '0 1px 3px var(--color-ks-shadow)',
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 12px var(--color-ks-shadow)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 1px 3px var(--color-ks-shadow)';
      }}
    >
      {/* Color strip */}
      <div
        className="h-1.5 w-full shrink-0"
        style={{ backgroundColor: resource.coverColor }}
      />

      {/* Content */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        {/* Title */}
        <h3
          className="text-sm font-semibold leading-snug line-clamp-1"
          style={{
            fontFamily: 'var(--font-family-ks-heading)',
            color: 'var(--color-ks-text)',
          }}
        >
          {resource.title}
        </h3>

        {/* Uploader */}
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold text-white shrink-0"
            style={{
              fontFamily: 'var(--font-family-ks-heading)',
              background: `linear-gradient(135deg, var(--color-ks-primary), var(--color-ks-secondary))`,
            }}
          >
            {resource.uploaderInitial}
          </div>
          <span
            className="text-xs"
            style={{ color: 'var(--color-ks-text-muted)' }}
          >
            {resource.uploaderName}
          </span>
          <span
            className="text-xs"
            style={{ color: 'var(--color-ks-text-disabled)' }}
          >
            /
          </span>
          <span
            className="text-xs truncate"
            style={{ color: 'var(--color-ks-text-muted)' }}
          >
            《{resource.bookTitle}》
          </span>
        </div>

        {/* Category badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {resource.categories.map((cat) => (
            <span
              key={cat}
              className="inline-flex items-center px-2 py-px text-[11px] leading-5 rounded-[var(--radius-ks-full)] font-medium whitespace-nowrap"
              style={{
                fontFamily: 'var(--font-family-ks-heading)',
                backgroundColor: `${CATEGORY_COLORS[cat]}18`,
                color: CATEGORY_COLORS[cat],
              }}
            >
              {CATEGORY_LABELS[cat]}
            </span>
          ))}
        </div>

        {/* Description */}
        <p
          className="text-xs leading-relaxed line-clamp-2"
          style={{ color: 'var(--color-ks-text-secondary)' }}
        >
          {resource.description}
        </p>

        {/* Stats row */}
        <div
          className="flex items-center gap-4 text-xs pt-2"
          style={{
            borderTop: '1px solid var(--color-ks-border)',
            color: 'var(--color-ks-text-muted)',
          }}
        >
          <span className="inline-flex items-center gap-1">
            <Eye size={12} />
            {resource.views} 浏览
          </span>
          <button
            onClick={handleLike}
            className="inline-flex items-center gap-1 cursor-pointer transition-colors duration-150"
            style={{ color: liked ? 'var(--color-ks-accent)' : undefined }}
          >
            <Heart size={12} fill={liked ? 'var(--color-ks-accent)' : 'none'} />
            {resource.likes + (liked ? 1 : 0)} 点赞
          </button>
          <span className="inline-flex items-center gap-1">
            <MessageCircle size={12} />
            {resource.comments_count ?? resource.comments ?? 0} 评论
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-1">
          {resource.isCoReading && (
            <button
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[var(--radius-ks-sm)] cursor-pointer transition-opacity duration-150 hover:opacity-80"
              style={{
                fontFamily: 'var(--font-family-ks-heading)',
                backgroundColor: 'transparent',
                color: 'var(--color-ks-primary)',
                border: '1px solid var(--color-ks-primary)',
              }}
            >
              <Users size={12} />
              共读
            </button>
          )}
          <button
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[var(--radius-ks-sm)] cursor-pointer transition-opacity duration-150 hover:opacity-80"
            style={{
              fontFamily: 'var(--font-family-ks-heading)',
              backgroundColor: 'transparent',
              color: 'var(--color-ks-text-secondary)',
            }}
          >
            查看详情
          </button>
        </div>
      </div>
    </div>
  );
}

function CoReadingCard({ item }: { item: any }) {
  const title = item.bookTitle || item.title || '';
  const coverColor = item.coverColor || item.cover_color || '#10B981';
  const endDate = item.endDate || item.end_date || '';
  const participantCount = item.participantCount || item.current_participants || 0;
  const initials = item.participantInitials || [];
  const daysLeft = useMemo(() => {
    if (!endDate) return 0;
    const end = new Date(endDate).getTime();
    const now = Date.now();
    return Math.max(0, Math.ceil((end - now) / 86400000));
  }, [endDate]);

  return (
    <div
      className="flex flex-col w-[300px] shrink-0 p-4 rounded-[var(--radius-ks-lg)] transition-all duration-200 hover:-translate-y-0.5"
      style={{
        backgroundColor: 'var(--color-ks-card)',
        border: '1px solid var(--color-ks-border)',
        boxShadow: '0 1px 3px var(--color-ks-shadow)',
      }}
    >
      {/* Top: book info */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-1.5 h-10 rounded-full shrink-0"
          style={{ backgroundColor: coverColor }}
        />
        <div className="flex-1 min-w-0">
          <h4
            className="text-sm font-semibold leading-snug truncate"
            style={{
              fontFamily: 'var(--font-family-ks-heading)',
              color: 'var(--color-ks-text)',
            }}
          >
            {title}
          </h4>
          <div
            className="flex items-center gap-1.5 text-[11px] mt-0.5"
            style={{ color: 'var(--color-ks-text-muted)' }}
          >
            <Calendar size={10} />
            <span>剩余 {daysLeft} 天</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span
            className="text-[11px]"
            style={{
              fontFamily: 'var(--font-family-ks-heading)',
              color: 'var(--color-ks-text-muted)',
            }}
          >
            群体阅读进度
          </span>
          <span
            className="text-[11px] font-semibold tabular-nums"
            style={{
              fontFamily: 'var(--font-family-ks-heading)',
              color: 'var(--color-ks-primary)',
            }}
          >
            {item.progress}%
          </span>
        </div>
        <div
          className="w-full h-1.5 rounded-full overflow-hidden"
          style={{ backgroundColor: 'var(--color-ks-border)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${item.progress}%`,
              background: 'linear-gradient(90deg, var(--color-ks-primary) 0%, var(--color-ks-accent) 100%)',
            }}
          />
        </div>
      </div>

      {/* Participants */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center -space-x-2">
          {initials.map((initial: string, i: number) => (
            <div
              key={i}
              className="flex items-center justify-center w-6 h-6 rounded-full text-[9px] font-semibold text-white border-2"
              style={{
                fontFamily: 'var(--font-family-ks-heading)',
                background: `linear-gradient(135deg, var(--color-ks-primary), var(--color-ks-secondary))`,
                borderColor: 'var(--color-ks-card)',
                zIndex: 4 - i,
              }}
            >
              {initial}
            </div>
          ))}
        </div>
        <span
          className="text-[11px]"
          style={{ color: 'var(--color-ks-text-muted)' }}
        >
          {participantCount} 人正在共读
        </span>
      </div>

      {/* Action button */}
      <button
        className={[
          'w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-[var(--radius-ks-sm)] cursor-pointer transition-opacity duration-150 hover:opacity-90',
        ].join(' ')}
        style={{
          fontFamily: 'var(--font-family-ks-heading)',
          backgroundColor: item.isJoined ? 'var(--color-ks-card)' : 'var(--color-ks-primary)',
          color: item.isJoined ? 'var(--color-ks-primary)' : 'white',
          border: item.isJoined ? '1px solid var(--color-ks-primary)' : '1px solid transparent',
        }}
      >
        {item.isJoined ? (
          <>
            <BookOpen size={12} />
            继续阅读
          </>
        ) : (
          <>
            <Users size={12} />
            加入共读
          </>
        )}
      </button>
    </div>
  );
}
