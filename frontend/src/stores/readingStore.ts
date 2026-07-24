import { create } from 'zustand';

interface ReadingSettings {
  bgColor: string;
  bgPreset: string;
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  contentWidth: number;
  customFonts: { name: string; url: string }[];
}

interface ReadingState extends ReadingSettings {
  setBgColor: (color: string) => void;
  setBgPreset: (preset: string) => void;
  setFontSize: (size: number) => void;
  setFontFamily: (family: string) => void;
  setLineHeight: (h: number) => void;
  setContentWidth: (w: number) => void;
  addCustomFont: (name: string, url: string) => void;
  removeCustomFont: (name: string) => void;
  resetDefaults: () => void;
  loadSettings: () => void;
  saveSettings: () => void;
}

const BG_PRESETS: Record<string, { color: string; label: string }> = {
  white: { color: '#FFFFFF', label: '纯白' },
  warm: { color: '#FDF8F0', label: '暖白' },
  sepia: { color: '#F5ECD7', label: '护眼纸' },
  cream: { color: '#FAF6EE', label: '米色' },
  lightGray: { color: '#F3F4F6', label: '浅灰' },
  parchment: { color: '#F0EBE1', label: '羊皮纸' },
  mint: { color: '#F0FAF0', label: '薄荷绿' },
  lavender: { color: '#F3F0FA', label: '薰衣草' },
  pink: { color: '#FDF2F4', label: '樱花粉' },
  dark: { color: '#1A1A2E', label: '深色' },
  charcoal: { color: '#2D2D3D', label: '炭灰' },
  midnight: { color: '#0F0F1A', label: '午夜' },
};

const FONT_PRESETS: Record<string, { family: string; label: string }> = {
  serif: { family: "'Lora', 'Noto Serif SC', Georgia, serif", label: '衬线体' },
  sans: { family: "'Inter', -apple-system, 'PingFang SC', sans-serif", label: '无衬线' },
  song: { family: "'Noto Serif SC', 'SimSun', 'STSong', serif", label: '宋体' },
  kai: { family: "'KaiTi', 'STKaiti', 'AR PL UKai CN', serif", label: '楷体' },
  hei: { family: "'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif", label: '黑体' },
  mono: { family: "'JetBrains Mono', 'Fira Code', monospace", label: '等宽' },
  lxgw: { family: "'LXGW WenKai', '霞鹜文楷', sans-serif", label: '文楷' },
};

const DEFAULTS: ReadingSettings = {
  bgColor: '#FDF8F0',
  bgPreset: 'warm',
  fontSize: 16,
  fontFamily: "'Lora', 'Noto Serif SC', Georgia, serif",
  lineHeight: 1.8,
  contentWidth: 720,
  customFonts: [],
};

function loadFromStorage(): Partial<ReadingSettings> {
  try {
    const raw = localStorage.getItem('knowscape_reading_settings');
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function applyToDom(settings: ReadingSettings) {
  const root = document.documentElement;
  root.style.setProperty('--ks-reader-bg', settings.bgColor);
  root.style.setProperty('--ks-reader-font-size', settings.fontSize + 'px');
  root.style.setProperty('--ks-reader-font-family', settings.fontFamily);
  root.style.setProperty('--ks-reader-line-height', String(settings.lineHeight));
  root.style.setProperty('--ks-reader-content-width', settings.contentWidth + 'px');

  const isDark = ['#1A1A2E', '#2D2D3D', '#0F0F1A'].includes(settings.bgColor);
  root.style.setProperty('--ks-reader-text', isDark ? '#E0DDD8' : '#2C2825');
  root.style.setProperty('--ks-reader-text-secondary', isDark ? '#B0ADA8' : '#6B6560');
  root.style.setProperty('--ks-reader-text-muted', isDark ? '#808080' : '#999490');

  settings.customFonts.forEach(f => {
    if (!document.querySelector(`link[href="${f.url}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = f.url;
      document.head.appendChild(link);
    }
  });
}

export const BG_PRESETS_CONST = BG_PRESETS;
export const FONT_PRESETS_CONST = FONT_PRESETS;

export const useReadingStore = create<ReadingState>((set, get) => ({
  ...DEFAULTS,
  ...loadFromStorage(),

  setBgColor: (color) => { set({ bgColor: color, bgPreset: '' }); applyToDom({ ...get(), bgColor: color }); get().saveSettings(); },
  setBgPreset: (preset) => { const p = BG_PRESETS[preset]; if (p) { set({ bgColor: p.color, bgPreset: preset }); applyToDom({ ...get(), bgColor: p.color, bgPreset: preset }); get().saveSettings(); } },
  setFontSize: (size) => { set({ fontSize: size }); applyToDom({ ...get(), fontSize: size }); get().saveSettings(); },
  setFontFamily: (family) => { set({ fontFamily: family }); applyToDom({ ...get(), fontFamily: family }); get().saveSettings(); },
  setLineHeight: (h) => { set({ lineHeight: h }); applyToDom({ ...get(), lineHeight: h }); get().saveSettings(); },
  setContentWidth: (w) => { set({ contentWidth: w }); applyToDom({ ...get(), contentWidth: w }); get().saveSettings(); },

  addCustomFont: (name, url) => {
    const fonts = [...get().customFonts, { name, url }];
    set({ customFonts: fonts });
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    document.head.appendChild(link);
    get().saveSettings();
  },

  removeCustomFont: (name) => {
    const fonts = get().customFonts.filter(f => f.name !== name);
    set({ customFonts: fonts });
    get().saveSettings();
  },

  resetDefaults: () => { set(DEFAULTS); applyToDom(DEFAULTS); get().saveSettings(); },

  loadSettings: () => {
    const stored = loadFromStorage();
    const settings = { ...DEFAULTS, ...stored };
    set(settings);
    applyToDom(settings);
  },

  saveSettings: () => {
    const s = get();
    const data: ReadingSettings = { bgColor: s.bgColor, bgPreset: s.bgPreset, fontSize: s.fontSize, fontFamily: s.fontFamily, lineHeight: s.lineHeight, contentWidth: s.contentWidth, customFonts: s.customFonts };
    localStorage.setItem('knowscape_reading_settings', JSON.stringify(data));
  },
}));
