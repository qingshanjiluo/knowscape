import { create } from 'zustand';
import { useToastStore } from '@/stores/toastStore';

export type AgentType = 'distill' | 'chat' | 'rag' | 'generate';

export interface LLMProvider {
  id: string;
  name: string;
  base_url: string;
  api_key: string;
  model: string;
  temperature: number;
  max_tokens: number;
}

export interface AgentProviderMapping {
  distill: string;
  chat: string;
  rag: string;
  generate: string;
}

export interface SettingsData {
  providers: LLMProvider[];
  default_provider_id: string;
  agent_mappings: AgentProviderMapping;
}

interface SettingsState {
  providers: LLMProvider[];
  defaultProviderId: string;
  agentMappings: AgentProviderMapping;
  isLoaded: boolean;
  isSaving: boolean;
  isTesting: Record<string, boolean>;

  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
  addProvider: () => void;
  updateProvider: (id: string, patch: Partial<Omit<LLMProvider, 'id'>>) => void;
  removeProvider: (id: string) => void;
  setDefaultProvider: (id: string) => void;
  setAgentMapping: (agent: AgentType, providerId: string) => void;
  testConnection: (id: string) => Promise<boolean>;
}

function generateId(): string {
  return `provider-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyProvider(): LLMProvider {
  return {
    id: generateId(),
    name: '新提供商',
    base_url: 'https://api.openai.com/v1',
    api_key: '',
    model: 'gpt-4o',
    temperature: 0.7,
    max_tokens: 4096,
  };
}

const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';

export const useSettingsStore = create<SettingsState>((set, get) => ({
  providers: [],
  defaultProviderId: '',
  agentMappings: { distill: '', chat: '', rag: '', generate: '' },
  isLoaded: false,
  isSaving: false,
  isTesting: {},

  loadSettings: async () => {
    try {
      const res = await fetch(`${API_BASE}/settings`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: SettingsData = await res.json();
      set({
        providers: data.providers || [],
        defaultProviderId: data.default_provider_id || '',
        agentMappings: data.agent_mappings || { distill: '', chat: '', rag: '', generate: '' },
        isLoaded: true,
      });
    } catch {
      set({ isLoaded: true });
    }
  },

  saveSettings: async () => {
    const { providers, defaultProviderId, agentMappings } = get();
    set({ isSaving: true });
    try {
      const payload: SettingsData = {
        providers,
        default_provider_id: defaultProviderId,
        agent_mappings: agentMappings,
      };
      const res = await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      useToastStore.getState().addToast('设置已保存', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      useToastStore.getState().addToast(`保存失败: ${msg}`, 'error', 5000);
    } finally {
      set({ isSaving: false });
    }
  },

  addProvider: () => {
    const provider = createEmptyProvider();
    set((s) => ({
      providers: [...s.providers, provider],
    }));
  },

  updateProvider: (id, patch) => {
    set((s) => ({
      providers: s.providers.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  },

  removeProvider: (id) => {
    set((s) => {
      const next = s.providers.filter((p) => p.id !== id);
      const nextDefault = s.defaultProviderId === id ? (next[0]?.id || '') : s.defaultProviderId;
      const nextMappings = { ...s.agentMappings };
      for (const key of ['distill', 'chat', 'rag', 'generate'] as AgentType[]) {
        if (nextMappings[key] === id) nextMappings[key] = nextDefault;
      }
      return { providers: next, defaultProviderId: nextDefault, agentMappings: nextMappings };
    });
  },

  setDefaultProvider: (id) => {
    set({ defaultProviderId: id });
  },

  setAgentMapping: (agent, providerId) => {
    set((s) => ({
      agentMappings: { ...s.agentMappings, [agent]: providerId },
    }));
  },

  testConnection: async (id) => {
    const provider = get().providers.find((p) => p.id === id);
    if (!provider) return false;

    set((s) => ({ isTesting: { ...s.isTesting, [id]: true } }));
    try {
      const res = await fetch(`${API_BASE}/settings/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_url: provider.base_url,
          api_key: provider.api_key,
          model: provider.model,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data.success === true;
    } catch {
      return false;
    } finally {
      set((s) => ({ isTesting: { ...s.isTesting, [id]: false } }));
    }
  },
}));
