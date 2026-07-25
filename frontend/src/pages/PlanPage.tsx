// ─── 知境（KnowScape）套餐订阅页面 ───

import { useState } from 'react';
import {
  Zap,
  Star,
  Crown,
  Sparkles,
  Check,
  X,
  Gift,
  MessageCircle,
  Ticket,
  ArrowRight,
  Wallet,
  BookOpen,
  Mail,
  Shield,
  Timer,
  ThumbsUp,
  Award,
} from 'lucide-react';

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

interface CreditPack {
  name: string;
  credits: number;
  price: number;
  unitPrice: number;
  popular?: boolean;
}

interface SubscriptionTier {
  name: string;
  price: number;
  credits: number;
  books: number;
  features: string[];
  color: string;
  gradient: string;
  icon: typeof Star;
  badge?: string;
}

interface ComparisonRow {
  label: string;
  values: (string | boolean)[];
}

/* ═══════════════════════════════════════════
   Data
   ═══════════════════════════════════════════ */

const CREDIT_PACKS: CreditPack[] = [
  { name: '体验包', credits: 100, price: 20, unitPrice: 5 },
  { name: '轻量包', credits: 500, price: 90, unitPrice: 5.6 },
  { name: '进阶包', credits: 1000, price: 160, unitPrice: 6.25, popular: true },
  { name: '尊享包', credits: 3000, price: 450, unitPrice: 6.67 },
];

const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    name: '基础',
    price: 29,
    credits: 300,
    books: 10,
    features: ['去广告', '青铜头衔'],
    color: 'var(--color-ks-text-secondary)',
    gradient: 'linear-gradient(135deg, #8B8B8B 0%, #B8B8B8 100%)',
    icon: Star,
  },
  {
    name: '标准',
    price: 59,
    credits: 800,
    books: 30,
    features: ['加速队列', '高级模型', '白银头衔'],
    color: 'var(--color-ks-secondary)',
    gradient: 'linear-gradient(135deg, #6B8FBF 0%, #93B4D8 100%)',
    icon: Shield,
  },
  {
    name: '高级',
    price: 89,
    credits: 1500,
    books: 50,
    features: ['VIP队列', '高级模型', '黄金头衔', '优先客服'],
    color: '#D4A843',
    gradient: 'linear-gradient(135deg, #D4A843 0%, #F0D080 100%)',
    icon: Crown,
    badge: '热门',
  },
  {
    name: '旗舰',
    price: 199,
    credits: 3000,
    books: 100,
    features: ['无限队列', '高级模型', '黑金头衔', '专属客服', '私有知识库', '5人协作'],
    color: '#2C2825',
    gradient: 'linear-gradient(135deg, #2C2825 0%, #5A5350 100%)',
    icon: Sparkles,
    badge: '尊享',
  },
];

const TIER_NAMES = ['免费', '基础', '标准', '高级', '旗舰'];

const COMPARISON_ROWS: ComparisonRow[] = [
  { label: '去广告', values: [false, true, true, true, true] },
  { label: '队列优先级', values: ['普通', '普通', '加速', 'VIP', '无限'] },
  { label: '高级模型', values: [false, false, true, true, true] },
  { label: '特殊头衔', values: ['—', '青铜', '白银', '黄金', '黑金'] },
  { label: '电子书/月', values: [0, 10, 30, 50, 100] },
  { label: '每月积分', values: [0, 300, 800, 1500, 3000] },
  { label: '专属客服', values: [false, false, false, '邮件', '专属'] },
  { label: '私有知识库', values: [false, false, false, false, true] },
  { label: '团队协作', values: [false, false, false, false, '5人'] },
];

const POINTS_EARNING = [
  { action: '每日签到', reward: '5/日', icon: Timer },
  { action: '发布评论', reward: '2/次（上限5次/日）', icon: MessageCircle },
  { action: '点赞资源', reward: '1/次（上限10次/日）', icon: ThumbsUp },
  { action: '发布资源', reward: '5/次（上限3次/日）', icon: BookOpen },
  { action: '阅读时长', reward: '3/日（阅读10分钟）', icon: Timer },
];

const POINTS_SPENDING = [
  { item: '深度蒸馏（单章）', cost: '50 积分' },
  { item: '完整书籍蒸馏', cost: '章数 × 50 × 0.8' },
  { item: '导出 PDF', cost: '10 积分' },
  { item: '导出 Word', cost: '15 积分' },
  { item: '高级模型（1M tokens）', cost: '20 积分' },
  { item: '兑换7天订阅', cost: '200~1000 积分' },
];

/* ═══════════════════════════════════════════
   PlanPage Component
   ═══════════════════════════════════════════ */

export default function PlanPage() {
  const [redeemCode, setRedeemCode] = useState('');

  const handleRedeem = () => {
    if (redeemCode.trim()) {
      // TODO: API call to redeem code
      setRedeemCode('');
    }
  };

  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{ backgroundColor: 'var(--color-ks-bg)' }}
    >
      <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-10">
        {/* ═══ Page Header ═══ */}
        <div className="text-center">
          <h1
            className="text-2xl font-bold mb-2"
            style={{
              fontFamily: 'var(--font-family-ks-heading)',
              color: 'var(--color-ks-text)',
            }}
          >
            套餐与订阅
          </h1>
          <p
            className="text-sm"
            style={{ color: 'var(--color-ks-text-secondary)' }}
          >
            选择适合你的知识探索计划，解锁更多高级功能
          </p>
        </div>

        {/* ═══ 一、积分套餐 ═══ */}
        <Section title="积分套餐" subtitle="一次性购买，永不过期" icon={Wallet}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {CREDIT_PACKS.map((pack) => (
              <CreditPackCard key={pack.name} pack={pack} />
            ))}
          </div>
          <div
            className="mt-4 p-3 rounded-[var(--radius-ks-md)] text-xs text-center"
            style={{
              backgroundColor: 'var(--color-ks-hover)',
              color: 'var(--color-ks-text-secondary)',
            }}
          >
            直接兑换：<strong style={{ color: 'var(--color-ks-primary)', fontFamily: 'var(--font-family-ks-heading)' }}>1元 = 5积分</strong>
          </div>
        </Section>

        {/* ═══ 二、月度订阅 ═══ */}
        <Section title="月度订阅" subtitle="按月付费，灵活畅享" icon={Crown}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SUBSCRIPTION_TIERS.map((tier) => (
              <SubscriptionCard key={tier.name} tier={tier} />
            ))}
          </div>
        </Section>

        {/* ═══ 三、权益对比表 ═══ */}
        <Section title="权益对比" subtitle="各档位功能一览" icon={Award}>
          <div className="overflow-x-auto">
            <table
              className="w-full text-sm rounded-[var(--radius-ks-lg)] overflow-hidden"
              style={{
                borderCollapse: 'separate',
                borderSpacing: 0,
              }}
            >
              {/* Table Header */}
              <thead>
                <tr>
                  <th
                    className="text-left px-4 py-3 text-xs font-semibold sticky left-0"
                    style={{
                      fontFamily: 'var(--font-family-ks-heading)',
                      backgroundColor: 'var(--color-ks-sidebar)',
                      color: 'var(--color-ks-text)',
                      borderBottom: '2px solid var(--color-ks-border)',
                    }}
                  >
                    功能
                  </th>
                  {TIER_NAMES.map((name, i) => (
                    <th
                      key={name}
                      className="px-4 py-3 text-xs font-semibold text-center"
                      style={{
                        fontFamily: 'var(--font-family-ks-heading)',
                        backgroundColor: i === 4 ? 'rgba(44, 40, 37, 0.04)' : 'var(--color-ks-sidebar)',
                        color: i === 4 ? 'var(--color-ks-text)' : 'var(--color-ks-text-secondary)',
                        borderBottom: '2px solid var(--color-ks-border)',
                      }}
                    >
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              {/* Table Body */}
              <tbody>
                {COMPARISON_ROWS.map((row, idx) => (
                  <tr
                    key={row.label}
                    className="transition-colors duration-100"
                    style={{
                      backgroundColor: idx % 2 === 0 ? 'var(--color-ks-card)' : 'var(--color-ks-bg)',
                    }}
                  >
                    <td
                      className="px-4 py-3 text-xs font-medium sticky left-0"
                      style={{
                        fontFamily: 'var(--font-family-ks-heading)',
                        color: 'var(--color-ks-text)',
                        borderBottom: '1px solid var(--color-ks-border)',
                        backgroundColor: idx % 2 === 0 ? 'var(--color-ks-card)' : 'var(--color-ks-bg)',
                      }}
                    >
                      {row.label}
                    </td>
                    {row.values.map((val, vi) => (
                      <td
                        key={vi}
                        className="px-4 py-3 text-xs text-center"
                        style={{
                          color: val === false
                            ? 'var(--color-ks-text-disabled)'
                            : val === true
                              ? 'var(--color-ks-success)'
                              : 'var(--color-ks-text-secondary)',
                          borderBottom: '1px solid var(--color-ks-border)',
                          fontFamily: typeof val === 'number' ? 'var(--font-family-ks-heading)' : undefined,
                          fontWeight: vi === 4 ? 600 : 400,
                        }}
                      >
                        {val === true ? (
                          <Check size={14} className="inline-block" style={{ color: 'var(--color-ks-success)' }} />
                        ) : val === false ? (
                          <X size={14} className="inline-block" style={{ color: 'var(--color-ks-text-disabled)' }} />
                        ) : (
                          val
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* ═══ 四、积分获取方式 ═══ */}
        <Section title="积分获取方式" subtitle="每天做任务，积分轻松攒" icon={Gift}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {POINTS_EARNING.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.action}
                  className="flex flex-col items-center gap-2 p-4 rounded-[var(--radius-ks-md)] text-center transition-all duration-150"
                  style={{
                    backgroundColor: 'var(--color-ks-card)',
                    border: '1px solid var(--color-ks-border)',
                    boxShadow: '0 1px 2px var(--color-ks-shadow)',
                  }}
                >
                  <div
                    className="flex items-center justify-center w-9 h-9 rounded-[var(--radius-ks-md)]"
                    style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-primary)' }}
                  >
                    <Icon size={18} />
                  </div>
                  <span
                    className="text-xs font-medium"
                    style={{
                      fontFamily: 'var(--font-family-ks-heading)',
                      color: 'var(--color-ks-text)',
                    }}
                  >
                    {item.action}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--color-ks-primary)' }}>
                    +{item.reward}
                  </span>
                </div>
              );
            })}
          </div>
        </Section>

        {/* ═══ 五、积分消耗 ═══ */}
        <Section title="积分消耗" subtitle="用积分解锁更多知识服务" icon={Zap}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {POINTS_SPENDING.map((item) => (
              <div
                key={item.item}
                className="flex items-center justify-between p-3 rounded-[var(--radius-ks-md)] transition-colors duration-100"
                style={{
                  backgroundColor: 'var(--color-ks-card)',
                  border: '1px solid var(--color-ks-border)',
                  boxShadow: '0 1px 2px var(--color-ks-shadow)',
                }}
              >
                <span
                  className="text-xs"
                  style={{ color: 'var(--color-ks-text-secondary)' }}
                >
                  {item.item}
                </span>
                <span
                  className="text-xs font-semibold tabular-nums shrink-0 ml-2"
                  style={{
                    fontFamily: 'var(--font-family-ks-heading)',
                    color: 'var(--color-ks-accent)',
                  }}
                >
                  {item.cost}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* ═══ 六、兑换码 ═══ */}
        <Section title="兑换码" subtitle="输入兑换码激活权益" icon={Ticket}>
          <div
            className="flex items-center gap-3 p-4 rounded-[var(--radius-ks-md)]"
            style={{
              backgroundColor: 'var(--color-ks-card)',
              border: '1px solid var(--color-ks-border)',
              boxShadow: '0 1px 2px var(--color-ks-shadow)',
            }}
          >
            <input
              type="text"
              value={redeemCode}
              onChange={(e) => setRedeemCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRedeem()}
              placeholder="请输入兑换码"
              className="flex-1 h-9 px-3 text-xs rounded-[var(--radius-ks-sm)] outline-none"
              style={{
                fontFamily: 'var(--font-family-ks-heading)',
                backgroundColor: 'var(--color-ks-bg)',
                border: '1px solid var(--color-ks-border)',
                color: 'var(--color-ks-text)',
              }}
            />
            <button
              onClick={handleRedeem}
              disabled={!redeemCode.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-[var(--radius-ks-sm)] transition-all duration-150 cursor-pointer hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              style={{
                fontFamily: 'var(--font-family-ks-heading)',
                backgroundColor: 'var(--color-ks-primary)',
                color: 'white',
              }}
            >
              <Ticket size={13} />
              兑换
            </button>
          </div>
        </Section>

        {/* ═══ 七、联系站长 ═══ */}
        <Section title="联系站长" subtitle="任何问题，欢迎咨询" icon={MessageCircle}>
          <div
            className="flex flex-col sm:flex-row items-center gap-4 p-5 rounded-[var(--radius-ks-lg)]"
            style={{
              backgroundColor: 'var(--color-ks-card)',
              border: '1px solid var(--color-ks-border)',
              boxShadow: '0 1px 3px var(--color-ks-shadow)',
            }}
          >
            <div
              className="flex items-center justify-center w-12 h-12 rounded-full shrink-0"
              style={{
                background: 'linear-gradient(135deg, var(--color-ks-primary) 0%, var(--color-ks-secondary) 100%)',
              }}
            >
              <MessageCircle size={22} style={{ color: 'white' }} />
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6">
              <div className="flex items-center gap-2">
                <span
                  className="text-xs"
                  style={{ color: 'var(--color-ks-text-muted)' }}
                >
                  微信:
                </span>
                <span
                  className="text-sm font-semibold"
                  style={{
                    fontFamily: 'var(--font-family-ks-heading)',
                    color: 'var(--color-ks-text)',
                  }}
                >
                  andyloveanny
                </span>
              </div>
              <div
                className="hidden sm:block w-px h-6"
                style={{ backgroundColor: 'var(--color-ks-border)' }}
              />
              <div className="flex items-center gap-2">
                <Mail size={13} style={{ color: 'var(--color-ks-text-muted)' }} />
                <span
                  className="text-xs"
                  style={{ color: 'var(--color-ks-text-secondary)' }}
                >
                  添加微信时请备注"知境"
                </span>
              </div>
            </div>
          </div>
        </Section>

        {/* ═══ Bottom Spacer ═══ */}
        <div className="h-4" />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════ */

/* ─── Section Wrapper ─── */

function Section({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: typeof Star;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-5">
        <div
          className="flex items-center justify-center w-8 h-8 rounded-[var(--radius-ks-md)] shrink-0"
          style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-primary)' }}
        >
          <Icon size={16} />
        </div>
        <div>
          <h2
            className="text-base font-semibold"
            style={{
              fontFamily: 'var(--font-family-ks-heading)',
              color: 'var(--color-ks-text)',
            }}
          >
            {title}
          </h2>
          <p
            className="text-xs"
            style={{ color: 'var(--color-ks-text-muted)', marginTop: 1 }}
          >
            {subtitle}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

/* ─── Credit Pack Card ─── */

function CreditPackCard({ pack }: { pack: CreditPack }) {
  return (
    <div
      className="relative flex flex-col gap-3 p-5 rounded-[var(--radius-ks-lg)] transition-all duration-200"
      style={{
        backgroundColor: 'var(--color-ks-card)',
        border: pack.popular
          ? '1.5px solid var(--color-ks-primary)'
          : '1px solid var(--color-ks-border)',
        boxShadow: pack.popular
          ? '0 4px 16px rgba(74, 111, 165, 0.12)'
          : '0 1px 3px var(--color-ks-shadow)',
      }}
    >
      {pack.popular && (
        <span
          className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-semibold tracking-wide"
          style={{
            fontFamily: 'var(--font-family-ks-heading)',
            backgroundColor: 'var(--color-ks-primary)',
            color: 'white',
          }}
        >
          推荐
        </span>
      )}
      <div className="flex items-center justify-between">
        <h3
          className="text-sm font-semibold"
          style={{
            fontFamily: 'var(--font-family-ks-heading)',
            color: 'var(--color-ks-text)',
          }}
        >
          {pack.name}
        </h3>
        <Wallet size={15} style={{ color: 'var(--color-ks-primary)' }} />
      </div>
      <div className="flex flex-col gap-0.5">
        <span
          className="text-2xl font-bold tabular-nums"
          style={{
            fontFamily: 'var(--font-family-ks-heading)',
            color: 'var(--color-ks-text)',
          }}
        >
          ¥{pack.price}
        </span>
        <span className="text-xs" style={{ color: 'var(--color-ks-text-muted)' }}>
          {pack.credits.toLocaleString()} 积分
        </span>
      </div>
      <div
        className="flex items-center justify-between pt-3 mt-auto"
        style={{ borderTop: '1px solid var(--color-ks-border)' }}
      >
        <span className="text-xs" style={{ color: 'var(--color-ks-text-muted)' }}>
          单价
        </span>
        <span
          className="text-xs font-semibold tabular-nums"
          style={{
            fontFamily: 'var(--font-family-ks-heading)',
            color: 'var(--color-ks-success)',
          }}
        >
          ¥{pack.unitPrice}/百积分
        </span>
      </div>
      <button
        className="w-full mt-1 py-2 text-xs font-medium rounded-[var(--radius-ks-sm)] transition-all duration-150 cursor-pointer hover:opacity-90"
        style={{
          fontFamily: 'var(--font-family-ks-heading)',
          backgroundColor: pack.popular ? 'var(--color-ks-primary)' : 'transparent',
          color: pack.popular ? 'white' : 'var(--color-ks-primary)',
          border: pack.popular ? 'none' : '1px solid var(--color-ks-primary)',
        }}
      >
        立即购买
      </button>
    </div>
  );
}

/* ─── Subscription Card ─── */

function SubscriptionCard({ tier }: { tier: SubscriptionTier }) {
  const Icon = tier.icon;

  return (
    <div
      className="relative flex flex-col gap-3 p-5 rounded-[var(--radius-ks-lg)] transition-all duration-200 hover:-translate-y-0.5"
      style={{
        backgroundColor: 'var(--color-ks-card)',
        border: '1px solid var(--color-ks-border)',
        boxShadow: '0 1px 3px var(--color-ks-shadow)',
        overflow: 'hidden',
      }}
    >
      {/* Top gradient stripe */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ background: tier.gradient }}
      />

      {tier.badge && (
        <span
          className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-semibold"
          style={{
            fontFamily: 'var(--font-family-ks-heading)',
            backgroundColor: tier.badge === '热门' ? 'rgba(212, 168, 67, 0.15)' : 'rgba(44, 40, 37, 0.08)',
            color: tier.color,
          }}
        >
          {tier.badge}
        </span>
      )}

      {/* Icon + Name */}
      <div className="flex items-center gap-2.5">
        <div
          className="flex items-center justify-center w-9 h-9 rounded-[var(--radius-ks-md)] shrink-0"
          style={{ background: tier.gradient }}
        >
          <Icon size={18} style={{ color: 'white' }} />
        </div>
        <div>
          <h3
            className="text-sm font-semibold"
            style={{
              fontFamily: 'var(--font-family-ks-heading)',
              color: 'var(--color-ks-text)',
            }}
          >
            {tier.name}
          </h3>
          <span className="text-[11px]" style={{ color: 'var(--color-ks-text-muted)' }}>
            {tier.credits.toLocaleString()} 积分/月
          </span>
        </div>
      </div>

      {/* Price */}
      <div className="flex items-baseline gap-0.5">
        <span
          className="text-2xl font-bold tabular-nums"
          style={{
            fontFamily: 'var(--font-family-ks-heading)',
            color: 'var(--color-ks-text)',
          }}
        >
          ¥{tier.price}
        </span>
        <span className="text-xs" style={{ color: 'var(--color-ks-text-muted)' }}>
          /月
        </span>
      </div>

      {/* Features */}
      <div className="flex flex-col gap-1.5 mt-1">
        <div className="flex items-center gap-1.5">
          <BookOpen size={12} style={{ color: 'var(--color-ks-text-muted)' }} />
          <span className="text-xs" style={{ color: 'var(--color-ks-text-secondary)' }}>
            {tier.books} 本电子书/月
          </span>
        </div>
        {tier.features.map((f) => (
          <div key={f} className="flex items-center gap-1.5">
            <Check size={12} style={{ color: 'var(--color-ks-success)' }} />
            <span className="text-xs" style={{ color: 'var(--color-ks-text-secondary)' }}>
              {f}
            </span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button
        className="w-full mt-2 py-2 text-xs font-medium rounded-[var(--radius-ks-sm)] transition-all duration-150 cursor-pointer hover:opacity-90 inline-flex items-center justify-center gap-1.5"
        style={{
          fontFamily: 'var(--font-family-ks-heading)',
          background: tier.gradient,
          color: 'white',
        }}
      >
        订阅 {tier.name}
        <ArrowRight size={12} />
      </button>
    </div>
  );
}
