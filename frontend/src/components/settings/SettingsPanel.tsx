import { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader,
  Eye,
  EyeOff,
  Zap,
  Settings,
  Bot,
  FlaskConical,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { useUIStore } from '@/stores/uiStore';
import { useSettingsStore, type AgentType } from '@/stores/settingsStore';

const AGENT_META: Record<AgentType, { label: string; icon: typeof Bot; description: string }> = {
  distill: { label: '蒸馏', icon: FlaskConical, description: '知识蒸馏智能体' },
  chat: { label: '对话', icon: MessageSquare, description: 'RAG 对话智能体' },
  rag: { label: '检索', icon: Zap, description: '向量检索智能体' },
  generate: { label: '生成', icon: Sparkles, description: '深度生成智能体' },
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="block text-xs font-medium mb-1.5 font-[var(--font-family-ks-heading)]"
      style={{ color: 'var(--color-ks-text-secondary)' }}
    >
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-8 px-2.5 text-xs rounded-[var(--radius-ks-sm)] outline-none transition-colors duration-150"
      style={{
        backgroundColor: 'var(--color-ks-bg)',
        border: '1px solid var(--color-ks-border)',
        color: 'var(--color-ks-text)',
        fontFamily: 'var(--font-family-ks-heading)',
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-ks-primary)'; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-ks-border)'; }}
    />
  );
}

function RangeInput({
  value,
  onChange,
  min,
  max,
  step,
  displayValue,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  displayValue: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, var(--color-ks-primary) 0%, var(--color-ks-primary) ${((value - min) / (max - min)) * 100}%, var(--color-ks-border) ${((value - min) / (max - min)) * 100}%, var(--color-ks-border) 100%)`,
        }}
      />
      <span
        className="text-xs font-mono tabular-nums w-10 text-right shrink-0"
        style={{ color: 'var(--color-ks-text-secondary)' }}
      >
        {displayValue}
      </span>
    </div>
  );
}

export default function SettingsPanel() {
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);

  const providers = useSettingsStore((s) => s.providers);
  const defaultProviderId = useSettingsStore((s) => s.defaultProviderId);
  const agentMappings = useSettingsStore((s) => s.agentMappings);
  const isLoaded = useSettingsStore((s) => s.isLoaded);
  const isSaving = useSettingsStore((s) => s.isSaving);
  const isTesting = useSettingsStore((s) => s.isTesting);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const saveSettings = useSettingsStore((s) => s.saveSettings);
  const addProvider = useSettingsStore((s) => s.addProvider);
  const updateProvider = useSettingsStore((s) => s.updateProvider);
  const removeProvider = useSettingsStore((s) => s.removeProvider);
  const setDefaultProvider = useSettingsStore((s) => s.setDefaultProvider);
  const setAgentMapping = useSettingsStore((s) => s.setAgentMapping);
  const testConnection = useSettingsStore((s) => s.testConnection);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  const [testResult, setTestResult] = useState<Record<string, boolean | null>>({});

  useEffect(() => {
    if (settingsOpen && !isLoaded) {
      loadSettings();
    }
  }, [settingsOpen, isLoaded, loadSettings]);

  useEffect(() => {
    if (settingsOpen && providers.length > 0 && !selectedId) {
      setSelectedId(providers[0].id);
    }
  }, [settingsOpen, providers, selectedId]);

  useEffect(() => {
    if (!settingsOpen) {
      setSelectedId(null);
      setTestResult({});
      setShowApiKey({});
    }
  }, [settingsOpen]);

  const selectedProvider = providers.find((p) => p.id === selectedId) ?? null;

  const handleTest = useCallback(async (id: string) => {
    setTestResult((prev) => ({ ...prev, [id]: null }));
    const ok = await testConnection(id);
    setTestResult((prev) => ({ ...prev, [id]: ok }));
    if (ok) {
      setTimeout(() => setTestResult((prev) => ({ ...prev, [id]: null })), 2000);
    }
  }, [testConnection]);

  const handleClose = useCallback(() => {
    setSettingsOpen(false);
  }, [setSettingsOpen]);

  const handleSave = useCallback(async () => {
    await saveSettings();
    setSettingsOpen(false);
  }, [saveSettings, setSettingsOpen]);

  const toggleApiKey = useCallback((id: string) => {
    setShowApiKey((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  return (
    <Modal isOpen={settingsOpen} onClose={handleClose} title="设置" size="lg">
      {!isLoaded ? (
        <div className="flex items-center justify-center py-12">
          <Loader
            size={20}
            className="ks-animate-spin"
            style={{ color: 'var(--color-ks-text-muted)' }}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* ─── Providers Section ─── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h4
                className="text-xs font-semibold font-[var(--font-family-ks-heading)]"
                style={{ color: 'var(--color-ks-text)' }}
              >
                LLM 提供商
              </h4>
              <Button
                variant="ghost"
                size="sm"
                icon={<Plus size={12} />}
                onClick={addProvider}
              >
                添加
              </Button>
            </div>

            {providers.length === 0 ? (
              <div
                className="text-center py-6 text-xs rounded-[var(--radius-ks-md)]"
                style={{
                  color: 'var(--color-ks-text-muted)',
                  backgroundColor: 'var(--color-ks-bg)',
                  border: '1px dashed var(--color-ks-border)',
                }}
              >
                暂无提供商，点击「添加」开始配置
              </div>
            ) : (
              <div className="flex gap-3">
                {/* Provider list (left) */}
                <div
                  className="w-[160px] shrink-0 rounded-[var(--radius-ks-md)] overflow-hidden"
                  style={{
                    backgroundColor: 'var(--color-ks-bg)',
                    border: '1px solid var(--color-ks-border)',
                  }}
                >
                  <div className="p-1.5 space-y-0.5">
                    {providers.map((p) => {
                      const isSelected = p.id === selectedId;
                      const isDefault = p.id === defaultProviderId;
                      return (
                        <button
                          key={p.id}
                          onClick={() => setSelectedId(p.id)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-[var(--radius-ks-sm)] text-left cursor-pointer transition-colors duration-100"
                          style={{
                            backgroundColor: isSelected ? 'var(--color-ks-hover)' : 'transparent',
                          }}
                        >
                          <span
                            className="text-xs font-medium truncate flex-1"
                            style={{
                              color: isSelected ? 'var(--color-ks-primary)' : 'var(--color-ks-text-secondary)',
                              fontFamily: 'var(--font-family-ks-heading)',
                            }}
                          >
                            {p.name || '未命名'}
                          </span>
                          {isDefault && (
                            <span
                              className="text-[9px] px-1 py-px rounded-full shrink-0"
                              style={{
                                backgroundColor: 'var(--color-ks-primary)',
                                color: 'white',
                              }}
                            >
                              默认
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Provider editor (right) */}
                {selectedProvider ? (
                  <div className="flex-1 min-w-0 space-y-3">
                    {/* Name + Default */}
                    <div className="flex items-end gap-3">
                      <div className="flex-1 min-w-0">
                        <Label>名称</Label>
                        <Input
                          value={selectedProvider.name}
                          onChange={(v) => updateProvider(selectedProvider.id, { name: v })}
                          placeholder="例如: OpenAI"
                        />
                      </div>
                      <button
                        onClick={() => setDefaultProvider(selectedProvider.id)}
                        className="shrink-0 flex items-center gap-1.5 h-8 px-3 text-xs rounded-[var(--radius-ks-sm)] cursor-pointer transition-colors duration-150 font-[var(--font-family-ks-heading)]"
                        style={{
                          backgroundColor: defaultProviderId === selectedProvider.id ? 'var(--color-ks-primary)' : 'var(--color-ks-bg)',
                          color: defaultProviderId === selectedProvider.id ? 'white' : 'var(--color-ks-text-secondary)',
                          border: `1px solid ${defaultProviderId === selectedProvider.id ? 'var(--color-ks-primary)' : 'var(--color-ks-border)'}`,
                        }}
                      >
                        <Settings size={11} />
                        {defaultProviderId === selectedProvider.id ? '默认' : '设为默认'}
                      </button>
                    </div>

                    {/* Base URL */}
                    <div>
                      <Label>Base URL</Label>
                      <Input
                        value={selectedProvider.base_url}
                        onChange={(v) => updateProvider(selectedProvider.id, { base_url: v })}
                        placeholder="https://api.openai.com/v1"
                      />
                    </div>

                    {/* API Key */}
                    <div>
                      <Label>API Key</Label>
                      <div className="relative">
                        <Input
                          value={selectedProvider.api_key}
                          onChange={(v) => updateProvider(selectedProvider.id, { api_key: v })}
                          type={showApiKey[selectedProvider.id] ? 'text' : 'password'}
                          placeholder="sk-..."
                        />
                        <button
                          onClick={() => toggleApiKey(selectedProvider.id)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 cursor-pointer transition-opacity hover:opacity-70"
                          style={{ color: 'var(--color-ks-text-muted)' }}
                          tabIndex={-1}
                        >
                          {showApiKey[selectedProvider.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      </div>
                    </div>

                    {/* Model */}
                    <div>
                      <Label>模型</Label>
                      <Input
                        value={selectedProvider.model}
                        onChange={(v) => updateProvider(selectedProvider.id, { model: v })}
                        placeholder="gpt-4o"
                      />
                    </div>

                    {/* Temperature + Max Tokens */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Temperature: {selectedProvider.temperature.toFixed(1)}</Label>
                        <RangeInput
                          value={selectedProvider.temperature}
                          onChange={(v) => updateProvider(selectedProvider.id, { temperature: v })}
                          min={0}
                          max={2}
                          step={0.1}
                          displayValue={selectedProvider.temperature.toFixed(1)}
                        />
                      </div>
                      <div>
                        <Label>Max Tokens</Label>
                        <Input
                          value={String(selectedProvider.max_tokens)}
                          onChange={(v) => {
                            const n = parseInt(v, 10);
                            if (!isNaN(n) && n > 0) updateProvider(selectedProvider.id, { max_tokens: n });
                          }}
                          placeholder="4096"
                        />
                      </div>
                    </div>

                    {/* Test + Delete */}
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<Zap size={12} />}
                        loading={isTesting[selectedProvider.id] === true}
                        onClick={() => handleTest(selectedProvider.id)}
                      >
                        {testResult[selectedProvider.id] === null
                          ? '测试中...'
                          : testResult[selectedProvider.id] === true
                            ? '连接成功'
                            : testResult[selectedProvider.id] === false
                              ? '连接失败'
                              : '测试连接'}
                      </Button>

                      {testResult[selectedProvider.id] === true && (
                        <CheckCircle2 size={14} style={{ color: 'var(--color-ks-success)' }} />
                      )}
                      {testResult[selectedProvider.id] === false && (
                        <AlertCircle size={14} style={{ color: 'var(--color-ks-error)' }} />
                      )}

                      <div className="flex-1" />

                      <Button
                        variant="danger"
                        size="sm"
                        icon={<Trash2 size={12} />}
                        onClick={() => {
                          removeProvider(selectedProvider.id);
                          setSelectedId(providers.find((p) => p.id !== selectedProvider.id)?.id ?? null);
                        }}
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="flex-1 flex items-center justify-center text-xs rounded-[var(--radius-ks-md)]"
                    style={{
                      color: 'var(--color-ks-text-muted)',
                      backgroundColor: 'var(--color-ks-bg)',
                      border: '1px dashed var(--color-ks-border)',
                    }}
                  >
                    选择一个提供商进行编辑
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ─── Agent Mapping Section ─── */}
          <section
            className="rounded-[var(--radius-ks-md)] p-4"
            style={{
              backgroundColor: 'var(--color-ks-bg)',
              border: '1px solid var(--color-ks-border)',
            }}
          >
            <h4
              className="text-xs font-semibold font-[var(--font-family-ks-heading)] mb-3"
              style={{ color: 'var(--color-ks-text)' }}
            >
              智能体提供商映射
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(AGENT_META) as AgentType[]).map((agentType) => {
                const meta = AGENT_META[agentType];
                const Icon = meta.icon;
                const currentMapping = agentMappings[agentType];
                return (
                  <div
                    key={agentType}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-[var(--radius-ks-sm)]"
                    style={{
                      backgroundColor: 'var(--color-ks-card)',
                      border: '1px solid var(--color-ks-border)',
                    }}
                  >
                    <Icon size={14} style={{ color: 'var(--color-ks-primary)' }} className="shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-[11px] font-medium font-[var(--font-family-ks-heading)] truncate"
                        style={{ color: 'var(--color-ks-text)' }}
                      >
                        {meta.label}
                      </div>
                      <div
                        className="text-[10px] truncate"
                        style={{ color: 'var(--color-ks-text-muted)' }}
                      >
                        {meta.description}
                      </div>
                    </div>
                    <select
                      value={currentMapping}
                      onChange={(e) => setAgentMapping(agentType, e.target.value)}
                      className="h-7 px-1.5 text-[11px] rounded-[var(--radius-ks-sm)] outline-none cursor-pointer shrink-0 appearance-none"
                      style={{
                        backgroundColor: 'var(--color-ks-bg)',
                        border: '1px solid var(--color-ks-border)',
                        color: 'var(--color-ks-text-secondary)',
                        fontFamily: 'var(--font-family-ks-heading)',
                        minWidth: 80,
                      }}
                    >
                      <option value="">默认</option>
                      {providers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ─── Footer ─── */}
          <div
            className="flex items-center justify-end gap-2 pt-2"
            style={{ borderTop: '1px solid var(--color-ks-border)' }}
          >
            <Button variant="secondary" size="md" onClick={handleClose}>
              取消
            </Button>
            <Button variant="primary" size="md" loading={isSaving} onClick={handleSave}>
              {isSaving ? '保存中...' : '保存'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
