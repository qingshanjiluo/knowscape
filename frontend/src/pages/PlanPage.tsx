// ─── 知境（KnowScape）套餐订阅页面 ───

import { useState } from 'react';
import {
  Zap, Star, Crown, Sparkles, Check, X, Gift, MessageCircle,
  Ticket, ArrowRight, Wallet, BookOpen, Mail, Shield, Timer,
  ThumbsUp, Award, QrCode, Send, Loader2, CheckCircle2,
  AlertCircle, Image,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { PLAN_CONFIGS, formatBytes } from '@/types/storage';
import type { SubscriptionTier, RedeemRequest } from '@/types/storage';

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

interface CreditPack {
  name: string; credits: number; price: number; unitPrice: number; popular?: boolean;
}

interface ComparisonRow {
  label: string; values: (string | boolean)[];
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
   Component
   ═══════════════════════════════════════════ */

export default function PlanPage() {
  const user = useAuthStore((s) => s.user);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemMsg, setRedeemMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [redeemLoading, setRedeemLoading] = useState(false);

  const [planModal, setPlanModal] = useState<SubscriptionTier | null>(null);
  const [reqLoading, setReqLoading] = useState(false);
  const [reqResult, setReqResult] = useState<{ ok: boolean; text: string } | null>(null);

  const handleRedeem = async () => {
    if (!redeemCode.trim() || redeemLoading) return;
    setRedeemLoading(true);
    setRedeemMsg(null);
    try {
      const resp = await fetch('/api/v1/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('knowscape-auth') ? JSON.parse(localStorage.getItem('knowscape-auth')!).state?.token : ''}` },
        body: JSON.stringify({ code: redeemCode.trim() }),
      });
      const data = await resp.json();
      if (data.success) {
        setRedeemMsg({ ok: true, text: `兑换成功！获得 ${data.data?.points || 0} 积分` });
        setRedeemCode('');
      } else {
        setRedeemMsg({ ok: false, text: data.message || '兑换失败' });
      }
    } catch {
      setRedeemMsg({ ok: false, text: '网络错误，请稍后重试' });
    } finally {
      setRedeemLoading(false);
    }
  };

  const submitRedeemRequest = async () => {
    if (!planModal || reqLoading || !user) return;
    setReqLoading(true);
    setReqResult(null);
    try {
      const resp = await fetch('/api/v1/redeem-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('knowscape-auth') ? JSON.parse(localStorage.getItem('knowscape-auth')!).state?.token : ''}` },
        body: JSON.stringify({ plan: planModal, contact: user.username || '' }),
      });
      const data = await resp.json();
      if (data.success) {
        setReqResult({ ok: true, text: '兑换请求已提交！请等待管理员审核。' });
      } else {
        setReqResult({ ok: false, text: data.message || '提交失败' });
      }
    } catch {
      setReqResult({ ok: false, text: '网络错误，请稍后重试' });
    } finally {
      setReqLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: 'var(--color-ks-bg)' }}>
      <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col gap-10">
        {/* ═══ Page Header ═══ */}
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: 'var(--font-family-ks-heading)', color: 'var(--color-ks-text)' }}>
            套餐与订阅
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-ks-text-secondary)' }}>
            选择适合你的知识探索计划，解锁更多高级功能
          </p>
        </div>

        {/* ═══ 一、积分套餐 ═══ */}
        <Section title="积分套餐" subtitle="一次性购买，永不过期" icon={Wallet}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {CREDIT_PACKS.map((pack) => <CreditPackCard key={pack.name} pack={pack} />)}
          </div>
          <div className="mt-4 p-3 rounded-[var(--radius-ks-md)] text-xs text-center" style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-text-secondary)' }}>
            直接兑换：<strong style={{ color: 'var(--color-ks-primary)', fontFamily: 'var(--font-family-ks-heading)' }}>1元 = 5积分</strong>
          </div>
        </Section>

        {/* ═══ 二、月度订阅（点击查看详情） ═══ */}
        <Section title="月度订阅" subtitle="点击套餐卡片查看详情并提交兑换请求" icon={Crown}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PLAN_CONFIGS.filter((p) => p.key !== 'free').map((plan) => (
              <SubscriptionCard key={plan.key} plan={plan} onDetail={() => setPlanModal(plan.key)} />
            ))}
          </div>
        </Section>

        {/* ═══ 三、权益对比表 ═══ */}
        <Section title="权益对比" subtitle="各档位功能一览" icon={Award}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm rounded-[var(--radius-ks-lg)] overflow-hidden" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold sticky left-0" style={{ fontFamily: 'var(--font-family-ks-heading)', backgroundColor: 'var(--color-ks-sidebar)', color: 'var(--color-ks-text)', borderBottom: '2px solid var(--color-ks-border)' }}>功能</th>
                  {TIER_NAMES.map((name, i) => (
                    <th key={name} className="px-4 py-3 text-xs font-semibold text-center" style={{ fontFamily: 'var(--font-family-ks-heading)', backgroundColor: i === 4 ? 'rgba(44, 40, 37, 0.04)' : 'var(--color-ks-sidebar)', color: i === 4 ? 'var(--color-ks-text)' : 'var(--color-ks-text-secondary)', borderBottom: '2px solid var(--color-ks-border)' }}>{name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, idx) => (
                  <tr key={row.label} className="transition-colors duration-100" style={{ backgroundColor: idx % 2 === 0 ? 'var(--color-ks-card)' : 'var(--color-ks-bg)' }}>
                    <td className="px-4 py-3 text-xs font-medium sticky left-0" style={{ fontFamily: 'var(--font-family-ks-heading)', color: 'var(--color-ks-text)', borderBottom: '1px solid var(--color-ks-border)', backgroundColor: idx % 2 === 0 ? 'var(--color-ks-card)' : 'var(--color-ks-bg)' }}>{row.label}</td>
                    {row.values.map((val, vi) => (
                      <td key={vi} className="px-4 py-3 text-xs text-center" style={{ color: val === false ? 'var(--color-ks-text-disabled)' : val === true ? 'var(--color-ks-success)' : 'var(--color-ks-text-secondary)', borderBottom: '1px solid var(--color-ks-border)', fontFamily: typeof val === 'number' ? 'var(--font-family-ks-heading)' : undefined, fontWeight: vi === 4 ? 600 : 400 }}>
                        {val === true ? <Check size={14} className="inline-block" style={{ color: 'var(--color-ks-success)' }} /> : val === false ? <X size={14} className="inline-block" style={{ color: 'var(--color-ks-text-disabled)' }} /> : val}
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
                <div key={item.action} className="flex flex-col items-center gap-2 p-4 rounded-[var(--radius-ks-md)] text-center transition-all duration-150" style={{ backgroundColor: 'var(--color-ks-card)', border: '1px solid var(--color-ks-border)', boxShadow: '0 1px 2px var(--color-ks-shadow)' }}>
                  <div className="flex items-center justify-center w-9 h-9 rounded-[var(--radius-ks-md)]" style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-primary)' }}>
                    <Icon size={18} />
                  </div>
                  <span className="text-xs font-medium" style={{ fontFamily: 'var(--font-family-ks-heading)', color: 'var(--color-ks-text)' }}>{item.action}</span>
                  <span className="text-xs" style={{ color: 'var(--color-ks-primary)' }}>+{item.reward}</span>
                </div>
              );
            })}
          </div>
        </Section>

        {/* ═══ 五、积分消耗 ═══ */}
        <Section title="积分消耗" subtitle="用积分解锁更多知识服务" icon={Zap}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {POINTS_SPENDING.map((item) => (
              <div key={item.item} className="flex items-center justify-between p-3 rounded-[var(--radius-ks-md)] transition-colors duration-100" style={{ backgroundColor: 'var(--color-ks-card)', border: '1px solid var(--color-ks-border)', boxShadow: '0 1px 2px var(--color-ks-shadow)' }}>
                <span className="text-xs" style={{ color: 'var(--color-ks-text-secondary)' }}>{item.item}</span>
                <span className="text-xs font-semibold tabular-nums shrink-0 ml-2" style={{ fontFamily: 'var(--font-family-ks-heading)', color: 'var(--color-ks-accent)' }}>{item.cost}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ═══ 六、兑换码 ═══ */}
        <Section title="兑换码" subtitle="已获得的兑换码在这里激活" icon={Ticket}>
          <div className="flex items-center gap-3 p-4 rounded-[var(--radius-ks-md)]" style={{ backgroundColor: 'var(--color-ks-card)', border: '1px solid var(--color-ks-border)', boxShadow: '0 1px 2px var(--color-ks-shadow)' }}>
            <input type="text" value={redeemCode} onChange={(e) => setRedeemCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleRedeem()} placeholder="请输入兑换码" className="flex-1 h-9 px-3 text-xs rounded-[var(--radius-ks-sm)] outline-none" style={{ fontFamily: 'var(--font-family-ks-heading)', backgroundColor: 'var(--color-ks-bg)', border: '1px solid var(--color-ks-border)', color: 'var(--color-ks-text)' }} />
            <button onClick={handleRedeem} disabled={!redeemCode.trim() || redeemLoading} className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-[var(--radius-ks-sm)] transition-all duration-150 cursor-pointer hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40" style={{ fontFamily: 'var(--font-family-ks-heading)', backgroundColor: 'var(--color-ks-primary)', color: 'white' }}>
              {redeemLoading ? <Loader2 size={13} className="ks-animate-spin" /> : <Ticket size={13} />}
              {redeemLoading ? '兑换中...' : '兑换'}
            </button>
          </div>
          {redeemMsg && (
            <div className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: redeemMsg.ok ? 'var(--color-ks-success)' : 'var(--color-ks-error)' }}>
              {redeemMsg.ok ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
              {redeemMsg.text}
            </div>
          )}
        </Section>

        {/* ═══ 七、联系站长 ═══ */}
        <Section title="联系站长" subtitle="添加微信获取兑换码" icon={MessageCircle}>
          <div className="flex flex-col sm:flex-row items-center gap-6 p-6 rounded-[var(--radius-ks-lg)]" style={{ backgroundColor: 'var(--color-ks-card)', border: '1px solid var(--color-ks-border)', boxShadow: '0 1px 3px var(--color-ks-shadow)' }}>
            {/* WeChat QR Code */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-32 h-32 rounded-[var(--radius-ks-md)] flex items-center justify-center" style={{ backgroundColor: 'var(--color-ks-hover)', border: '1px solid var(--color-ks-border)' }}>
                <img
                  src="/images/wechat-qr.png"
                  alt="站长微信二维码"
                  className="w-full h-full object-contain rounded-[var(--radius-ks-md)]"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <div className="hidden flex-col items-center gap-1 text-xs" style={{ color: 'var(--color-ks-text-muted)' }}>
                  <QrCode size={28} />
                  <span>请放置微信二维码</span>
                  <span className="text-[10px]">到 public/images/wechat-qr.png</span>
                </div>
              </div>
              <span className="text-xs font-medium" style={{ color: 'var(--color-ks-text-secondary)' }}>扫码添加站长微信</span>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-10 h-10 rounded-full" style={{ background: 'linear-gradient(135deg, var(--color-ks-primary) 0%, var(--color-ks-secondary) 100%)' }}>
                  <MessageCircle size={18} style={{ color: 'white' }} />
                </div>
                <div>
                  <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-family-ks-heading)', color: 'var(--color-ks-text)' }}>andyloveanny</span>
                  <div className="text-xs" style={{ color: 'var(--color-ks-text-muted)' }}>微信号</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-ks-text-secondary)' }}>
                <Mail size={12} />
                添加微信时请备注"知境套餐"以便快速处理
              </div>
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-ks-warning)' }}>
                <AlertCircle size={12} />
                添加后发送你想要的套餐名称，站长会给你兑换码
              </div>
            </div>
          </div>
        </Section>

        <div className="h-4" />
      </div>

      {/* ═══ 套餐详情弹窗 ═══ */}
      {planModal && (() => {
        const plan = PLAN_CONFIGS.find((p) => p.key === planModal);
        if (!plan) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => { setPlanModal(null); setReqResult(null); }}>
            <div className="w-full max-w-md rounded-[var(--radius-ks-lg)] overflow-hidden" style={{ backgroundColor: 'var(--color-ks-card)', border: '1px solid var(--color-ks-border)' }} onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="relative p-5 text-white" style={{ background: `linear-gradient(135deg, ${plan.color}dd, ${plan.color}88)` }}>
                <button onClick={() => { setPlanModal(null); setReqResult(null); }} className="absolute top-3 right-3 p-1 rounded-full hover:bg-white/20 transition-colors cursor-pointer">
                  <X size={16} />
                </button>
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-12 h-12 rounded-[var(--radius-ks-md)] bg-white/20">
                    <Crown size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-family-ks-heading)' }}>{plan.label}</h3>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-3xl font-bold">¥{plan.price}</span>
                      <span className="text-sm opacity-80">/月</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4">
                {/* Features */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold" style={{ color: 'var(--color-ks-text-secondary)', fontFamily: 'var(--font-family-ks-heading)' }}>包含权益</div>
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-ks-text)' }}>
                      <Check size={12} style={{ color: 'var(--color-ks-success)' }} />
                      {f}
                    </div>
                  ))}
                </div>

                {/* Storage info */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded" style={{ backgroundColor: 'var(--color-ks-hover)' }}>
                    <div className="text-[10px]" style={{ color: 'var(--color-ks-text-muted)' }}>永久存储</div>
                    <div className="text-xs font-semibold" style={{ color: 'var(--color-ks-text)', fontFamily: 'var(--font-family-ks-heading)' }}>
                      {plan.key === 'flagship' ? '1 GB' : `${(plan.key === 'basic' ? 100 : plan.key === 'standard' ? 200 : plan.key === 'premium' ? 500 : 20)} MB`}
                    </div>
                  </div>
                  <div className="p-2 rounded" style={{ backgroundColor: 'var(--color-ks-hover)' }}>
                    <div className="text-[10px]" style={{ color: 'var(--color-ks-text-muted)' }}>每月积分</div>
                    <div className="text-xs font-semibold" style={{ color: 'var(--color-ks-text)', fontFamily: 'var(--font-family-ks-heading)' }}>{plan.monthlyPoints}</div>
                  </div>
                  <div className="p-2 rounded" style={{ backgroundColor: 'var(--color-ks-hover)' }}>
                    <div className="text-[10px]" style={{ color: 'var(--color-ks-text-muted)' }}>书架容量</div>
                    <div className="text-xs font-semibold" style={{ color: 'var(--color-ks-text)', fontFamily: 'var(--font-family-ks-heading)' }}>
                      {plan.key === 'flagship' ? '无限制' : `${(plan.key === 'basic' ? 20 : plan.key === 'standard' ? 50 : 100)} 本`}
                    </div>
                  </div>
                  <div className="p-2 rounded" style={{ backgroundColor: 'var(--color-ks-hover)' }}>
                    <div className="text-[10px]" style={{ color: 'var(--color-ks-text-muted)' }}>电子书配额</div>
                    <div className="text-xs font-semibold" style={{ color: 'var(--color-ks-text)', fontFamily: 'var(--font-family-ks-heading)' }}>{plan.ebookQuota} 本/月</div>
                  </div>
                </div>

                {/* WeChat QR + Action */}
                <div className="p-4 rounded-lg text-center space-y-3" style={{ backgroundColor: 'var(--color-ks-hover)', border: '1px dashed var(--color-ks-border)' }}>
                  <div className="flex items-center justify-center gap-2 text-xs font-medium" style={{ color: 'var(--color-ks-text-secondary)' }}>
                    <QrCode size={14} />
                    添加站长微信获取兑换码
                  </div>
                  <div className="flex justify-center">
                    <div className="w-24 h-24 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-ks-card)', border: '1px solid var(--color-ks-border)' }}>
                      <img
                        src="/images/payment-qr.png"
                        alt="支付二维码"
                        className="w-full h-full object-contain rounded-lg"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                      <div className="hidden flex-col items-center gap-0.5 text-[10px]" style={{ color: 'var(--color-ks-text-muted)' }}>
                        <Image size={20} />
                        <span>支付二维码</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs" style={{ color: 'var(--color-ks-text-muted)' }}>
                    微信: <strong style={{ color: 'var(--color-ks-text)' }}>andyloveanny</strong>
                  </div>
                </div>

                {/* Submit request */}
                <button
                  onClick={submitRedeemRequest}
                  disabled={reqLoading || !user}
                  className="w-full py-2.5 text-sm font-medium rounded-[var(--radius-ks-sm)] transition-all duration-150 cursor-pointer hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 inline-flex items-center justify-center gap-2"
                  style={{ background: `linear-gradient(135deg, ${plan.color}, ${plan.color}cc)`, color: 'white', fontFamily: 'var(--font-family-ks-heading)' }}
                >
                  {reqLoading ? (
                    <><Loader2 size={14} className="ks-animate-spin" /> 提交中...</>
                  ) : (
                    <><Send size={14} /> 我已付款，提交兑换请求</>
                  )}
                </button>

                {!user && (
                  <div className="text-xs text-center" style={{ color: 'var(--color-ks-error)' }}>
                    请先登录后再提交兑换请求
                  </div>
                )}

                {reqResult && (
                  <div className="flex items-center gap-1.5 text-xs p-2 rounded" style={{ backgroundColor: reqResult.ok ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: reqResult.ok ? 'var(--color-ks-success)' : 'var(--color-ks-error)' }}>
                    {reqResult.ok ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                    {reqResult.text}
                  </div>
                )}

                <div className="text-[10px] text-center leading-relaxed" style={{ color: 'var(--color-ks-text-disabled)' }}>
                  提交后等待管理员审核，审核通过后自动激活套餐并发放积分
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════ */

function Section({ title, subtitle, icon: Icon, children }: { title: string; subtitle: string; icon: typeof Star; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-5">
        <div className="flex items-center justify-center w-8 h-8 rounded-[var(--radius-ks-md)] shrink-0" style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-primary)' }}>
          <Icon size={16} />
        </div>
        <div>
          <h2 className="text-base font-semibold" style={{ fontFamily: 'var(--font-family-ks-heading)', color: 'var(--color-ks-text)' }}>{title}</h2>
          <p className="text-xs" style={{ color: 'var(--color-ks-text-muted)', marginTop: 1 }}>{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function CreditPackCard({ pack }: { pack: CreditPack }) {
  return (
    <div className="relative flex flex-col gap-3 p-5 rounded-[var(--radius-ks-lg)] transition-all duration-200" style={{ backgroundColor: 'var(--color-ks-card)', border: pack.popular ? '1.5px solid var(--color-ks-primary)' : '1px solid var(--color-ks-border)', boxShadow: pack.popular ? '0 4px 16px rgba(74, 111, 165, 0.12)' : '0 1px 3px var(--color-ks-shadow)' }}>
      {pack.popular && <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-semibold tracking-wide" style={{ fontFamily: 'var(--font-family-ks-heading)', backgroundColor: 'var(--color-ks-primary)', color: 'white' }}>推荐</span>}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-family-ks-heading)', color: 'var(--color-ks-text)' }}>{pack.name}</h3>
        <Wallet size={15} style={{ color: 'var(--color-ks-primary)' }} />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-2xl font-bold tabular-nums" style={{ fontFamily: 'var(--font-family-ks-heading)', color: 'var(--color-ks-text)' }}>¥{pack.price}</span>
        <span className="text-xs" style={{ color: 'var(--color-ks-text-muted)' }}>{pack.credits.toLocaleString()} 积分</span>
      </div>
      <div className="flex items-center justify-between pt-3 mt-auto" style={{ borderTop: '1px solid var(--color-ks-border)' }}>
        <span className="text-xs" style={{ color: 'var(--color-ks-text-muted)' }}>单价</span>
        <span className="text-xs font-semibold tabular-nums" style={{ fontFamily: 'var(--font-family-ks-heading)', color: 'var(--color-ks-success)' }}>¥{pack.unitPrice}/百积分</span>
      </div>
      <button className="w-full mt-1 py-2 text-xs font-medium rounded-[var(--radius-ks-sm)] transition-all duration-150 cursor-pointer hover:opacity-90" style={{ fontFamily: 'var(--font-family-ks-heading)', backgroundColor: pack.popular ? 'var(--color-ks-primary)' : 'transparent', color: pack.popular ? 'white' : 'var(--color-ks-primary)', border: pack.popular ? 'none' : '1px solid var(--color-ks-primary)' }}>
        立即购买
      </button>
    </div>
  );
}

function SubscriptionCard({ plan, onDetail }: { plan: typeof PLAN_CONFIGS[0]; onDetail: () => void }) {
  return (
    <div
      className="relative flex flex-col gap-3 p-5 rounded-[var(--radius-ks-lg)] transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
      style={{ backgroundColor: 'var(--color-ks-card)', border: '1px solid var(--color-ks-border)', boxShadow: '0 1px 3px var(--color-ks-shadow)', overflow: 'hidden' }}
      onClick={onDetail}
    >
      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: `linear-gradient(135deg, ${plan.color}, ${plan.color}88)` }} />
      {plan.badge && (
        <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ fontFamily: 'var(--font-family-ks-heading)', backgroundColor: `${plan.color}22`, color: plan.color }}>
          {plan.badge}
        </span>
      )}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-9 h-9 rounded-[var(--radius-ks-md)] shrink-0" style={{ background: `linear-gradient(135deg, ${plan.color}, ${plan.color}88)`, color: 'white' }}>
          <Crown size={18} />
        </div>
        <div>
          <h3 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-family-ks-heading)', color: 'var(--color-ks-text)' }}>{plan.label}</h3>
          <span className="text-[11px]" style={{ color: 'var(--color-ks-text-muted)' }}>{plan.monthlyPoints.toLocaleString()} 积分/月</span>
        </div>
      </div>
      <div className="flex items-baseline gap-0.5">
        <span className="text-2xl font-bold tabular-nums" style={{ fontFamily: 'var(--font-family-ks-heading)', color: 'var(--color-ks-text)' }}>¥{plan.price}</span>
        <span className="text-xs" style={{ color: 'var(--color-ks-text-muted)' }}>/月</span>
      </div>
      <div className="flex flex-col gap-1.5 mt-1">
        <div className="flex items-center gap-1.5">
          <BookOpen size={12} style={{ color: 'var(--color-ks-text-muted)' }} />
          <span className="text-xs" style={{ color: 'var(--color-ks-text-secondary)' }}>{plan.ebookQuota} 本电子书/月</span>
        </div>
        {plan.features.slice(0, 3).map((f) => (
          <div key={f} className="flex items-center gap-1.5">
            <Check size={12} style={{ color: 'var(--color-ks-success)' }} />
            <span className="text-xs" style={{ color: 'var(--color-ks-text-secondary)' }}>{f}</span>
          </div>
        ))}
        {plan.features.length > 3 && (
          <span className="text-[10px]" style={{ color: 'var(--color-ks-text-muted)' }}>+{plan.features.length - 3} 项更多权益...</span>
        )}
      </div>
      <button className="w-full mt-2 py-2 text-xs font-medium rounded-[var(--radius-ks-sm)] transition-all duration-150 cursor-pointer hover:opacity-90 inline-flex items-center justify-center gap-1.5" style={{ fontFamily: 'var(--font-family-ks-heading)', background: `linear-gradient(135deg, ${plan.color}, ${plan.color}88)`, color: 'white' }}>
        查看详情 <ArrowRight size={12} />
      </button>
    </div>
  );
}