// ─── 知境存储权益系统类型定义 ───

// ─── 订阅档位 ───
export type SubscriptionTier = 'free' | 'basic' | 'standard' | 'premium' | 'flagship';

export const SUBSCRIPTION_LABELS: Record<SubscriptionTier, string> = {
  free: '免费用户',
  basic: '基础订阅',
  standard: '标准订阅',
  premium: '高级订阅',
  flagship: '旗舰订阅',
};

// ─── 存储权益定义 ───
export interface StorageEntitlement {
  shelfCapacity: number;
  permanentStorageMB: number;
  shortTermRetentionDays: number;
  canDelete: boolean;
}

export const SUBSCRIPTION_ENTITLEMENTS: Record<SubscriptionTier, StorageEntitlement> = {
  free:     { shelfCapacity: 5,   permanentStorageMB: 20,  shortTermRetentionDays: 7,  canDelete: true },
  basic:    { shelfCapacity: 20,  permanentStorageMB: 100, shortTermRetentionDays: 14, canDelete: true },
  standard: { shelfCapacity: 50,  permanentStorageMB: 200, shortTermRetentionDays: 30, canDelete: true },
  premium:  { shelfCapacity: 100, permanentStorageMB: 500, shortTermRetentionDays: 60, canDelete: true },
  flagship: { shelfCapacity: 999, permanentStorageMB: 1024, shortTermRetentionDays: 36500, canDelete: true },
};

// ─── 存储类型 ───
export type StorageType = 'permanent' | 'short-term';

// ─── 每本书的存储状态 ───
export interface BookStorageInfo {
  bookId: string;
  fileSizeBytes: number;
  storageType: StorageType;
  expiresAt?: string;       // ISO 8601, short-term only
  createdAt: string;
}

// ─── 扩容记录 ───
export interface StorageUpgrade {
  type: 'permanent_storage' | 'shelf_capacity' | 'extend_retention';
  amount: number;           // MB for storage, count for shelf, days for retention
  bookId?: string;          // for extend_retention
  costPoints: number;
  purchasedAt: string;
}

// ─── 积分系统 ───
export interface PointsBalance {
  total: number;
  history: PointsTransaction[];
}

export interface PointsTransaction {
  id: string;
  type: 'earn' | 'spend';
  amount: number;
  description: string;
  createdAt: string;
}

// ─── 存储状态汇总 ───
export interface StorageSummary {
  tier: SubscriptionTier;
  permanentUsedBytes: number;
  permanentTotalBytes: number;
  shortTermUsedBytes: number;
  shortTermItems: { bookId: string; expiresAt: string; daysLeft: number }[];
  shelfUsed: number;
  shelfCapacity: number;
  pointsBalance: number;
  upgrades: StorageUpgrade[];
}

// ─── 积分消耗常量 ───
export const POINTS_COST = {
  PERMANENT_STORAGE_20MB: 50,
  EXTEND_RETENTION_7DAYS: 10,
  SHELF_CAPACITY_1: 20,
} as const;

// ─── 辅助函数 ───

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

export function calcDaysLeft(expiresAt: string): number {
  const now = Date.now();
  const exp = new Date(expiresAt).getTime();
  return Math.max(0, Math.ceil((exp - now) / (1000 * 60 * 60 * 24)));
}

export function calcExpiryLabel(daysLeft: number): string {
  if (daysLeft <= 0) return '已过期';
  if (daysLeft === 1) return '⏳1天';
  if (daysLeft <= 3) return `⏳${daysLeft}天`;
  if (daysLeft <= 7) return `⏳${daysLeft}天`;
  return `${daysLeft}天`;
}

export function getExpiryWarningLevel(daysLeft: number): 'critical' | 'warning' | 'normal' {
  if (daysLeft <= 1) return 'critical';
  if (daysLeft <= 3) return 'warning';
  return 'normal';
}

// ─── 套餐兑换请求 ───
export type RedeemRequestStatus = 'pending' | 'approved' | 'rejected';

export interface RedeemRequest {
  id: string;
  user_id: string;
  username: string;
  plan: SubscriptionTier;
  status: RedeemRequestStatus;
  contact: string;
  admin_id?: string;
  approved_at?: string;
  created_at: string;
}

export interface RedeemRequestResponse {
  id: string;
  plan: string;
  points: number;
}

// ─── 套餐显示配置 ───
export interface PlanConfig {
  key: SubscriptionTier;
  label: string;
  price: number;
  monthlyPoints: number;
  ebookQuota: number;
  features: string[];
  color: string;
  gradient: string;
  badge: string;
}

export const PLAN_CONFIGS: PlanConfig[] = [
  {
    key: 'free',
    label: '免费',
    price: 0,
    monthlyPoints: 0,
    ebookQuota: 2,
    features: ['基础模型', '社区资源', '每日签到'],
    color: '#6b7280',
    gradient: 'from-gray-400 to-gray-500',
    badge: '当前',
  },
  {
    key: 'basic',
    label: '基础',
    price: 29,
    monthlyPoints: 300,
    ebookQuota: 10,
    features: ['去广告', '青铜头衔', '加速队列'],
    color: '#8b5cf6',
    gradient: 'from-purple-400 to-purple-500',
    badge: 'HOT',
  },
  {
    key: 'standard',
    label: '标准',
    price: 59,
    monthlyPoints: 800,
    ebookQuota: 30,
    features: ['加速队列', '高级模型', '白银头衔', '优先客服'],
    color: '#3b82f6',
    gradient: 'from-blue-400 to-blue-500',
    badge: '推荐',
  },
  {
    key: 'premium',
    label: '高级',
    price: 89,
    monthlyPoints: 1500,
    ebookQuota: 50,
    features: ['VIP队列', '高级模型', '黄金头衔', '优先客服', '私有知识库'],
    color: '#f59e0b',
    gradient: 'from-amber-400 to-orange-500',
    badge: '畅销',
  },
  {
    key: 'flagship',
    label: '旗舰',
    price: 199,
    monthlyPoints: 3000,
    ebookQuota: 100,
    features: ['无限队列', '高级模型', '黑金头衔', '专属客服', '私有知识库', '5人团队协作'],
    color: '#ef4444',
    gradient: 'from-red-400 to-red-500',
    badge: '至尊',
  },
];