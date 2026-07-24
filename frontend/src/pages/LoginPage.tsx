import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const url = isRegister ? '/api/v1/auth/register' : '/api/v1/auth/login';
      const body = isRegister ? { username, email, password } : { username, password };
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || '操作失败');
      setAuth(data.token, data.user);
      navigate('/workspace');
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-ks-bg)' }}>
      <div className="w-full max-w-sm px-6">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <BookOpen size={32} style={{ color: 'var(--color-ks-primary)' }} />
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-ks-text)', fontFamily: 'var(--font-family-ks-heading)' }}>
              知境
            </h1>
          </div>
          <p className="text-sm" style={{ color: 'var(--color-ks-text-muted)' }}>
            AI 驱动的深度阅读与知识蒸馏工具
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-ks-text-secondary)' }}>用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-text)', border: '1px solid var(--color-ks-border)' }}
              placeholder="请输入用户名"
            />
          </div>

          {isRegister && (
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-ks-text-secondary)' }}>邮箱（可选）</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-text)', border: '1px solid var(--color-ks-border)' }}
                placeholder="请输入邮箱"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-ks-text-secondary)' }}>密码</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 pr-10 rounded-lg text-sm outline-none"
                style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-text)', border: '1px solid var(--color-ks-border)' }}
                placeholder="请输入密码"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 cursor-pointer"
                style={{ color: 'var(--color-ks-text-muted)' }}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: 'rgba(220, 80, 80, 0.08)', color: 'var(--color-ks-error)' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password.trim()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity duration-150 disabled:opacity-50 cursor-pointer"
            style={{ backgroundColor: 'var(--color-ks-primary)', fontFamily: 'var(--font-family-ks-heading)' }}
          >
            {loading ? <Loader2 size={16} className="ks-animate-spin" /> : null}
            {isRegister ? '注册' : '登录'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
            className="text-xs cursor-pointer transition-opacity duration-150 hover:opacity-70"
            style={{ color: 'var(--color-ks-primary)' }}
          >
            {isRegister ? '已有账号？去登录' : '没有账号？去注册'}
          </button>
        </div>

        <div className="mt-4 text-center">
          <button
            onClick={() => navigate('/')}
            className="text-xs cursor-pointer transition-opacity duration-150 hover:opacity-70"
            style={{ color: 'var(--color-ks-text-muted)' }}
          >
            返回首页
          </button>
        </div>
      </div>
    </div>
  );
}
