import { create } from 'zustand';
import { useToastStore } from '@/stores/toastStore';
import type {
  SubscriptionTier,
  StorageEntitlement, BookStorageInfo, StorageUpgrade,
  PointsBalance, PointsTransaction, StorageSummary,
} from '@/types/storage';
import {
  SUBSCRIPTION_ENTITLEMENTS, POINTS_COST, calcDaysLeft,
} from '@/types/storage';

// ─── 默认7天后到期 ───
function defaultExpiry(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString();
}

// ─── 模拟初始数据 ───
const MOCK_BOOK_STORAGE: BookStorageInfo[] = [
  { bookId: 'b001', fileSizeBytes: 3.2 * 1024 * 1024, storageType: 'permanent', createdAt: '2026-07-20T10:00:00Z' },
  { bookId: 'b002', fileSizeBytes: 4.8 * 1024 * 1024, storageType: 'permanent', createdAt: '2026-07-21T09:00:00Z' },
  { bookId: 'b003', fileSizeBytes: 2.1 * 1024 * 1024, storageType: 'permanent', createdAt: '2026-07-19T14:00:00Z' },
  { bookId: 'b004', fileSizeBytes: 5.5 * 1024 * 1024, storageType: 'short-term', expiresAt: defaultExpiry(), createdAt: '2026-07-22T06:00:00Z' },
  { bookId: 'b005', fileSizeBytes: 1.8 * 1024 * 1024, storageType: 'short-term', expiresAt: (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString(); })(), createdAt: '2026-07-24T08:00:00Z' },
];

const MOCK_POINTS: PointsBalance = {
  total: 120,
  history: [
    { id: 'p1', type: 'earn', amount: 100, description: '新用户注册奖励', createdAt: '2026-07-20T10:00:00Z' },
    { id: 'p2', type: 'earn', amount: 20, description: '首次蒸馏完成奖励', createdAt: '2026-07-21T15:30:00Z' },
  ],
};

const MOCK_UPGRADES: StorageUpgrade[] = [];

interface StorageStore {
  tier: SubscriptionTier;
  books: BookStorageInfo[];
  points: PointsBalance;
  upgrades: StorageUpgrade[];
  expiryChecked: boolean;

  setTier: (tier: SubscriptionTier) => void;
  getEntitlements: () => StorageEntitlement;
  getSummary: () => StorageSummary;

  addBook: (bookId: string, fileSizeBytes: number) => { ok: boolean; reason?: string };
  removeBook: (bookId: string) => void;

  upgradePermanentStorage: () => { ok: boolean; reason?: string };
  extendRetention: (bookId: string) => { ok: boolean; reason?: string };
  upgradeShelfCapacity: () => { ok: boolean; reason?: string };

  getPoints: () => number;
  addPoints: (amount: number, description: string) => void;
  spendPoints: (amount: number, description: string) => boolean;

  getExpiringBooks: () => { bookId: string; daysLeft: number }[];
  runExpiryCheck: () => void;
}

export const useStorageStore = create<StorageStore>((set, get) => ({
  tier: 'free',
  books: MOCK_BOOK_STORAGE,
  points: MOCK_POINTS,
  upgrades: MOCK_UPGRADES,
  expiryChecked: false,

  setTier: (tier) => set({ tier }),

  getEntitlements: () => {
    const { tier, upgrades } = get();
    const base = SUBSCRIPTION_ENTITLEMENTS[tier];
    const extraStorage = upgrades
      .filter((u) => u.type === 'permanent_storage')
      .reduce((sum, u) => sum + u.amount, 0);
    const extraShelf = upgrades
      .filter((u) => u.type === 'shelf_capacity')
      .reduce((sum, u) => sum + u.amount, 0);
    return {
      ...base,
      permanentStorageMB: base.permanentStorageMB + extraStorage,
      shelfCapacity: base.shelfCapacity + extraShelf,
    };
  },

  getSummary: () => {
    const { books, tier, points, upgrades } = get();
    const entitle = get().getEntitlements();

    let permanentUsedBytes = 0;
    let shortTermUsedBytes = 0;
    const shortTermItems: { bookId: string; expiresAt: string; daysLeft: number }[] = [];

    for (const b of books) {
      if (b.storageType === 'permanent') {
        permanentUsedBytes += b.fileSizeBytes;
      } else {
        shortTermUsedBytes += b.fileSizeBytes;
        shortTermItems.push({
          bookId: b.bookId,
          expiresAt: b.expiresAt || '',
          daysLeft: b.expiresAt ? calcDaysLeft(b.expiresAt) : 7,
        });
      }
    }

    return {
      tier,
      permanentUsedBytes,
      permanentTotalBytes: entitle.permanentStorageMB * 1024 * 1024,
      shortTermUsedBytes,
      shortTermItems,
      shelfUsed: books.length,
      shelfCapacity: entitle.shelfCapacity,
      pointsBalance: points.total,
      upgrades,
    };
  },

  addBook: (bookId, fileSizeBytes) => {
    const { books, tier } = get();
    const entitle = get().getEntitlements();

    // 书架容量校验
    if (books.length >= entitle.shelfCapacity) {
      return { ok: false, reason: `书架已满（${books.length}/${entitle.shelfCapacity}），请扩容或删除书籍` };
    }

    // 永久存储空间校验
    let permanentUsed = 0;
    for (const b of books) {
      if (b.storageType === 'permanent') permanentUsed += b.fileSizeBytes;
    }
    const permanentTotal = entitle.permanentStorageMB * 1024 * 1024;

    if (permanentUsed + fileSizeBytes <= permanentTotal) {
      set((s) => ({
        books: [...s.books, { bookId, fileSizeBytes, storageType: 'permanent', createdAt: new Date().toISOString() }],
      }));
      return { ok: true };
    }

    // 超出永久 → 进入短期存储
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (tier === 'free' ? 7 : SUBSCRIPTION_ENTITLEMENTS[tier].shortTermRetentionDays));

    set((s) => ({
      books: [...s.books, {
        bookId, fileSizeBytes, storageType: 'short-term',
        expiresAt: expiresAt.toISOString(), createdAt: new Date().toISOString(),
      }],
    }));

    const toast = useToastStore.getState();
    toast.addToast(
      `书籍已存入短期存储，保留至 ${expiresAt.toLocaleDateString('zh-CN')}`,
      'warning', 5000,
    );

    return { ok: true };
  },

  removeBook: (bookId) => {
    set((s) => ({
      books: s.books.filter((b) => b.bookId !== bookId),
    }));
  },

  upgradePermanentStorage: () => {
    const points = get().points.total;
    if (points < POINTS_COST.PERMANENT_STORAGE_20MB) {
      return { ok: false, reason: `积分不足，需要 ${POINTS_COST.PERMANENT_STORAGE_20MB} 积分（当前 ${points}）` };
    }

    const ok = get().spendPoints(POINTS_COST.PERMANENT_STORAGE_20MB, '扩容永久存储 +20MB');
    if (!ok) return { ok: false, reason: '积分扣除失败' };

    const upgrade: StorageUpgrade = {
      type: 'permanent_storage',
      amount: 20,
      costPoints: POINTS_COST.PERMANENT_STORAGE_20MB,
      purchasedAt: new Date().toISOString(),
    };
    set((s) => ({ upgrades: [...s.upgrades, upgrade] }));

    const toast = useToastStore.getState();
    toast.addToast('永久存储扩容成功 +20MB', 'success');
    return { ok: true };
  },

  extendRetention: (bookId) => {
    const { books, points } = get();
    const book = books.find((b) => b.bookId === bookId);
    if (!book) return { ok: false, reason: '书籍未找到' };
    if (book.storageType !== 'short-term') return { ok: false, reason: '该书籍为永久存储，无需续期' };

    if (points.total < POINTS_COST.EXTEND_RETENTION_7DAYS) {
      return { ok: false, reason: `积分不足，需要 ${POINTS_COST.EXTEND_RETENTION_7DAYS} 积分` };
    }

    const ok = get().spendPoints(POINTS_COST.EXTEND_RETENTION_7DAYS, `延长书籍 ${bookId} 短期存储 7 天`);
    if (!ok) return { ok: false, reason: '积分扣除失败' };

    set((s) => ({
      books: s.books.map((b) =>
        b.bookId === bookId
          ? {
              ...b,
              expiresAt: (() => {
                const d = new Date(b.expiresAt || new Date());
                d.setDate(d.getDate() + 7);
                return d.toISOString();
              })(),
            }
          : b
      ),
      upgrades: [...s.upgrades, {
        type: 'extend_retention',
        amount: 7,
        bookId,
        costPoints: POINTS_COST.EXTEND_RETENTION_7DAYS,
        purchasedAt: new Date().toISOString(),
      }],
    }));

    const toast = useToastStore.getState();
    toast.addToast('短期存储延长成功 +7天', 'success');
    return { ok: true };
  },

  upgradeShelfCapacity: () => {
    const points = get().points.total;
    if (points < POINTS_COST.SHELF_CAPACITY_1) {
      return { ok: false, reason: `积分不足，需要 ${POINTS_COST.SHELF_CAPACITY_1} 积分` };
    }

    const ok = get().spendPoints(POINTS_COST.SHELF_CAPACITY_1, '扩容书架 +1 位置');
    if (!ok) return { ok: false, reason: '积分扣除失败' };

    set((s) => ({
      upgrades: [...s.upgrades, {
        type: 'shelf_capacity',
        amount: 1,
        costPoints: POINTS_COST.SHELF_CAPACITY_1,
        purchasedAt: new Date().toISOString(),
      }],
    }));

    const toast = useToastStore.getState();
    toast.addToast('书架扩容成功 +1 位置', 'success');
    return { ok: true };
  },

  getPoints: () => get().points.total,

  addPoints: (amount, description) => {
    const tx: PointsTransaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'earn',
      amount,
      description,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({
      points: {
        total: s.points.total + amount,
        history: [tx, ...s.points.history],
      },
    }));
  },

  spendPoints: (amount, description) => {
    const { points } = get();
    if (points.total < amount) return false;

    const tx: PointsTransaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: 'spend',
      amount,
      description,
      createdAt: new Date().toISOString(),
    };
    set((s) => ({
      points: {
        total: s.points.total - amount,
        history: [...s.points.history, tx],
      },
    }));
    return true;
  },

  getExpiringBooks: () => {
    const { books } = get();
    return books
      .filter((b) => b.storageType === 'short-term' && b.expiresAt)
      .map((b) => ({ bookId: b.bookId, daysLeft: calcDaysLeft(b.expiresAt!) }))
      .filter((b) => b.daysLeft > 0 && b.daysLeft <= 7);
  },

  runExpiryCheck: () => {
    const { books, expiryChecked } = get();
    if (expiryChecked) return;
    set({ expiryChecked: true });

    const toast = useToastStore.getState();

    for (const b of books) {
      if (b.storageType !== 'short-term' || !b.expiresAt) continue;
      const daysLeft = calcDaysLeft(b.expiresAt);

      if (daysLeft === 0) {
        // 过期自动删除
        set((s) => ({
          books: s.books.filter((bk) => bk.bookId !== b.bookId),
        }));
        toast.addToast(`书籍存储已到期，已自动清理`, 'warning', 6000);
      } else if (daysLeft === 1) {
        toast.addToast(`📚 书籍即将到期（1天后），请及时续期或移至永久存储`, 'warning', 8000);
      }
    }
  },
}));