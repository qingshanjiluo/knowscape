import { useState, useRef } from 'react';
import { Palette, Type, Upload, X, RotateCcw, Minus, Plus, Check } from 'lucide-react';
import { useReadingStore, BG_PRESETS_CONST, FONT_PRESETS_CONST } from '@/stores/readingStore';

const FONT_SIZES = [12, 14, 15, 16, 17, 18, 20, 22, 24, 28];
const LINE_HEIGHTS = [1.4, 1.6, 1.8, 2.0, 2.2, 2.5];
const CONTENT_WIDTHS = [560, 640, 720, 800, 880, 960];

interface ReadingSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ReadingSettingsPanel({ isOpen, onClose }: ReadingSettingsPanelProps) {
  const store = useReadingStore();
  const [customFontName, setCustomFontName] = useState('');
  const [customFontUrl, setCustomFontUrl] = useState('');
  const [showCustomFont, setShowCustomFont] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  async function handleFontUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('font', file);
    formData.append('name', file.name.replace(/\.[^.]+$/, ''));
    try {
      const resp = await fetch('/api/v1/upload-font', { method: 'POST', body: formData });
      const data = await resp.json();
      if (data.url) {
        store.addCustomFont(data.name || file.name, data.url);
      }
    } catch {}
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }} onClick={onClose}>
      <div className="w-96 max-h-[85vh] rounded-xl shadow-xl overflow-hidden flex flex-col" style={{ backgroundColor: 'var(--color-ks-card)', border: '1px solid var(--color-ks-border)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--color-ks-border)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--color-ks-text)' }}>阅读设置</span>
          <button onClick={onClose} className="p-1 rounded cursor-pointer" style={{ color: 'var(--color-ks-text-muted)' }}><X size={14} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Palette size={12} style={{ color: 'var(--color-ks-primary)' }} />
              <span className="text-[11px] font-medium" style={{ color: 'var(--color-ks-text)' }}>背景色</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {Object.entries(BG_PRESETS_CONST).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => store.setBgPreset(key)}
                  className="flex flex-col items-center gap-1 px-1 py-2 rounded-lg text-[9px] cursor-pointer transition-all"
                  style={{
                    border: `2px solid ${store.bgPreset === key ? 'var(--color-ks-primary)' : 'transparent'}`,
                    backgroundColor: 'var(--color-ks-hover)',
                  }}
                >
                  <div className="w-6 h-6 rounded-full border" style={{ backgroundColor: preset.color, borderColor: '#E8E6E3' }} />
                  <span style={{ color: 'var(--color-ks-text-muted)' }}>{preset.label}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px]" style={{ color: 'var(--color-ks-text-muted)' }}>自定义:</span>
              <input type="color" value={store.bgColor} onChange={(e) => store.setBgColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0" />
              <span className="text-[10px] font-mono" style={{ color: 'var(--color-ks-text-muted)' }}>{store.bgColor}</span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Type size={12} style={{ color: 'var(--color-ks-primary)' }} />
              <span className="text-[11px] font-medium" style={{ color: 'var(--color-ks-text)' }}>字体</span>
            </div>
            <div className="space-y-1">
              {Object.entries(FONT_PRESETS_CONST).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => store.setFontFamily(preset.family)}
                  className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded text-[11px] cursor-pointer"
                  style={{
                    backgroundColor: store.fontFamily === preset.family ? 'var(--color-ks-primary)' : 'var(--color-ks-hover)',
                    color: store.fontFamily === preset.family ? 'white' : 'var(--color-ks-text-secondary)',
                    border: `1px solid ${store.fontFamily === preset.family ? 'var(--color-ks-primary)' : 'var(--color-ks-border)'}`,
                    fontFamily: preset.family,
                  }}
                >
                  {store.fontFamily === preset.family && <Check size={10} />}
                  {preset.label}
                </button>
              ))}
              {store.customFonts.map(f => (
                <button
                  key={f.name}
                  onClick={() => store.setFontFamily(`'${f.name}', ${store.fontFamily}`)}
                  className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded text-[11px] cursor-pointer"
                  style={{
                    backgroundColor: store.fontFamily.includes(f.name) ? 'var(--color-ks-primary)' : 'var(--color-ks-hover)',
                    color: store.fontFamily.includes(f.name) ? 'white' : 'var(--color-ks-text-secondary)',
                    border: `1px solid ${store.fontFamily.includes(f.name) ? 'var(--color-ks-primary)' : 'var(--color-ks-border)'}`,
                    fontFamily: `'${f.name}', sans-serif`,
                  }}
                >
                  {store.fontFamily.includes(f.name) && <Check size={10} />}
                  {f.name}
                  <button onClick={(e) => { e.stopPropagation(); store.removeCustomFont(f.name); }} className="ml-auto p-0.5" style={{ color: store.fontFamily.includes(f.name) ? 'white' : '#ef4444' }}>
                    <X size={10} />
                  </button>
                </button>
              ))}
            </div>

            <div className="mt-2 space-y-1.5">
              <button onClick={() => setShowCustomFont(!showCustomFont)} className="flex items-center gap-1.5 text-[10px] cursor-pointer" style={{ color: 'var(--color-ks-primary)' }}>
                <Upload size={10} />
                {showCustomFont ? '收起' : '添加自定义字体'}
              </button>
              {showCustomFont && (
                <div className="space-y-1.5 p-2 rounded" style={{ backgroundColor: 'var(--color-ks-hover)', border: '1px solid var(--color-ks-border)' }}>
                  <input type="text" value={customFontName} onChange={(e) => setCustomFontName(e.target.value)} placeholder="字体名称"
                    className="w-full text-[10px] px-2 py-1 rounded outline-none" style={{ backgroundColor: 'var(--color-ks-bg)', color: 'var(--color-ks-text)', border: '1px solid var(--color-ks-border)' }} />
                  <input type="text" value={customFontUrl} onChange={(e) => setCustomFontUrl(e.target.value)} placeholder="字体 URL (Google Fonts 等)"
                    className="w-full text-[10px] px-2 py-1 rounded outline-none" style={{ backgroundColor: 'var(--color-ks-bg)', color: 'var(--color-ks-text)', border: '1px solid var(--color-ks-border)' }} />
                  <div className="flex gap-1.5">
                    <button onClick={() => { if (customFontName && customFontUrl) { store.addCustomFont(customFontName, customFontUrl); setCustomFontName(''); setCustomFontUrl(''); } }}
                      className="flex-1 text-[10px] px-2 py-1 rounded text-white cursor-pointer" style={{ backgroundColor: 'var(--color-ks-primary)' }}>
                      添加 URL
                    </button>
                    <button onClick={() => fileInputRef.current?.click()}
                      className="flex-1 text-[10px] px-2 py-1 rounded cursor-pointer" style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-text-secondary)', border: '1px solid var(--color-ks-border)' }}>
                      上传字体文件
                    </button>
                  </div>
                  <input ref={fileInputRef} type="file" accept=".ttf,.otf,.woff,.woff2" onChange={handleFontUpload} className="hidden" />
                  <p className="text-[9px]" style={{ color: 'var(--color-ks-text-disabled)' }}>
                    支持 Google Fonts 链接或本地 .ttf/.otf/.woff/.woff2 文件
                  </p>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium" style={{ color: 'var(--color-ks-text)' }}>字号</span>
              <span className="text-[10px] font-mono" style={{ color: 'var(--color-ks-primary)' }}>{store.fontSize}px</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => store.setFontSize(Math.max(12, store.fontSize - 1))} className="p-1 rounded cursor-pointer" style={{ color: 'var(--color-ks-text-muted)' }}><Minus size={12} /></button>
              <input type="range" min={12} max={28} value={store.fontSize} onChange={(e) => store.setFontSize(Number(e.target.value))}
                className="flex-1 h-1 rounded-lg appearance-none cursor-pointer" style={{ backgroundColor: 'var(--color-ks-border)', accentColor: 'var(--color-ks-primary)' }} />
              <button onClick={() => store.setFontSize(Math.min(28, store.fontSize + 1))} className="p-1 rounded cursor-pointer" style={{ color: 'var(--color-ks-text-muted)' }}><Plus size={12} /></button>
            </div>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {FONT_SIZES.map(s => (
                <button key={s} onClick={() => store.setFontSize(s)}
                  className="px-1.5 py-0.5 rounded text-[9px] cursor-pointer"
                  style={{ backgroundColor: store.fontSize === s ? 'var(--color-ks-primary)' : 'var(--color-ks-hover)', color: store.fontSize === s ? 'white' : 'var(--color-ks-text-muted)' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium" style={{ color: 'var(--color-ks-text)' }}>行间距</span>
              <span className="text-[10px] font-mono" style={{ color: 'var(--color-ks-primary)' }}>{store.lineHeight}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {LINE_HEIGHTS.map(h => (
                <button key={h} onClick={() => store.setLineHeight(h)}
                  className="px-2 py-0.5 rounded text-[9px] cursor-pointer"
                  style={{ backgroundColor: store.lineHeight === h ? 'var(--color-ks-primary)' : 'var(--color-ks-hover)', color: store.lineHeight === h ? 'white' : 'var(--color-ks-text-muted)' }}>
                  {h}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium" style={{ color: 'var(--color-ks-text)' }}>内容宽度</span>
              <span className="text-[10px] font-mono" style={{ color: 'var(--color-ks-primary)' }}>{store.contentWidth}px</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {CONTENT_WIDTHS.map(w => (
                <button key={w} onClick={() => store.setContentWidth(w)}
                  className="px-2 py-0.5 rounded text-[9px] cursor-pointer"
                  style={{ backgroundColor: store.contentWidth === w ? 'var(--color-ks-primary)' : 'var(--color-ks-hover)', color: store.contentWidth === w ? 'white' : 'var(--color-ks-text-muted)' }}>
                  {w}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid var(--color-ks-border)' }}>
            <button onClick={store.resetDefaults} className="flex items-center gap-1 px-3 py-1.5 rounded text-[10px] cursor-pointer"
              style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-text-muted)', border: '1px solid var(--color-ks-border)' }}>
              <RotateCcw size={10} /> 恢复默认
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
