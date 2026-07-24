import { BookOpen, Plus } from 'lucide-react';
import type { BookInfo } from '@/types';
import { Button } from '@/components/ui';
import BookCard from './BookCard';

interface BookGridProps {
  books: BookInfo[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onAddBook?: () => void;
}

function EmptyState({ onAddBook }: { onAddBook?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6">
      {/* Illustration */}
      <div
        className="flex items-center justify-center w-24 h-24 rounded-full"
        style={{
          backgroundColor: 'var(--color-ks-hover)',
          border: '1px dashed var(--color-ks-border)',
        }}
      >
        <BookOpen
          size={40}
          strokeWidth={1.5}
          style={{ color: 'var(--color-ks-text-muted)' }}
        />
      </div>

      <div className="text-center">
        <h3
          className="text-lg font-semibold font-[var(--font-family-ks-heading)]"
          style={{ color: 'var(--color-ks-text)' }}
        >
          还没有书籍
        </h3>
        <p
          className="text-sm mt-1"
          style={{ color: 'var(--color-ks-text-muted)' }}
        >
          导入你的第一本书，开始知识蒸馏之旅
        </p>
      </div>

      {onAddBook && (
        <Button
          variant="primary"
          size="lg"
          icon={<Plus size={16} />}
          onClick={onAddBook}
        >
          导入第一本书
        </Button>
      )}
    </div>
  );
}

export default function BookGrid({ books, onSelect, onDelete, onAddBook }: BookGridProps) {
  if (books.length === 0) {
    return <EmptyState onAddBook={onAddBook} />;
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
      {books.map((book) => (
        <BookCard
          key={book.id}
          book={book}
          onSelect={onSelect}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
