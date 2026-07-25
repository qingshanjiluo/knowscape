import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Save, Plus, Trash2, RefreshCw,
  Users, UserCheck, UserX, ShieldCheck,
  Ticket, Copy, Check,
  Settings, Eye, EyeOff,
  Award, Star, MessageCircle, ThumbsUp, Upload, BookOpen,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui';

interface LLMProvider {
  id: string;
  name: string;
  base_url: string;
  api_key: string;
  model: string;
  temperature: number;
  max_tokens: number;
}

interface LLMConfig {
  providers: LLMProvider[];
  default_provider: string;
  agents: Record<string, string>;
}

interface AdminUser {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
  is_active: boolean;
}

interface RedeemCode {
  id: number;
  code: string;
  points: number;
  is_used: boolean;
  used_by: string | null;
  expires_at: string;
  created_at: string;
}

interface SystemSettings {
  points_per_yuan: number;
  scroll_announcement: string;
  modal_announcement: string;
  carousel_urls: string;
  deepseek_api_key: string;
}

interface PointsConfig {
  daily_checkin_points: number;
  comment_reward_points: number;
  like_reward_points: number;
  upload_reward_points: number;
  read_reward_points: number;
}

export default function AdminPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // LLM Config state
  const [config, setConfig] = useState<LLMConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // User management state
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersMessage, setUsersMessage] = useState('');

  // Redeem code state
  const [redeemCodes, setRedeemCodes] = useState<RedeemCode[]>([]);
  const [redeemCodesLoading, setRedeemCodesLoading] = useState(false);
  const [redeemForm, setRedeemForm] = useState({ points: 100, count: 1, expire_days: 30 });
  const [redeemMessage, setRedeemMessage] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // System settings state
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  // Points config state
  const [pointsConfig, setPointsConfig] = useState<PointsConfig | null>(null);
  const [pointsLoading, setPointsLoading] = useState(false);
  const [pointsSaving, setPointsSaving] = useState(false);
  const [pointsMessage, setPointsMessage] = useState('');

  useEffect(() => {
    if (!user || !user.is_admin) {
      navigate('/');
      return;
    }
    loadConfig();
    loadUsers();
    loadRedeemCodes();
    loadSystemSettings();
    loadPointsConfig();
  }, [user, navigate]);

  // ─── LLM 配置 ───

  const loadConfig = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const resp = await fetch('/api/v1/admin/llm-config', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        setConfig(await resp.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!config) return;
    setSaving(true);
    setMessage('');
    try {
      const token = localStorage.getItem('auth_token');
      const resp = await fetch('/api/v1/admin/llm-config', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (resp.ok) {
        setMessage('✅ 配置已保存');
      } else {
        setMessage('❌ 保存失败');
      }
    } catch (e) {
      setMessage('❌ 网络错误');
    } finally {
      setSaving(false);
    }
  };

  const addProvider = () => {
    if (!config) return;
    const newProvider: LLMProvider = {
      id: `provider-${Date.now()}`,
      name: '新提供商',
      base_url: '',
      api_key: '',
      model: '',
      temperature: 0.7,
      max_tokens: 4096,
    };
    setConfig({ ...config, providers: [...config.providers, newProvider] });
  };

  const updateProvider = (idx: number, field: keyof LLMProvider, value: any) => {
    if (!config) return;
    const providers = [...config.providers];
    providers[idx] = { ...providers[idx], [field]: value };
    setConfig({ ...config, providers });
  };

  const removeProvider = (idx: number) => {
    if (!config) return;
    const providers = config.providers.filter((_, i) => i !== idx);
    setConfig({ ...config, providers });
  };

  // ─── 用户管理 ───

  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const resp = await fetch('/api/v1/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        setUsers(await resp.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUsersLoading(false);
    }
  };

  const toggleUserActive = async (userId: number, currentActive: boolean) => {
    setUsersMessage('');
    try {
      const token = localStorage.getItem('auth_token');
      const resp = await fetch(`/api/v1/admin/users/${userId}/${currentActive ? 'disable' : 'enable'}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        setUsersMessage(`✅ 用户已${currentActive ? '禁用' : '启用'}`);
        loadUsers();
      } else {
        const err = await resp.json().catch(() => ({ detail: '操作失败' }));
        setUsersMessage(`❌ ${err.detail || '操作失败'}`);
      }
    } catch (e) {
      setUsersMessage('❌ 网络错误');
    }
  };

  const toggleUserAdmin = async (userId: number, currentAdmin: boolean) => {
    setUsersMessage('');
    try {
      const token = localStorage.getItem('auth_token');
      const resp = await fetch(`/api/v1/admin/users/${userId}/${currentAdmin ? 'remove-admin' : 'set-admin'}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        setUsersMessage(`✅ 管理员权限已${currentAdmin ? '撤销' : '授予'}`);
        loadUsers();
      } else {
        const err = await resp.json().catch(() => ({ detail: '操作失败' }));
        setUsersMessage(`❌ ${err.detail || '操作失败'}`);
      }
    } catch (e) {
      setUsersMessage('❌ 网络错误');
    }
  };

  // ─── 兑换码管理 ───

  const loadRedeemCodes = async () => {
    setRedeemCodesLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const resp = await fetch('/api/v1/admin/redeem-codes', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        setRedeemCodes(await resp.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRedeemCodesLoading(false);
    }
  };

  const generateRedeemCodes = async () => {
    setRedeemMessage('');
    try {
      const token = localStorage.getItem('auth_token');
      const resp = await fetch('/api/v1/admin/redeem-codes', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(redeemForm),
      });
      if (resp.ok) {
        setRedeemMessage(`✅ 成功生成 ${redeemForm.count} 个兑换码`);
        loadRedeemCodes();
      } else {
        const err = await resp.json().catch(() => ({ detail: '生成失败' }));
        setRedeemMessage(`❌ ${err.detail || '生成失败'}`);
      }
    } catch (e) {
      setRedeemMessage('❌ 网络错误');
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  // ─── 系统设置 ───

  const loadSystemSettings = async () => {
    setSettingsLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const resp = await fetch('/api/v1/admin/settings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setSystemSettings({
          points_per_yuan: data.points_per_yuan ?? 100,
          scroll_announcement: data.scroll_announcement ?? '',
          modal_announcement: data.modal_announcement ?? '',
          carousel_urls: data.carousel_urls ?? '',
          deepseek_api_key: data.deepseek_api_key ?? '',
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSettingsLoading(false);
    }
  };

  const saveSystemSettings = async () => {
    if (!systemSettings) return;
    setSettingsSaving(true);
    setSettingsMessage('');
    try {
      const token = localStorage.getItem('auth_token');
      const resp = await fetch('/api/v1/admin/settings', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(systemSettings),
      });
      if (resp.ok) {
        setSettingsMessage('✅ 系统设置已保存');
      } else {
        const err = await resp.json().catch(() => ({ detail: '保存失败' }));
        setSettingsMessage(`❌ ${err.detail || '保存失败'}`);
      }
    } catch (e) {
      setSettingsMessage('❌ 网络错误');
    } finally {
      setSettingsSaving(false);
    }
  };

  // ─── 积分转化设置 ───

  const loadPointsConfig = async () => {
    setPointsLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const resp = await fetch('/api/v1/admin/points-config', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        setPointsConfig(await resp.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPointsLoading(false);
    }
  };

  const savePointsConfig = async () => {
    if (!pointsConfig) return;
    setPointsSaving(true);
    setPointsMessage('');
    try {
      const token = localStorage.getItem('auth_token');
      const resp = await fetch('/api/v1/admin/points-config', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(pointsConfig),
      });
      if (resp.ok) {
        setPointsMessage('✅ 积分设置已保存');
      } else {
        const err = await resp.json().catch(() => ({ detail: '保存失败' }));
        setPointsMessage(`❌ ${err.detail || '保存失败'}`);
      }
    } catch (e) {
      setPointsMessage('❌ 网络错误');
    } finally {
      setPointsSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    fontSize: '0.75rem',
    padding: '6px 10px',
    borderRadius: '6px',
    outline: 'none',
    backgroundColor: 'var(--color-ks-card)',
    color: 'var(--color-ks-text)',
    border: '1px solid var(--color-ks-border)',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.625rem',
    marginBottom: '4px',
    display: 'block',
    color: 'var(--color-ks-text-muted)',
  };

  const sectionCardStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-ks-card)',
    border: '1px solid var(--color-ks-border)',
  };

  const sectionTitleStyle: React.CSSProperties = {
    color: 'var(--color-ks-text)',
    fontFamily: 'var(--font-family-ks-heading)',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--color-ks-text-muted)' }}>
        <RefreshCw size={20} className="animate-spin" />
      </div>
    );
  }

  if (!config) return null;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-6">
        <Shield size={24} style={{ color: 'var(--color-ks-primary)' }} />
        <h1 className="text-xl font-bold" style={{ color: 'var(--color-ks-text)', fontFamily: 'var(--font-family-ks-heading)' }}>
          管理员后台
        </h1>
      </div>

      {/* ─── LLM 提供商配置 ─── */}
      <section className="rounded-xl p-5 mb-6" style={sectionCardStyle}>
        <h2 className="text-sm font-semibold mb-4" style={sectionTitleStyle}>
          LLM 提供商配置
        </h2>

        <div className="flex flex-col gap-4">
          {config.providers.map((provider, idx) => (
            <div key={provider.id} className="rounded-lg p-4" style={{ backgroundColor: 'var(--color-ks-bg)', border: '1px solid var(--color-ks-border)' }}>
              <div className="flex items-center justify-between mb-3">
                <input
                  value={provider.name}
                  onChange={(e) => updateProvider(idx, 'name', e.target.value)}
                  className="text-sm font-semibold bg-transparent outline-none"
                  style={{ color: 'var(--color-ks-text)', fontFamily: 'var(--font-family-ks-heading)' }}
                />
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-[10px] cursor-pointer" style={{ color: 'var(--color-ks-text-muted)' }}>
                    <input
                      type="radio"
                      name="default_provider"
                      checked={config.default_provider === provider.id}
                      onChange={() => setConfig({ ...config, default_provider: provider.id })}
                    />
                    默认
                  </label>
                  <button onClick={() => removeProvider(idx)} className="p-1 rounded cursor-pointer hover:opacity-70" style={{ color: 'var(--color-ks-text-disabled)' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] mb-1 block" style={{ color: 'var(--color-ks-text-muted)' }}>API Base URL</label>
                  <input
                    value={provider.base_url}
                    onChange={(e) => updateProvider(idx, 'base_url', e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 rounded-md outline-none"
                    style={{ backgroundColor: 'var(--color-ks-card)', color: 'var(--color-ks-text)', border: '1px solid var(--color-ks-border)' }}
                    placeholder="https://api.deepseek.com"
                  />
                </div>
                <div>
                  <label className="text-[10px] mb-1 block" style={{ color: 'var(--color-ks-text-muted)' }}>API Key</label>
                  <input
                    type="password"
                    value={provider.api_key}
                    onChange={(e) => updateProvider(idx, 'api_key', e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 rounded-md outline-none"
                    style={{ backgroundColor: 'var(--color-ks-card)', color: 'var(--color-ks-text)', border: '1px solid var(--color-ks-border)' }}
                    placeholder="sk-..."
                  />
                </div>
                <div>
                  <label className="text-[10px] mb-1 block" style={{ color: 'var(--color-ks-text-muted)' }}>模型</label>
                  <input
                    value={provider.model}
                    onChange={(e) => updateProvider(idx, 'model', e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 rounded-md outline-none"
                    style={{ backgroundColor: 'var(--color-ks-card)', color: 'var(--color-ks-text)', border: '1px solid var(--color-ks-border)' }}
                    placeholder="deepseek-chat"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] mb-1 block" style={{ color: 'var(--color-ks-text-muted)' }}>Temperature</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="2"
                      value={provider.temperature}
                      onChange={(e) => updateProvider(idx, 'temperature', parseFloat(e.target.value))}
                      className="w-full text-xs px-2.5 py-1.5 rounded-md outline-none"
                      style={{ backgroundColor: 'var(--color-ks-card)', color: 'var(--color-ks-text)', border: '1px solid var(--color-ks-border)' }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] mb-1 block" style={{ color: 'var(--color-ks-text-muted)' }}>Max Tokens</label>
                    <input
                      type="number"
                      step="256"
                      value={provider.max_tokens}
                      onChange={(e) => updateProvider(idx, 'max_tokens', parseInt(e.target.value))}
                      className="w-full text-xs px-2.5 py-1.5 rounded-md outline-none"
                      style={{ backgroundColor: 'var(--color-ks-card)', color: 'var(--color-ks-text)', border: '1px solid var(--color-ks-border)' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={addProvider}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer"
            style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-text-secondary)', border: '1px solid var(--color-ks-border)' }}
          >
            <Plus size={12} />
            添加提供商
          </button>
        </div>
      </section>

      {/* ─── 功能模块分配 ─── */}
      <section className="rounded-xl p-5 mb-6" style={sectionCardStyle}>
        <h2 className="text-sm font-semibold mb-4" style={sectionTitleStyle}>
          功能模块分配
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(config.agents).map(([key, value]) => (
            <div key={key}>
              <label className="text-[10px] mb-1 block" style={{ color: 'var(--color-ks-text-muted)' }}>
                {key === 'distill' ? '蒸馏' : key === 'chat' ? '对话' : key === 'rag' ? 'RAG' : '生成'}
              </label>
              <select
                value={value}
                onChange={(e) => setConfig({ ...config, agents: { ...config.agents, [key]: e.target.value } })}
                className="w-full text-xs px-2.5 py-1.5 rounded-md outline-none cursor-pointer"
                style={{ backgroundColor: 'var(--color-ks-card)', color: 'var(--color-ks-text)', border: '1px solid var(--color-ks-border)' }}
              >
                {config.providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3 mb-6">
        <Button onClick={saveConfig} disabled={saving}>
          <Save size={14} />
          {saving ? '保存中...' : '保存配置'}
        </Button>
        {message && (
          <span className="text-xs" style={{ color: message.startsWith('✅') ? 'var(--color-ks-success)' : 'var(--color-ks-error)' }}>
            {message}
          </span>
        )}
      </div>

      {/* ─── 用户管理 ─── */}
      <section className="rounded-xl p-5 mb-6" style={sectionCardStyle}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={sectionTitleStyle}>
            <span className="flex items-center gap-2">
              <Users size={14} style={{ color: 'var(--color-ks-primary)' }} />
              用户管理
            </span>
          </h2>
          <button
            onClick={loadUsers}
            className="p-1.5 rounded cursor-pointer hover:opacity-70"
            style={{ color: 'var(--color-ks-text-muted)' }}
            title="刷新"
          >
            <RefreshCw size={14} className={usersLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {usersLoading && users.length === 0 ? (
          <div className="flex justify-center py-6" style={{ color: 'var(--color-ks-text-muted)' }}>
            <RefreshCw size={16} className="animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ color: 'var(--color-ks-text)' }}>
              <thead>
                <tr style={{ color: 'var(--color-ks-text-muted)', borderBottom: '1px solid var(--color-ks-border)' }}>
                  <th className="text-left py-2 pr-3 font-medium">用户名</th>
                  <th className="text-left py-2 pr-3 font-medium">邮箱</th>
                  <th className="text-left py-2 pr-3 font-medium">角色</th>
                  <th className="text-left py-2 pr-3 font-medium">状态</th>
                  <th className="text-right py-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--color-ks-border)' }}>
                    <td className="py-2.5 pr-3 font-medium">{u.username}</td>
                    <td className="py-2.5 pr-3" style={{ color: 'var(--color-ks-text-secondary)' }}>{u.email}</td>
                    <td className="py-2.5 pr-3">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={{
                          backgroundColor: u.is_admin ? 'rgba(74, 111, 165, 0.1)' : 'var(--color-ks-bg)',
                          color: u.is_admin ? 'var(--color-ks-primary)' : 'var(--color-ks-text-muted)',
                          border: '1px solid',
                          borderColor: u.is_admin ? 'var(--color-ks-primary)' : 'var(--color-ks-border)',
                        }}
                      >
                        {u.is_admin ? <ShieldCheck size={10} /> : <UserCheck size={10} />}
                        {u.is_admin ? '管理员' : '普通'}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={{
                          backgroundColor: u.is_active ? 'rgba(125, 155, 109, 0.1)' : 'rgba(194, 69, 61, 0.1)',
                          color: u.is_active ? 'var(--color-ks-success)' : 'var(--color-ks-error)',
                        }}
                      >
                        {u.is_active ? '激活' : '禁用'}
                      </span>
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => toggleUserActive(u.id, u.is_active)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] cursor-pointer hover:opacity-70"
                          style={{
                            backgroundColor: 'var(--color-ks-bg)',
                            color: u.is_active ? 'var(--color-ks-error)' : 'var(--color-ks-success)',
                            border: '1px solid var(--color-ks-border)',
                          }}
                        >
                          {u.is_active ? <UserX size={10} /> : <UserCheck size={10} />}
                          {u.is_active ? '禁用' : '启用'}
                        </button>
                        <button
                          onClick={() => toggleUserAdmin(u.id, u.is_admin)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] cursor-pointer hover:opacity-70"
                          style={{
                            backgroundColor: 'var(--color-ks-bg)',
                            color: u.is_admin ? 'var(--color-ks-warning)' : 'var(--color-ks-primary)',
                            border: '1px solid var(--color-ks-border)',
                          }}
                        >
                          {u.is_admin ? <UserX size={10} /> : <ShieldCheck size={10} />}
                          {u.is_admin ? '撤销管理员' : '设为管理员'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {usersMessage && (
          <div className="mt-3 text-xs" style={{ color: usersMessage.startsWith('✅') ? 'var(--color-ks-success)' : 'var(--color-ks-error)' }}>
            {usersMessage}
          </div>
        )}
      </section>

      {/* ─── 兑换码管理 ─── */}
      <section className="rounded-xl p-5 mb-6" style={sectionCardStyle}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={sectionTitleStyle}>
            <span className="flex items-center gap-2">
              <Ticket size={14} style={{ color: 'var(--color-ks-primary)' }} />
              兑换码管理
            </span>
          </h2>
          <button
            onClick={loadRedeemCodes}
            className="p-1.5 rounded cursor-pointer hover:opacity-70"
            style={{ color: 'var(--color-ks-text-muted)' }}
            title="刷新"
          >
            <RefreshCw size={14} className={redeemCodesLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* 生成表单 */}
        <div
          className="rounded-lg p-4 mb-4"
          style={{ backgroundColor: 'var(--color-ks-bg)', border: '1px solid var(--color-ks-border)' }}
        >
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label style={labelStyle}>积分数量</label>
              <input
                type="number"
                min="1"
                value={redeemForm.points}
                onChange={(e) => setRedeemForm({ ...redeemForm, points: parseInt(e.target.value) || 0 })}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>生成数量</label>
              <input
                type="number"
                min="1"
                max="100"
                value={redeemForm.count}
                onChange={(e) => setRedeemForm({ ...redeemForm, count: parseInt(e.target.value) || 1 })}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>过期天数</label>
              <input
                type="number"
                min="1"
                value={redeemForm.expire_days}
                onChange={(e) => setRedeemForm({ ...redeemForm, expire_days: parseInt(e.target.value) || 1 })}
                style={inputStyle}
              />
            </div>
          </div>
          <button
            onClick={generateRedeemCodes}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer"
            style={{ backgroundColor: 'var(--color-ks-primary)', color: '#fff', border: 'none' }}
          >
            <Plus size={12} />
            生成兑换码
          </button>
        </div>

        {/* 已生成的兑换码列表 */}
        {redeemCodesLoading && redeemCodes.length === 0 ? (
          <div className="flex justify-center py-6" style={{ color: 'var(--color-ks-text-muted)' }}>
            <RefreshCw size={16} className="animate-spin" />
          </div>
        ) : redeemCodes.length === 0 ? (
          <div className="text-xs py-4 text-center" style={{ color: 'var(--color-ks-text-muted)' }}>
            暂无兑换码
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ color: 'var(--color-ks-text)' }}>
              <thead>
                <tr style={{ color: 'var(--color-ks-text-muted)', borderBottom: '1px solid var(--color-ks-border)' }}>
                  <th className="text-left py-2 pr-3 font-medium">兑换码</th>
                  <th className="text-left py-2 pr-3 font-medium">积分</th>
                  <th className="text-left py-2 pr-3 font-medium">状态</th>
                  <th className="text-left py-2 pr-3 font-medium">过期时间</th>
                  <th className="text-right py-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {redeemCodes.map((rc) => (
                  <tr key={rc.id} style={{ borderBottom: '1px solid var(--color-ks-border)' }}>
                    <td className="py-2.5 pr-3">
                      <code
                        className="px-1.5 py-0.5 rounded text-[10px]"
                        style={{
                          backgroundColor: 'var(--color-ks-bg)',
                          fontFamily: 'var(--font-family-ks-mono)',
                          color: 'var(--color-ks-text)',
                          border: '1px solid var(--color-ks-border)',
                        }}
                      >
                        {rc.code}
                      </code>
                    </td>
                    <td className="py-2.5 pr-3 font-medium">{rc.points}</td>
                    <td className="py-2.5 pr-3">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={{
                          backgroundColor: rc.is_used ? 'rgba(194, 69, 61, 0.1)' : 'rgba(125, 155, 109, 0.1)',
                          color: rc.is_used ? 'var(--color-ks-error)' : 'var(--color-ks-success)',
                        }}
                      >
                        {rc.is_used ? '已使用' : '未使用'}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3" style={{ color: 'var(--color-ks-text-secondary)' }}>
                      {new Date(rc.expires_at).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => copyCode(rc.code)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] cursor-pointer hover:opacity-70"
                        style={{
                          backgroundColor: 'var(--color-ks-bg)',
                          color: copiedCode === rc.code ? 'var(--color-ks-success)' : 'var(--color-ks-text-secondary)',
                          border: '1px solid var(--color-ks-border)',
                        }}
                      >
                        {copiedCode === rc.code ? <Check size={10} /> : <Copy size={10} />}
                        {copiedCode === rc.code ? '已复制' : '复制'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {redeemMessage && (
          <div className="mt-3 text-xs" style={{ color: redeemMessage.startsWith('✅') ? 'var(--color-ks-success)' : 'var(--color-ks-error)' }}>
            {redeemMessage}
          </div>
        )}
      </section>

      {/* ─── 系统设置 ─── */}
      <section className="rounded-xl p-5 mb-6" style={sectionCardStyle}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={sectionTitleStyle}>
            <span className="flex items-center gap-2">
              <Settings size={14} style={{ color: 'var(--color-ks-primary)' }} />
              系统设置
            </span>
          </h2>
        </div>

        {settingsLoading ? (
          <div className="flex justify-center py-6" style={{ color: 'var(--color-ks-text-muted)' }}>
            <RefreshCw size={16} className="animate-spin" />
          </div>
        ) : !systemSettings ? (
          <div className="text-xs py-4 text-center" style={{ color: 'var(--color-ks-text-muted)' }}>
            暂无数据
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <label style={labelStyle}>
                <span className="flex items-center gap-1">
                  <Award size={11} />
                  积分兑换比例（1元 = ? 积分）
                </span>
              </label>
              <input
                type="number"
                min="1"
                value={systemSettings.points_per_yuan}
                onChange={(e) => setSystemSettings({ ...systemSettings, points_per_yuan: parseInt(e.target.value) || 1 })}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>滚动公告</label>
              <textarea
                rows={3}
                value={systemSettings.scroll_announcement}
                onChange={(e) => setSystemSettings({ ...systemSettings, scroll_announcement: e.target.value })}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                placeholder="输入滚动公告内容..."
              />
            </div>

            <div>
              <label style={labelStyle}>弹窗公告</label>
              <textarea
                rows={3}
                value={systemSettings.modal_announcement}
                onChange={(e) => setSystemSettings({ ...systemSettings, modal_announcement: e.target.value })}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                placeholder="输入弹窗公告内容..."
              />
            </div>

            <div>
              <label style={labelStyle}>轮播图 URL（用逗号分隔）</label>
              <textarea
                rows={2}
                value={systemSettings.carousel_urls}
                onChange={(e) => setSystemSettings({ ...systemSettings, carousel_urls: e.target.value })}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                placeholder="https://example.com/1.jpg, https://example.com/2.jpg"
              />
            </div>

            <div>
              <label style={labelStyle}>DeepSeek API Key</label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={systemSettings.deepseek_api_key}
                  onChange={(e) => setSystemSettings({ ...systemSettings, deepseek_api_key: e.target.value })}
                  style={{ ...inputStyle, paddingRight: '32px' }}
                  placeholder="sk-..."
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer"
                  style={{ color: 'var(--color-ks-text-muted)', background: 'none', border: 'none', padding: '2px' }}
                >
                  {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-1">
              <button
                onClick={saveSystemSettings}
                disabled={settingsSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-ks-primary)', color: '#fff', border: 'none' }}
              >
                <Save size={12} />
                {settingsSaving ? '保存中...' : '保存设置'}
              </button>
              {settingsMessage && (
                <span className="text-xs" style={{ color: settingsMessage.startsWith('✅') ? 'var(--color-ks-success)' : 'var(--color-ks-error)' }}>
                  {settingsMessage}
                </span>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ─── 积分转化设置 ─── */}
      <section className="rounded-xl p-5 mb-6" style={sectionCardStyle}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={sectionTitleStyle}>
            <span className="flex items-center gap-2">
              <Star size={14} style={{ color: 'var(--color-ks-primary)' }} />
              积分转化设置
            </span>
          </h2>
        </div>

        {pointsLoading ? (
          <div className="flex justify-center py-6" style={{ color: 'var(--color-ks-text-muted)' }}>
            <RefreshCw size={16} className="animate-spin" />
          </div>
        ) : !pointsConfig ? (
          <div className="text-xs py-4 text-center" style={{ color: 'var(--color-ks-text-muted)' }}>
            暂无数据
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label style={labelStyle}>
                  <span className="flex items-center gap-1">
                    <Star size={11} />
                    每日签到积分
                  </span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={pointsConfig.daily_checkin_points}
                  onChange={(e) => setPointsConfig({ ...pointsConfig, daily_checkin_points: parseInt(e.target.value) || 0 })}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>
                  <span className="flex items-center gap-1">
                    <MessageCircle size={11} />
                    评论奖励积分
                  </span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={pointsConfig.comment_reward_points}
                  onChange={(e) => setPointsConfig({ ...pointsConfig, comment_reward_points: parseInt(e.target.value) || 0 })}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>
                  <span className="flex items-center gap-1">
                    <ThumbsUp size={11} />
                    点赞奖励积分
                  </span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={pointsConfig.like_reward_points}
                  onChange={(e) => setPointsConfig({ ...pointsConfig, like_reward_points: parseInt(e.target.value) || 0 })}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>
                  <span className="flex items-center gap-1">
                    <Upload size={11} />
                    发布资源奖励积分
                  </span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={pointsConfig.upload_reward_points}
                  onChange={(e) => setPointsConfig({ ...pointsConfig, upload_reward_points: parseInt(e.target.value) || 0 })}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>
                  <span className="flex items-center gap-1">
                    <BookOpen size={11} />
                    阅读奖励积分
                  </span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={pointsConfig.read_reward_points}
                  onChange={(e) => setPointsConfig({ ...pointsConfig, read_reward_points: parseInt(e.target.value) || 0 })}
                  style={inputStyle}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-1">
              <button
                onClick={savePointsConfig}
                disabled={pointsSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-ks-primary)', color: '#fff', border: 'none' }}
              >
                <Save size={12} />
                {pointsSaving ? '保存中...' : '保存设置'}
              </button>
              {pointsMessage && (
                <span className="text-xs" style={{ color: pointsMessage.startsWith('✅') ? 'var(--color-ks-success)' : 'var(--color-ks-error)' }}>
                  {pointsMessage}
                </span>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
