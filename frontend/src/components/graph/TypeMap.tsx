import type { TypeMapCategory } from '@/types/graph';

interface TypeMapProps {
  categories: TypeMapCategory[];
  onCategoryClick?: (category: TypeMapCategory) => void;
  onItemClick?: (item: TypeMapCategory['items'][number]) => void;
  highlightCategory?: string | null;
}

export function TypeMap({
  categories, onCategoryClick, onItemClick, highlightCategory,
}: TypeMapProps) {
  if (!categories.length) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        暂无类型数据
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 overflow-auto h-full">
      {categories.map((cat) => {
        const isHighlighted = highlightCategory === cat.id || !highlightCategory;
        return (
          <div
            key={cat.id}
            className={`
              rounded-xl border transition-all
              ${isHighlighted ? 'opacity-100' : 'opacity-40'}
            `}
            style={{ borderColor: cat.color + '40' }}
          >
            <button
              onClick={() => onCategoryClick?.(cat)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors rounded-xl"
            >
              <div
                className="w-4 h-4 rounded-full shrink-0"
                style={{ backgroundColor: cat.color }}
              />
              <span className="font-medium text-sm text-slate-700">{cat.label}</span>
              <span className="ml-auto text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {cat.count}
              </span>
            </button>
            <div className="px-4 pb-3 flex flex-wrap gap-2">
              {cat.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onItemClick?.(item)}
                  className="group relative"
                >
                  <div
                    className="px-3 py-1.5 rounded-lg text-sm transition-all border hover:shadow-sm cursor-pointer"
                    style={{
                      backgroundColor: cat.color + '10',
                      borderColor: cat.color + '30',
                      color: cat.color,
                    }}
                  >
                    <span className="font-medium">{item.label}</span>
                    <span className="ml-1.5 text-xs opacity-60">
                      — {item.chapterTitle?.slice(0, 10)}…
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
