// ─── 知境（KnowScape）首页 ───

import { Link } from 'react-router-dom';
import {
  BookOpen,
  Search,
  MessageSquare,
  Eye,
  Brain,
  Upload,
  ArrowRight,
  Sparkles,
  ChevronRight,
} from 'lucide-react';

// ─── 数据常量 ───

const FEATURES = [
  {
    icon: BookOpen,
    title: '智能蒸馏',
    description: 'AI 自动拆解书籍，提取核心论点，生成结构化知识文档',
    color: 'var(--color-ks-primary)',
  },
  {
    icon: Search,
    title: '双栏阅读',
    description: '蒸馏文档与原文对照阅读，点击引用自动定位',
    color: 'var(--color-ks-accent)',
  },
  {
    icon: MessageSquare,
    title: '深度对话',
    description: '基于全书内容的 AI 问答，支持跨章节综合探索',
    color: 'var(--color-ks-success)',
  },
] as const;

const STATS = [
  { value: '8+', label: '已支持格式', sub: 'EPUB / PDF / Markdown 等' },
  { value: '7', label: '大内容维度', sub: '方法 / 原则 / 策略 / 模型等' },
  { value: '3', label: '级蒸馏深度', sub: '浅层 / 中层 / 深层' },
  { value: '100%', label: '本地优先', sub: '数据安全·隐私保障' },
] as const;

const STEPS = [
  {
    number: 1,
    icon: Upload,
    title: '导入',
    description: '上传 EPUB / PDF / Markdown 等格式',
    color: 'var(--color-ks-primary)',
  },
  {
    number: 2,
    icon: Brain,
    title: '蒸馏',
    description: 'AI 智能拆解、分章、提取核心论点',
    color: 'var(--color-ks-accent)',
  },
  {
    number: 3,
    icon: Eye,
    title: '学习',
    description: '阅读、对话、图谱浏览、深度生成',
    color: 'var(--color-ks-success)',
  },
] as const;

// ─── Hero Section ───

function HeroSection() {
  return (
    <section
      className="relative flex flex-col items-center justify-center text-center overflow-hidden"
      style={{ minHeight: '520px', paddingTop: '48px' }}
    >
      {/* Gradient background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: [
            'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(74, 111, 165, 0.08), transparent)',
            'radial-gradient(ellipse 60% 50% at 70% 60%, rgba(217, 119, 87, 0.06), transparent)',
          ].join(', '),
        }}
      />

      {/* Decorative dots */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: '15%',
          right: '10%',
          width: '120px',
          height: '120px',
          backgroundImage:
            'radial-gradient(circle, var(--color-ks-border) 1px, transparent 1px)',
          backgroundSize: '16px 16px',
          opacity: 0.5,
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: '20%',
          left: '8%',
          width: '80px',
          height: '80px',
          backgroundImage:
            'radial-gradient(circle, var(--color-ks-border) 1px, transparent 1px)',
          backgroundSize: '16px 16px',
          opacity: 0.4,
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-6 px-6 max-w-2xl mx-auto">
        {/* Badge */}
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
          style={{
            backgroundColor: 'var(--color-ks-hover)',
            color: 'var(--color-ks-primary)',
            fontFamily: 'var(--font-family-ks-heading)',
            border: '1px solid var(--color-ks-border)',
          }}
        >
          <Sparkles size={12} />
          AI 驱动的知识工作台
        </div>

        {/* Heading */}
        <h1
          className="text-4xl md:text-5xl font-bold leading-tight tracking-tight"
          style={{
            color: 'var(--color-ks-text)',
            fontFamily: 'var(--font-family-ks-heading)',
          }}
        >
          知境{' '}
          <span style={{ color: 'var(--color-ks-text-muted)' }}>·</span>{' '}
          <span style={{ color: 'var(--color-ks-primary)' }}>从读到懂</span>
          ，一步之遥
        </h1>

        {/* Subtitle */}
        <p
          className="text-base md:text-lg"
          style={{ color: 'var(--color-ks-text-secondary)' }}
        >
          AI 驱动的深度阅读与知识蒸馏工具
        </p>

        {/* Description */}
        <p
          className="text-sm leading-relaxed max-w-lg"
          style={{ color: 'var(--color-ks-text-muted)' }}
        >
          将任意书籍、论文、笔记导入知境，AI
          自动拆解结构、提取核心论点、生成多维度知识文档。双栏对照阅读、跨章节对话、知识图谱浏览——让每一本书都成为你的第二大脑。
        </p>

        {/* CTA Buttons */}
        <div className="flex items-center gap-3 mt-2">
          <Link
            to="/workspace"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 no-underline"
            style={{
              backgroundColor: 'var(--color-ks-primary)',
              color: 'white',
              fontFamily: 'var(--font-family-ks-heading)',
              boxShadow: '0 2px 8px rgba(74, 111, 165, 0.25)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                'var(--color-ks-primary-hover)';
              e.currentTarget.style.boxShadow =
                '0 4px 14px rgba(74, 111, 165, 0.35)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor =
                'var(--color-ks-primary)';
              e.currentTarget.style.boxShadow =
                '0 2px 8px rgba(74, 111, 165, 0.25)';
            }}
          >
            <BookOpen size={16} />
            开始阅读
          </Link>
          <Link
            to="/community"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 no-underline"
            style={{
              backgroundColor: 'var(--color-ks-card)',
              color: 'var(--color-ks-text)',
              fontFamily: 'var(--font-family-ks-heading)',
              border: '1px solid var(--color-ks-border)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-ks-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor =
                'var(--color-ks-card)';
            }}
          >
            探索社区
            <ChevronRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Features Section ───

function FeaturesSection() {
  return (
    <section className="px-6 py-20">
      <div className="max-w-4xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-12">
          <h2
            className="text-2xl font-bold mb-3"
            style={{
              color: 'var(--color-ks-text)',
              fontFamily: 'var(--font-family-ks-heading)',
            }}
          >
            核心能力
          </h2>
          <p className="text-sm" style={{ color: 'var(--color-ks-text-muted)' }}>
            三大模块，覆盖从导入到深度理解的完整链路
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, title, description, color }) => (
            <div
              key={title}
              className="flex flex-col gap-4 p-6 rounded-xl transition-all duration-200 cursor-default group"
              style={{
                backgroundColor: 'var(--color-ks-card)',
                border: '1px solid var(--color-ks-border)',
                boxShadow: '0 1px 3px var(--color-ks-shadow)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow =
                  '0 6px 20px var(--color-ks-shadow)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow =
                  '0 1px 3px var(--color-ks-shadow)';
              }}
            >
              {/* Icon */}
              <div
                className="flex items-center justify-center w-10 h-10 rounded-lg"
                style={{
                  backgroundColor: 'var(--color-ks-hover)',
                }}
              >
                <Icon size={20} style={{ color }} />
              </div>

              {/* Title */}
              <h3
                className="text-base font-semibold"
                style={{
                  color: 'var(--color-ks-text)',
                  fontFamily: 'var(--font-family-ks-heading)',
                }}
              >
                {title}
              </h3>

              {/* Description */}
              <p
                className="text-sm leading-relaxed"
                style={{ color: 'var(--color-ks-text-secondary)' }}
              >
                {description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Stats Section ───

function StatsSection() {
  return (
    <section
      className="px-6 py-16"
      style={{
        backgroundColor: 'var(--color-ks-sidebar)',
        borderTop: '1px solid var(--color-ks-border)',
        borderBottom: '1px solid var(--color-ks-border)',
      }}
    >
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-6">
          {STATS.map(({ value, label, sub }) => (
            <div key={label} className="flex flex-col items-center text-center">
              <span
                className="text-3xl md:text-4xl font-bold tabular-nums"
                style={{
                  color: 'var(--color-ks-primary)',
                  fontFamily: 'var(--font-family-ks-heading)',
                }}
              >
                {value}
              </span>
              <span
                className="text-sm font-medium mt-1.5"
                style={{
                  color: 'var(--color-ks-text)',
                  fontFamily: 'var(--font-family-ks-heading)',
                }}
              >
                {label}
              </span>
              <span
                className="text-xs mt-0.5"
                style={{ color: 'var(--color-ks-text-muted)' }}
              >
                {sub}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Workflow Section ───

function WorkflowSection() {
  return (
    <section className="px-6 py-20">
      <div className="max-w-4xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-14">
          <h2
            className="text-2xl font-bold mb-3"
            style={{
              color: 'var(--color-ks-text)',
              fontFamily: 'var(--font-family-ks-heading)',
            }}
          >
            三步完成深度阅读
          </h2>
          <p className="text-sm" style={{ color: 'var(--color-ks-text-muted)' }}>
            极简流程，专注内容
          </p>
        </div>

        {/* Step cards with connectors */}
        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-center gap-6 md:gap-0">
          {STEPS.map(({ number, icon: Icon, title, description, color }, index) => (
            <div key={number} className="flex items-center">
              {/* Step card */}
              <div
                className="flex flex-col items-center text-center p-6 rounded-xl transition-all duration-200 relative"
                style={{
                  width: '240px',
                  backgroundColor: 'var(--color-ks-card)',
                  border: '1px solid var(--color-ks-border)',
                  boxShadow: '0 1px 3px var(--color-ks-shadow)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow =
                    '0 6px 20px var(--color-ks-shadow)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow =
                    '0 1px 3px var(--color-ks-shadow)';
                }}
              >
                {/* Number badge */}
                <div
                  className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold mb-3"
                  style={{
                    backgroundColor: color,
                    color: 'white',
                    fontFamily: 'var(--font-family-ks-heading)',
                  }}
                >
                  {number}
                </div>

                {/* Icon */}
                <div
                  className="flex items-center justify-center w-10 h-10 rounded-lg mb-3"
                  style={{ backgroundColor: 'var(--color-ks-hover)' }}
                >
                  <Icon size={20} style={{ color }} />
                </div>

                {/* Title */}
                <h3
                  className="text-base font-semibold mb-1.5"
                  style={{
                    color: 'var(--color-ks-text)',
                    fontFamily: 'var(--font-family-ks-heading)',
                  }}
                >
                  {title}
                </h3>

                {/* Description */}
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: 'var(--color-ks-text-secondary)' }}
                >
                  {description}
                </p>
              </div>

              {/* Connector arrow (between steps, desktop only) */}
              {index < STEPS.length - 1 && (
                <div className="hidden md:flex items-center justify-center mx-2 shrink-0">
                  <ArrowRight
                    size={20}
                    style={{ color: 'var(--color-ks-text-disabled)' }}
                  />
                </div>
              )}

              {/* Connector arrow (between steps, mobile only) */}
              {index < STEPS.length - 1 && (
                <div className="flex md:hidden items-center justify-center my-2 rotate-90">
                  <ArrowRight
                    size={20}
                    style={{ color: 'var(--color-ks-text-disabled)' }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───

function Footer() {
  return (
    <footer
      className="px-6 py-8"
      style={{
        backgroundColor: 'var(--color-ks-sidebar)',
        borderTop: '1px solid var(--color-ks-border)',
      }}
    >
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Branding */}
        <div className="flex items-center gap-2">
          <BookOpen
            size={18}
            style={{ color: 'var(--color-ks-primary)' }}
            strokeWidth={2}
          />
          <span
            className="text-sm font-semibold"
            style={{
              color: 'var(--color-ks-text)',
              fontFamily: 'var(--font-family-ks-heading)',
            }}
          >
            知境 KnowScape
          </span>
        </div>

        {/* Links */}
        <div className="flex items-center gap-5">
          {['关于我们', '使用条款', '隐私政策'].map((label) => (
            <a
              key={label}
              href="#"
              className="text-xs no-underline transition-opacity duration-150 hover:opacity-70"
              style={{
                color: 'var(--color-ks-text-muted)',
                fontFamily: 'var(--font-family-ks-heading)',
              }}
            >
              {label}
            </a>
          ))}
        </div>

        {/* Copyright */}
        <span
          className="text-xs"
          style={{
            color: 'var(--color-ks-text-disabled)',
            fontFamily: 'var(--font-family-ks-heading)',
          }}
        >
          &copy; 2024-2026 KnowScape. All rights reserved.
        </span>
      </div>
    </footer>
  );
}

// ─── Main Page Component ───

export default function HomePage() {
  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: 'var(--color-ks-bg)',
        fontFamily: 'var(--font-family-ks-body)',
      }}
    >
      <HeroSection />
      <FeaturesSection />
      <StatsSection />
      <WorkflowSection />
      <Footer />
    </div>
  );
}
