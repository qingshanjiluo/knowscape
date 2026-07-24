import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Upload,
  Plus,
  Trash2,
  BookOpen,
  Sparkles,
  Eye,
  BookMarked,
  FileText,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
} from 'lucide-react';
import type { BookInfo, BookStatus, DistillCategory } from '@/types';
import { DISTILL_CATEGORY_COLORS, DISTILL_CATEGORY_LABELS } from '@/types';
import { Badge } from '@/components/ui';

// ─── Props ───

interface BookShelfProps {
  books: BookInfo[];
  onSelectBook: (id: string) => void;
  onDeleteBook: (id: string) => void;
  onUploadBook: () => void;
}

// ─── Constants ───

const BOOKS_PER_SHELF = 6;

const STATUS_CONFIG: Record<BookStatus, { label: string; color: string }> = {
  idle: { label: '待处理', color: 'var(--color-ks-text-muted)' },
  importing: { label: '导入中', color: 'var(--color-ks-warning)' },
  parsing: { label: '解析中', color: 'var(--color-ks-warning)' },
  parsed: { label: '已解析', color: 'var(--color-ks-secondary)' },
  distilling: { label: '蒸馏中', color: 'var(--color-ks-primary)' },
  completed: { label: '已完成', color: 'var(--color-ks-success)' },
  error: { label: '出错', color: 'var(--color-ks-error)' },
};

const FALLBACK_SPINE_COLORS = [
  '#4A6FA5',
  '#7D9B6D',
  '#C2806A',
  '#8A75B5',
  '#B88D5E',
  '#5A8F8A',
  '#B57A8A',
  '#C2453D',
  '#6B8FBF',
  '#D97757',
];

/** Shelf group tab names */
const GROUP_TABS = ['全部', '方法论', '原则', '策略', '案例', '最近'] as const;
type GroupTab = (typeof GROUP_TABS)[number];

/** Map group tab names to DistillCategory keys */
const CATEGORY_GROUP_MAP: Record<string, DistillCategory> = {
  '方法论': 'methodology',
  '原则': 'principles',
  '策略': 'strategies',
  '案例': 'caseStudies',
};

// ─── Helpers ───

/** Deterministic hash from string -> non-negative integer */
function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Get a deterministic spine width (40-70) for a book */
function getSpineWidth(bookId: string): number {
  const h = hashString(bookId);
  return 40 + (h % 31); // 40-70
}

/** Pick a deterministic fallback color */
function getSpineColor(book: BookInfo, _index: number): string {
  if (book.coverColor) return book.coverColor;
  return FALLBACK_SPINE_COLORS[hashString(book.id) % FALLBACK_SPINE_COLORS.length];
}

/** Split sorted books into shelf rows */
function splitIntoShelves(books: BookInfo[]): BookInfo[][] {
  const shelves: BookInfo[][] = [];
  for (let i = 0; i < books.length; i += BOOKS_PER_SHELF) {
    shelves.push(books.slice(i, i + BOOKS_PER_SHELF));
  }
  return shelves;
}

/** Lighten a hex color by a percentage */
function lightenColor(hex: string, percent: number): string {
  const clean = hex.replace('#', '');
  if (clean.length < 6) return hex;
  const r = Math.min(255, parseInt(clean.slice(0, 2), 16) + Math.round(255 * (percent / 100)));
  const g = Math.min(255, parseInt(clean.slice(2, 4), 16) + Math.round(255 * (percent / 100)));
  const b = Math.min(255, parseInt(clean.slice(4, 6), 16) + Math.round(255 * (percent / 100)));
  return `rgb(${r},${g},${b})`;
}

/** Darken a hex color by a percentage */
function darkenColor(hex: string, percent: number): string {
  const clean = hex.replace('#', '');
  if (clean.length < 6) return hex;
  const r = Math.max(0, parseInt(clean.slice(0, 2), 16) - Math.round(255 * (percent / 100)));
  const g = Math.max(0, parseInt(clean.slice(2, 4), 16) - Math.round(255 * (percent / 100)));
  const b = Math.max(0, parseInt(clean.slice(4, 6), 16) - Math.round(255 * (percent / 100)));
  return `rgb(${r},${g},${b})`;
}

/** Determine if a hex color is light */
function isLightColor(hex: string): boolean {
  const clean = hex.replace('#', '');
  if (clean.length < 6) return true;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

/** Get the primary (top) DistillCategory for a book based on stats.categories */
function getPrimaryCategory(book: BookInfo): DistillCategory | null {
  const cats = book.stats.categories;
  let maxCat: DistillCategory | null = null;
  let maxVal = 0;
  for (const [cat, val] of Object.entries(cats) as [DistillCategory, number][]) {
    if (val > maxVal) {
      maxVal = val;
      maxCat = cat;
    }
  }
  return maxCat;
}

// ─── Responsive Hook ───

type Breakpoint = 'desktop' | 'tablet' | 'mobile';

function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>('desktop');

  useEffect(() => {
    function check() {
      const w = window.innerWidth;
      if (w >= 1024) setBp('desktop');
      else if (w >= 768) setBp('tablet');
      else setBp('mobile');
    }
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return bp;
}

// ─── Book Spine (Desktop) ───

interface BookSpineProps {
  book: BookInfo;
  index: number;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

function BookSpine({ book, index, onSelect, onDelete }: BookSpineProps) {
  const [hovered, setHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number; below: boolean } | null>(null);
  const spineRef = useRef<HTMLDivElement>(null);
  const spineWidth = useMemo(() => getSpineWidth(book.id), [book.id]);
  const color = useMemo(() => getSpineColor(book, index), [book, index]);
  const light = useMemo(() => lightenColor(color, 0.15), [color]);
  const dark = useMemo(() => darkenColor(color, 0.15), [color]);
  const textColor = useMemo(() => (isLightColor(color) ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.92)'), [color]);
  const statusCfg = STATUS_CONFIG[book.status];

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete(book.id);
    },
    [book.id, onDelete],
  );

  // Smart tooltip positioning: measure the spine and decide above/below
  const computeTooltipPos = useCallback(() => {
    const el = spineRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const TOOLTIP_HEIGHT = 220; // approximate
    const TOOLTIP_GAP = 10;
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const showBelow = spaceAbove < TOOLTIP_HEIGHT + TOOLTIP_GAP && spaceBelow > spaceAbove;
    setTooltipPos({
      x: rect.left + rect.width / 2,
      y: showBelow ? rect.bottom + TOOLTIP_GAP : rect.top - TOOLTIP_GAP,
      below: showBelow,
    });
  }, []);

  const handleMouseEnter = useCallback(() => {
    setHovered(true);
    computeTooltipPos();
  }, [computeTooltipPos]);

  return (
    <div
      className="ks-book-spine"
      ref={spineRef}
      style={{ position: 'relative', zIndex: hovered ? 20 : 1 }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => { setHovered(false); setTooltipPos(null); }}
    >
      {/* Spine */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(book.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(book.id);
          }
        }}
        aria-label={`打开《${book.title}》`}
        style={{
          width: spineWidth,
          height: 200,
          borderRadius: '2px 3px 3px 2px',
          cursor: 'pointer',
          position: 'relative',
          transform: hovered ? 'translateY(-8px)' : 'translateY(0)',
          transition: 'transform 0.25s ease, box-shadow 0.25s ease',
          boxShadow: hovered
            ? `0 8px 20px rgba(0,0,0,0.25), -2px 0 4px rgba(0,0,0,0.1), inset 1px 0 2px rgba(255,255,255,0.25)`
            : `2px 2px 6px rgba(0,0,0,0.18), inset 1px 0 2px rgba(255,255,255,0.15)`,
          background: `linear-gradient(135deg, ${light} 0%, ${color} 30%, ${color} 70%, ${dark} 100%)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {/* Spine ridge highlight (left edge) */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.12) 100%)',
            borderRadius: '2px 0 0 2px',
          }}
        />

        {/* Top decorative line */}
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 6,
            right: 4,
            height: 1,
            background: textColor,
            opacity: 0.3,
          }}
        />

        {/* Bottom decorative line */}
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            left: 6,
            right: 4,
            height: 1,
            background: textColor,
            opacity: 0.3,
          }}
        />

        {/* Title text (vertical) */}
        <div
          style={{
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            color: textColor,
            fontSize: 12,
            fontFamily: 'var(--font-family-ks-heading)',
            fontWeight: 600,
            lineHeight: 1.3,
            letterSpacing: '0.05em',
            textAlign: 'center',
            padding: '14px 0',
            maxHeight: 160,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textShadow: isLightColor(color)
              ? '0 1px 2px rgba(0,0,0,0.08)'
              : '0 1px 2px rgba(0,0,0,0.25)',
          }}
        >
          {book.title}
        </div>

        {/* Author (small, at bottom) */}
        {spineWidth >= 48 && (
          <div
            style={{
              position: 'absolute',
              bottom: 14,
              writingMode: 'vertical-rl',
              textOrientation: 'mixed',
              color: textColor,
              fontSize: 9,
              fontFamily: 'var(--font-family-ks-body)',
              opacity: 0.7,
              maxWidth: spineWidth - 14,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {book.author}
          </div>
        )}
      </div>

      {/* Shadow beneath book on shelf */}
      <div
        style={{
          width: spineWidth + 4,
          height: 6,
          marginLeft: -2,
          marginTop: -2,
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.15) 0%, transparent 70%)',
          borderRadius: '50%',
          pointerEvents: 'none',
        }}
      />

      {/* Tooltip / floating card — rendered via Portal to escape overflow:hidden */}
      {hovered && tooltipPos && createPortal(
        <div
          className="ks-animate-slide-up"
          style={{
            position: 'fixed',
            left: tooltipPos.x,
            top: tooltipPos.y,
            transform: tooltipPos.below ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(-100%)',
            width: 240,
            padding: 14,
            borderRadius: 'var(--radius-ks-md)',
            backgroundColor: 'var(--color-ks-card)',
            border: '1px solid var(--color-ks-border)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
            zIndex: 1000,
            pointerEvents: 'auto',
            cursor: 'default',
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => { setHovered(false); setTooltipPos(null); }}
        >
          {/* Arrow */}
          <div
            style={{
              position: 'absolute',
              ...(tooltipPos.below
                ? { top: -6, borderLeft: '1px solid var(--color-ks-border)', borderTop: '1px solid var(--color-ks-border)' }
                : { bottom: -6, borderRight: '1px solid var(--color-ks-border)', borderBottom: '1px solid var(--color-ks-border)' }),
              left: '50%',
              transform: 'translateX(-50%) rotate(45deg)',
              width: 10,
              height: 10,
              backgroundColor: 'var(--color-ks-card)',
            }}
          />

          {/* Title */}
          <h4
            style={{
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'var(--font-family-ks-heading)',
              color: 'var(--color-ks-text)',
              marginBottom: 4,
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {book.title}
          </h4>

          {/* Author */}
          <p
            style={{
              fontSize: 12,
              color: 'var(--color-ks-text-secondary)',
              marginBottom: 8,
              fontFamily: 'var(--font-family-ks-body)',
            }}
          >
            {book.author}
          </p>

          {/* Status badge */}
          <div style={{ marginBottom: 8 }}>
            <Badge color={statusCfg.color} size="sm">
              {statusCfg.label}
            </Badge>
          </div>

          {/* Stats */}
          <div
            style={{
              display: 'flex',
              gap: 12,
              fontSize: 11,
              color: 'var(--color-ks-text-muted)',
              fontFamily: 'var(--font-family-ks-heading)',
              marginBottom: 10,
              paddingBottom: 10,
              borderBottom: '1px solid var(--color-ks-border)',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <FileText size={11} />
              {book.stats.totalChapters} 章
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Sparkles size={11} />
              {book.stats.distilledPoints} 论点
            </span>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(book.status === 'parsed' || book.status === 'idle') && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(book.id);
                }}
                style={{
                  flex: '1 1 auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  padding: '4px 8px',
                  fontSize: 11,
                  fontFamily: 'var(--font-family-ks-heading)',
                  fontWeight: 500,
                  color: 'white',
                  backgroundColor: 'var(--color-ks-primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-ks-sm)',
                  cursor: 'pointer',
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                <Sparkles size={11} />
                开始蒸馏
              </button>
            )}

            {(book.status === 'completed' || book.status === 'distilling') && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(book.id);
                }}
                style={{
                  flex: '1 1 auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  padding: '4px 8px',
                  fontSize: 11,
                  fontFamily: 'var(--font-family-ks-heading)',
                  fontWeight: 500,
                  color: 'white',
                  backgroundColor: 'var(--color-ks-primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-ks-sm)',
                  cursor: 'pointer',
                  transition: 'opacity 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                <Eye size={11} />
                继续阅读
              </button>
            )}

            <button
              onClick={handleDelete}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px 8px',
                fontSize: 11,
                fontFamily: 'var(--font-family-ks-heading)',
                fontWeight: 500,
                color: 'var(--color-ks-text-muted)',
                backgroundColor: 'var(--color-ks-hover)',
                border: '1px solid var(--color-ks-border)',
                borderRadius: 'var(--radius-ks-sm)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--color-ks-error)';
                e.currentTarget.style.borderColor = 'var(--color-ks-error)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-ks-text-muted)';
                e.currentTarget.style.borderColor = 'var(--color-ks-border)';
              }}
            >
              <Trash2 size={11} />
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

// ─── Import Book Spine (dashed "+" book) ───

function ImportSpine({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{ position: 'relative', zIndex: hovered ? 20 : 1 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        aria-label="导入新书"
        style={{
          width: 48,
          height: 200,
          borderRadius: '2px 3px 3px 2px',
          cursor: 'pointer',
          transform: hovered ? 'translateY(-8px)' : 'translateY(0)',
          transition: 'transform 0.25s ease, border-color 0.25s ease, background-color 0.25s ease',
          border: `2px dashed ${hovered ? 'var(--color-ks-primary)' : 'var(--color-ks-border)'}`,
          backgroundColor: hovered ? 'var(--color-ks-hover)' : 'transparent',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <Plus
          size={20}
          style={{
            color: hovered ? 'var(--color-ks-primary)' : 'var(--color-ks-text-disabled)',
            transition: 'color 0.25s ease',
          }}
        />
        <div
          style={{
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            fontSize: 10,
            fontFamily: 'var(--font-family-ks-heading)',
            color: hovered ? 'var(--color-ks-primary)' : 'var(--color-ks-text-disabled)',
            transition: 'color 0.25s ease',
          }}
        >
          导入
        </div>
      </div>
      <div
        style={{
          width: 52,
          height: 6,
          marginLeft: -2,
          marginTop: -2,
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.05) 0%, transparent 70%)',
          borderRadius: '50%',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

// ─── Empty Placeholder (dotted outline book) ───

function EmptyBookPlaceholder({ onClick }: { onClick: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label="导入第一本书"
      style={{
        width: 56,
        height: 180,
        borderRadius: '2px 3px 3px 2px',
        border: '2px dashed var(--color-ks-border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        backgroundColor: 'transparent',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-ks-primary)';
        e.currentTarget.style.backgroundColor = 'var(--color-ks-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--color-ks-border)';
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      <BookOpen size={20} style={{ color: 'var(--color-ks-text-disabled)' }} />
      <span
        style={{
          fontSize: 10,
          color: 'var(--color-ks-text-disabled)',
          fontFamily: 'var(--font-family-ks-heading)',
          textAlign: 'center',
          lineHeight: 1.3,
        }}
      >
        导入第一本书
      </span>
    </div>
  );
}

// ─── Shelf Plank ───

function ShelfPlank() {
  return (
    <div style={{ position: 'relative' }}>
      {/* Plank surface */}
      <div
        style={{
          height: 18,
          background:
            'linear-gradient(180deg, #9B8B70 0%, #8B7B60 15%, #7A6B50 40%, #6B5B45 70%, #5A4A35 100%)',
          borderRadius: '0 0 2px 2px',
          boxShadow: '0 4px 8px rgba(0,0,0,0.15), 0 2px 3px rgba(0,0,0,0.1)',
          position: 'relative',
        }}
      >
        {/* Wood grain lines */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '0 0 2px 2px',
            background:
              'repeating-linear-gradient(90deg, transparent 0px, transparent 30px, rgba(0,0,0,0.03) 30px, rgba(0,0,0,0.03) 31px)',
            pointerEvents: 'none',
          }}
        />
        {/* Front edge highlight */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 2,
            background: 'linear-gradient(90deg, rgba(255,255,255,0.08), rgba(255,255,255,0.15), rgba(255,255,255,0.08))',
            borderRadius: '0 0 2px 2px',
          }}
        />
      </div>
    </div>
  );
}

// ─── Shelf Row (Desktop) ───

interface ShelfRowProps {
  books: BookInfo[];
  shelfIndex: number;
  isLast: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onUpload: () => void;
  showEmpty: boolean;
}

function ShelfRow({ books, shelfIndex, isLast: _isLast, onSelect, onDelete, onUpload, showEmpty }: ShelfRowProps) {
  const isCompletelyEmpty = books.length === 0 && showEmpty;

  return (
    <div style={{ position: 'relative' }}>
      {/* Shelf label */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 6,
          paddingLeft: 4,
        }}
      >
        <BookMarked
          size={13}
          style={{ color: 'var(--color-ks-text-disabled)' }}
        />
        <span
          style={{
            fontSize: 11,
            fontFamily: 'var(--font-family-ks-heading)',
            color: 'var(--color-ks-text-disabled)',
            letterSpacing: '0.02em',
          }}
        >
          第 {shelfIndex + 1} 层
        </span>
      </div>

      {/* Books container */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 4,
          paddingLeft: 8,
          paddingBottom: 4,
          minHeight: 220,
          position: 'relative',
        }}
      >
        {isCompletelyEmpty ? (
          <EmptyBookPlaceholder onClick={onUpload} />
        ) : (
          <>
            {books.map((book, i) => (
              <BookSpine
                key={book.id}
                book={book}
                index={shelfIndex * BOOKS_PER_SHELF + i}
                onSelect={onSelect}
                onDelete={onDelete}
              />
            ))}
            {/* Import button as last item */}
            <ImportSpine onClick={onUpload} />
          </>
        )}
      </div>

      {/* Shelf plank */}
      <ShelfPlank />
    </div>
  );
}

// ─── Tablet Grid ───

interface TabletGridProps {
  books: BookInfo[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onUpload: () => void;
}

function TabletGrid({ books, onSelect, onDelete, onUpload }: TabletGridProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 12,
        padding: 16,
      }}
    >
      {books.map((book) => (
        <TabletBookCard
          key={book.id}
          book={book}
          onSelect={onSelect}
          onDelete={onDelete}
        />
      ))}
      {/* Add book card */}
      <div
        role="button"
        tabIndex={0}
        onClick={onUpload}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onUpload();
          }
        }}
        aria-label="导入新书"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          minHeight: 200,
          border: '2px dashed var(--color-ks-border)',
          borderRadius: 'var(--radius-ks-md)',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-ks-primary)';
          e.currentTarget.style.backgroundColor = 'var(--color-ks-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-ks-border)';
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <Plus size={24} style={{ color: 'var(--color-ks-text-disabled)' }} />
        <span
          style={{
            fontSize: 12,
            fontFamily: 'var(--font-family-ks-heading)',
            color: 'var(--color-ks-text-muted)',
          }}
        >
          导入书籍
        </span>
      </div>
    </div>
  );
}

// ─── Tablet Book Card ───

function TabletBookCard({
  book,
  onSelect,
  onDelete,
}: {
  book: BookInfo;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const color = useMemo(() => getSpineColor(book, 0), [book]);
  const statusCfg = STATUS_CONFIG[book.status];
  const [hovered, setHovered] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(book.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(book.id);
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        borderRadius: 'var(--radius-ks-md)',
        overflow: 'hidden',
        backgroundColor: 'var(--color-ks-card)',
        border: `1px solid ${hovered ? 'var(--color-ks-primary)' : 'var(--color-ks-border)'}`,
        boxShadow: hovered
          ? '0 4px 12px rgba(0,0,0,0.1)'
          : '0 1px 3px var(--color-ks-shadow)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        minHeight: 140,
      }}
    >
      {/* Color spine strip */}
      <div
        style={{
          width: 36,
          minHeight: '100%',
          background: `linear-gradient(180deg, ${lightenColor(color, 0.1)} 0%, ${color} 50%, ${darkenColor(color, 0.1)} 100%)`,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            color: isLightColor(color) ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.85)',
            fontSize: 10,
            fontWeight: 600,
            fontFamily: 'var(--font-family-ks-heading)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxHeight: 120,
          }}
        >
          {book.title}
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          minWidth: 0,
        }}
      >
        <h4
          style={{
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'var(--font-family-ks-heading)',
            color: 'var(--color-ks-text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            margin: 0,
          }}
        >
          {book.title}
        </h4>
        <p
          style={{
            fontSize: 11,
            color: 'var(--color-ks-text-secondary)',
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {book.author}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <Badge color={statusCfg.color} size="sm">
            {statusCfg.label}
          </Badge>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 10,
            color: 'var(--color-ks-text-muted)',
            marginTop: 'auto',
            paddingTop: 4,
          }}
        >
          <span>{book.stats.totalChapters} 章</span>
          <span>{book.stats.distilledPoints} 论点</span>
        </div>
      </div>

      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(book.id);
        }}
        style={{
          position: 'absolute',
          top: 6,
          right: 6,
          width: 22,
          height: 22,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 'var(--radius-ks-sm)',
          border: 'none',
          backgroundColor: 'transparent',
          color: 'var(--color-ks-text-disabled)',
          cursor: 'pointer',
          opacity: hovered ? 1 : 0,
          transition: 'opacity 0.15s, color 0.15s',
          padding: 0,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-ks-error)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-ks-text-disabled)')}
        aria-label={`删除《${book.title}》`}
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

// ─── Mobile List ───

function MobileList({
  books,
  onSelect,
  onDelete,
  onUpload,
}: {
  books: BookInfo[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onUpload: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: '12px 12px 0' }}>
      {books.map((book) => {
        const color = getSpineColor(book, 0);
        const statusCfg = STATUS_CONFIG[book.status];
        return (
          <div
            key={book.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(book.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(book.id);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 8px',
              borderBottom: '1px solid var(--color-ks-border)',
              cursor: 'pointer',
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = 'var(--color-ks-hover)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = 'transparent')
            }
          >
            {/* Color dot */}
            <div
              style={{
                width: 8,
                height: 40,
                borderRadius: 4,
                backgroundColor: color,
                flexShrink: 0,
              }}
            />

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h4
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: 'var(--font-family-ks-heading)',
                  color: 'var(--color-ks-text)',
                  margin: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {book.title}
              </h4>
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--color-ks-text-secondary)',
                  margin: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {book.author}
              </p>
            </div>

            {/* Status + Stats */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
              <Badge color={statusCfg.color} size="sm">
                {statusCfg.label}
              </Badge>
              <span
                style={{
                  fontSize: 10,
                  color: 'var(--color-ks-text-muted)',
                }}
              >
                {book.stats.totalChapters}章 / {book.stats.distilledPoints}论点
              </span>
            </div>

            {/* Delete */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(book.id);
              }}
              style={{
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--radius-ks-sm)',
                border: 'none',
                backgroundColor: 'transparent',
                color: 'var(--color-ks-text-disabled)',
                cursor: 'pointer',
                flexShrink: 0,
                padding: 0,
              }}
              aria-label={`删除《${book.title}》`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        );
      })}

      {/* Upload row */}
      <div
        role="button"
        tabIndex={0}
        onClick={onUpload}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onUpload();
          }
        }}
        aria-label="导入新书"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 8px',
          borderBottom: '1px solid var(--color-ks-border)',
          cursor: 'pointer',
          transition: 'background-color 0.15s',
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor = 'var(--color-ks-hover)')
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.backgroundColor = 'transparent')
        }
      >
        <div
          style={{
            width: 8,
            height: 40,
            borderRadius: 4,
            border: '1.5px dashed var(--color-ks-border)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Plus size={8} style={{ color: 'var(--color-ks-text-disabled)' }} />
        </div>
        <span
          style={{
            fontSize: 13,
            fontFamily: 'var(--font-family-ks-heading)',
            color: 'var(--color-ks-text-muted)',
          }}
        >
          导入新书
        </span>
      </div>
    </div>
  );
}

// ─── Stats Bar ───

function StatsBar({ books }: { books: BookInfo[] }) {
  const totalCount = books.length;
  const distilledCount = books.filter((b) => b.status === 'completed').length;
  const inProgressCount = books.filter(
    (b) => b.status === 'distilling' || b.status === 'parsing' || b.status === 'importing',
  ).length;

  // Category breakdown
  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<DistillCategory, number>> = {};
    for (const book of books) {
      for (const [cat, val] of Object.entries(book.stats.categories) as [DistillCategory, number][]) {
        counts[cat] = (counts[cat] || 0) + val;
      }
    }
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
  }, [books]);

  if (totalCount === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16,
        padding: '12px 20px',
        backgroundColor: 'var(--color-ks-card)',
        borderTop: '1px solid var(--color-ks-border)',
        fontSize: 12,
        fontFamily: 'var(--font-family-ks-heading)',
      }}
    >
      {/* Total books */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-ks-text-secondary)' }}>
        <BookOpen size={13} style={{ color: 'var(--color-ks-primary)' }} />
        <span>
          <strong style={{ color: 'var(--color-ks-text)' }}>{totalCount}</strong> 本书
        </span>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 14, backgroundColor: 'var(--color-ks-border)' }} />

      {/* Distilled */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-ks-text-secondary)' }}>
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: 'var(--color-ks-success)',
          }}
        />
        <span>
          {distilledCount} 已蒸馏
        </span>
      </div>

      {/* In progress */}
      {inProgressCount > 0 && (
        <>
          <div style={{ width: 1, height: 14, backgroundColor: 'var(--color-ks-border)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-ks-text-secondary)' }}>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: 'var(--color-ks-primary)',
                animation: 'ks-pulse 2s ease-in-out infinite',
              }}
            />
            <span>
              {inProgressCount} 进行中
            </span>
          </div>
        </>
      )}

      {/* Category dots */}
      {categoryCounts.length > 0 && (
        <>
          <div style={{ width: 1, height: 14, backgroundColor: 'var(--color-ks-border)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {categoryCounts.slice(0, 7).map(([cat]) => (
              <div
                key={cat}
                title={`${DISTILL_CATEGORY_LABELS[cat as DistillCategory]}: ${categoryCounts.find(([c]) => c === cat)?.[1] ?? 0}`}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: DISTILL_CATEGORY_COLORS[cat as DistillCategory],
                  border: '1.5px solid var(--color-ks-card)',
                  boxShadow: `0 0 0 1px ${DISTILL_CATEGORY_COLORS[cat as DistillCategory]}33`,
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main BookShelf Component ───

export default function BookShelf({
  books,
  onSelectBook,
  onDeleteBook,
  onUploadBook,
}: BookShelfProps) {
  const bp = useBreakpoint();

  // ─── Feature 1 & 2: State ───
  const [groupMode, setGroupMode] = useState<GroupTab>('全部');
  const [viewMode, setViewMode] = useState<'shelf' | 'grid' | 'list'>('shelf');
  const [autoSort, setAutoSort] = useState<boolean>(false);

  // Effective view mode: shelf only works on desktop
  const effectiveViewMode = useMemo(() => {
    if (viewMode === 'shelf' && bp !== 'desktop') return bp === 'tablet' ? 'grid' : 'list';
    return viewMode;
  }, [viewMode, bp]);

  // Sort books by updatedAt descending (most recent on top/left)
  const sortedBooks = useMemo(() => {
    return [...books].sort((a, b) => {
      const ta = new Date(a.updatedAt).getTime();
      const tb = new Date(b.updatedAt).getTime();
      return tb - ta; // most recent first
    });
  }, [books]);

  // ─── Feature 1: Group filtering ───
  const groupedBooks = useMemo(() => {
    if (groupMode === '全部') return sortedBooks;
    if (groupMode === '最近') return sortedBooks.slice(0, 6);
    // Category group
    const catKey = CATEGORY_GROUP_MAP[groupMode];
    if (!catKey) return sortedBooks;
    return sortedBooks.filter((book) => {
      const primary = getPrimaryCategory(book);
      return primary === catKey;
    });
  }, [sortedBooks, groupMode]);

  // ─── Feature 3: Auto-sort by category ───
  const autoCategoryGroups = useMemo(() => {
    if (!autoSort) return [];
    const groups: Partial<Record<DistillCategory, BookInfo[]>> = {};
    for (const book of sortedBooks) {
      const cat = getPrimaryCategory(book) || 'methodology';
      if (!groups[cat]) groups[cat] = [];
      groups[cat]!.push(book);
    }
    return Object.entries(groups)
      .filter(([, arr]) => arr!.length > 0)
      .sort((a, b) => b[1]!.length - a[1]!.length) as [DistillCategory, BookInfo[]][];
  }, [autoSort, sortedBooks]);

  // Effective books for manual mode (respects group filter)
  const manualGroupedBooks = useMemo(() => groupedBooks, [groupedBooks]);

  // Split into shelf rows (manual mode)
  const shelves = useMemo(() => splitIntoShelves(manualGroupedBooks), [manualGroupedBooks]);

  // Handle empty state
  if (books.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 20,
            padding: 32,
          }}
        >
          {/* Bookcase illustration */}
          <div
            style={{
              width: 280,
              padding: 24,
              borderRadius: 'var(--radius-ks-lg)',
              background:
                'linear-gradient(180deg, #9B8B70 0%, #8B7B60 20%, #7A6B50 50%, #6B5B45 80%, #5A4A35 100%)',
              boxShadow:
                '0 8px 32px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              position: 'relative',
            }}
          >
            {/* Wood grain overlay */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 'var(--radius-ks-lg)',
                background:
                  'repeating-linear-gradient(90deg, transparent 0px, transparent 40px, rgba(0,0,0,0.03) 40px, rgba(0,0,0,0.03) 41px)',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'relative',
                width: 40,
                height: 60,
                border: '2px dashed rgba(255,255,255,0.3)',
                borderRadius: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BookOpen size={20} style={{ color: 'rgba(255,255,255,0.5)' }} />
            </div>
            <div
              style={{
                width: '100%',
                height: 14,
                background:
                  'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(0,0,0,0.08) 100%)',
                borderRadius: '0 0 4px 4px',
              }}
            />
          </div>

          <div style={{ textAlign: 'center' }}>
            <h3
              style={{
                fontSize: 18,
                fontWeight: 600,
                fontFamily: 'var(--font-family-ks-heading)',
                color: 'var(--color-ks-text)',
                margin: 0,
                marginBottom: 6,
              }}
            >
              书架空空如也
            </h3>
            <p
              style={{
                fontSize: 13,
                color: 'var(--color-ks-text-muted)',
                margin: 0,
                maxWidth: 320,
                lineHeight: 1.6,
              }}
            >
              导入你的第一本书，开启知识蒸馏之旅
            </p>
          </div>

          <button
            onClick={onUploadBook}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 24px',
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'var(--font-family-ks-heading)',
              color: 'white',
              backgroundColor: 'var(--color-ks-primary)',
              border: 'none',
              borderRadius: 'var(--radius-ks-md)',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(74, 111, 165, 0.3)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-ks-primary-hover)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(74, 111, 165, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-ks-primary)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(74, 111, 165, 0.3)';
            }}
          >
            <Upload size={16} />
            导入第一本书
          </button>
        </div>

        <StatsBar books={books} />
      </div>
    );
  }

  // ─── Unified rendering with toolbar ───
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 24px 24px',
          position: 'relative',
        }}
      >
        {/* Floating upload button — shelf view on desktop only */}
        {effectiveViewMode === 'shelf' && bp === 'desktop' && (
          <button
            onClick={onUploadBook}
            style={{
              position: 'sticky',
              top: 0,
              float: 'right',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'var(--font-family-ks-heading)',
              color: 'white',
              backgroundColor: 'var(--color-ks-primary)',
              border: 'none',
              borderRadius: 'var(--radius-ks-md)',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(74, 111, 165, 0.3)',
              transition: 'all 0.2s ease',
              zIndex: 5,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(74, 111, 165, 0.4)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(74, 111, 165, 0.3)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <Upload size={14} />
            导入书籍
          </button>
        )}

        {/* ─── Toolbar: Group Tabs + Arrows + Auto Toggle + View Mode ─── */}
        <div
          style={{
            maxWidth: 900,
            margin: '0 auto 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          {/* Group tabs */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              padding: 3,
              backgroundColor: 'var(--color-ks-card)',
              border: '1px solid var(--color-ks-border)',
              borderRadius: 'var(--radius-ks-md)',
            }}
          >
            {GROUP_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setGroupMode(tab)}
                style={{
                  padding: '4px 12px',
                  fontSize: 12,
                  fontWeight: 500,
                  fontFamily: 'var(--font-family-ks-heading)',
                  color: groupMode === tab ? 'white' : 'var(--color-ks-text-muted)',
                  backgroundColor:
                    groupMode === tab ? 'var(--color-ks-primary)' : 'transparent',
                  border: 'none',
                  borderRadius: 'var(--radius-ks-sm)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Arrow buttons */}
          <div style={{ display: 'flex', gap: 2 }}>
            <button
              onClick={() => {
                const idx = GROUP_TABS.indexOf(groupMode);
                setGroupMode(
                  GROUP_TABS[(idx - 1 + GROUP_TABS.length) % GROUP_TABS.length],
                );
              }}
              aria-label="上一组"
              style={{
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--color-ks-border)',
                borderRadius: 'var(--radius-ks-sm)',
                backgroundColor: 'var(--color-ks-card)',
                color: 'var(--color-ks-text-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s',
                padding: 0,
              }}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => {
                const idx = GROUP_TABS.indexOf(groupMode);
                setGroupMode(GROUP_TABS[(idx + 1) % GROUP_TABS.length]);
              }}
              aria-label="下一组"
              style={{
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--color-ks-border)',
                borderRadius: 'var(--radius-ks-sm)',
                backgroundColor: 'var(--color-ks-card)',
                color: 'var(--color-ks-text-muted)',
                cursor: 'pointer',
                transition: 'all 0.15s',
                padding: 0,
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Auto sort toggle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              padding: 3,
              backgroundColor: 'var(--color-ks-card)',
              border: '1px solid var(--color-ks-border)',
              borderRadius: 'var(--radius-ks-md)',
              marginLeft: 4,
            }}
          >
            <button
              onClick={() => setAutoSort(false)}
              style={{
                padding: '3px 10px',
                fontSize: 11,
                fontWeight: 500,
                fontFamily: 'var(--font-family-ks-heading)',
                color: !autoSort ? 'white' : 'var(--color-ks-text-muted)',
                backgroundColor: !autoSort ? 'var(--color-ks-primary)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-ks-sm)',
                cursor: 'pointer',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              手动管理
            </button>
            <button
              onClick={() => setAutoSort(true)}
              style={{
                padding: '3px 10px',
                fontSize: 11,
                fontWeight: 500,
                fontFamily: 'var(--font-family-ks-heading)',
                color: autoSort ? 'white' : 'var(--color-ks-text-muted)',
                backgroundColor: autoSort ? 'var(--color-ks-primary)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-ks-sm)',
                cursor: 'pointer',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              按类别自动整理
            </button>
          </div>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* View mode toggle */}
          <div
            style={{
              display: 'flex',
              padding: 3,
              backgroundColor: 'var(--color-ks-card)',
              border: '1px solid var(--color-ks-border)',
              borderRadius: 'var(--radius-ks-md)',
            }}
          >
            {(
              [
                { mode: 'shelf' as const, Icon: BookOpen, title: '书架视图' },
                { mode: 'grid' as const, Icon: LayoutGrid, title: '网格视图' },
                { mode: 'list' as const, Icon: List, title: '列表视图' },
              ] as const
            ).map(({ mode, Icon, title }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                title={title}
                style={{
                  width: 30,
                  height: 26,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  borderRadius: 'var(--radius-ks-sm)',
                  backgroundColor:
                    effectiveViewMode === mode
                      ? 'var(--color-ks-primary)'
                      : 'transparent',
                  color:
                    effectiveViewMode === mode
                      ? 'white'
                      : 'var(--color-ks-text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  padding: 0,
                }}
              >
                <Icon size={14} />
              </button>
            ))}
          </div>
        </div>

        {/* ─── Content area ─── */}
        {effectiveViewMode === 'shelf' && bp === 'desktop' ? (
          /* Bookcase frame (desktop shelf view) */
          <div
            style={{
              maxWidth: 900,
              margin: '0 auto',
              borderRadius: 'var(--radius-ks-lg)',
              overflow: 'hidden',
              border: '1px solid rgba(107, 91, 69, 0.25)',
              boxShadow:
                '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.15)',
            }}
          >
            {/* Bookcase inner background — warm back panel */}
            <div
              style={{
                background:
                  'linear-gradient(180deg, #F5F0E8 0%, #EDE7DB 30%, #E8E0D0 60%, #E2D9C8 100%)',
                padding: '16px 24px 0',
                position: 'relative',
              }}
            >
              {/* Subtle vertical grain texture on back panel */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'repeating-linear-gradient(90deg, transparent 0px, transparent 60px, rgba(139,115,85,0.04) 60px, rgba(139,115,85,0.04) 61px)',
                  pointerEvents: 'none',
                }}
              />

              {autoSort
                ? /* Auto mode: render category sections */
                  autoCategoryGroups.map(([cat, catBooks]) => (
                    <div key={`auto-section-${cat}`} style={{ marginBottom: 8 }}>
                      {/* Category label badge */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          marginBottom: 6,
                          paddingLeft: 4,
                        }}
                      >
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: DISTILL_CATEGORY_COLORS[cat],
                          }}
                        />
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            fontFamily: 'var(--font-family-ks-heading)',
                            color: 'var(--color-ks-text-secondary)',
                          }}
                        >
                          {DISTILL_CATEGORY_LABELS[cat]}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            color: 'var(--color-ks-text-muted)',
                          }}
                        >
                          ({catBooks.length})
                        </span>
                      </div>
                      {splitIntoShelves(catBooks).map((shelfBooks, i) => (
                        <ShelfRow
                          key={`auto-${cat}-${i}`}
                          books={shelfBooks}
                          shelfIndex={i}
                          isLast={false}
                          onSelect={onSelectBook}
                          onDelete={onDeleteBook}
                          onUpload={onUploadBook}
                          showEmpty={false}
                        />
                      ))}
                    </div>
                  ))
                : /* Manual mode: normal shelves */
                  shelves.map((shelfBooks, i) => (
                    <ShelfRow
                      key={`shelf-${i}`}
                      books={shelfBooks}
                      shelfIndex={i}
                      isLast={i === shelves.length - 1}
                      onSelect={onSelectBook}
                      onDelete={onDeleteBook}
                      onUpload={onUploadBook}
                      showEmpty={books.length === 0}
                    />
                  ))}
            </div>

            {/* Bookcase base — thick wooden base */}
            <div
              style={{
                height: 24,
                background:
                  'linear-gradient(180deg, #7A6A50 0%, #6B5B45 30%, #5A4A35 70%, #4A3A2A 100%)',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2), 0 -1px 0 rgba(255,255,255,0.08)',
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'repeating-linear-gradient(90deg, transparent 0px, transparent 50px, rgba(0,0,0,0.04) 50px, rgba(0,0,0,0.04) 51px)',
                  pointerEvents: 'none',
                }}
              />
              {/* Base front edge highlight */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 1,
                  background: 'rgba(255,255,255,0.12)',
                }}
              />
            </div>
          </div>
        ) : effectiveViewMode === 'grid' ? (
          /* Grid view */
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <TabletGrid
              books={sortedBooks}
              onSelect={onSelectBook}
              onDelete={onDeleteBook}
              onUpload={onUploadBook}
            />
          </div>
        ) : (
          /* List view */
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <MobileList
              books={sortedBooks}
              onSelect={onSelectBook}
              onDelete={onDeleteBook}
              onUpload={onUploadBook}
            />
          </div>
        )}
      </div>

      {/* Stats bar */}
      <StatsBar books={books} />
    </div>
  );
}
