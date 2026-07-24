import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Save, Plus, Trash2, RefreshCw } from 'lucide-react';
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

export default function AdminPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [config, setConfig] = useState<LLMConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!user || !user.is_admin) {
      navigate('/');
      return;
    }
    loadConfig();
  }, [user, navigate]);

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

      <section className="rounded-xl p-5 mb-6" style={{ backgroundColor: 'var(--color-ks-card)', border: '1px solid var(--color-ks-border)' }}>
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-ks-text)', fontFamily: 'var(--font-family-ks-heading)' }}>
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

      <section className="rounded-xl p-5 mb-6" style={{ backgroundColor: 'var(--color-ks-card)', border: '1px solid var(--color-ks-border)' }}>
        <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-ks-text)', fontFamily: 'var(--font-family-ks-heading)' }}>
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

      <div className="flex items-center gap-3">
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
    </div>
  );
}
