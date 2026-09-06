import { useState, useEffect, useRef, useMemo } from 'react';
import {
  HANDWRITING_FONTS,
  ensureFontLoaded,
  calculateTextLayout,
  drawHandwrittenText,
  rasterizeHandwritingToImage
} from '@/lib/handwritingRenderer';
import { isLikelyCode, generateSyntaxCharColors } from '@/lib/syntaxHighlighter';
import { AlignLeft, AlignCenter, AlignRight, Sparkles, Wand2, Layers, X, SlidersHorizontal, Code, FileText, Check } from 'lucide-react';

export default function HandwritingModal({
  isOpen,
  onClose,
  initialText = '',
  onInsertEditable,
  onInsertRasterized,
}) {
  const [text, setText] = useState(initialText || '');
  const [contentType, setContentType] = useState('text'); // 'text' (Normal) | 'code' (Syntax)
  const [fontFamily, setFontFamily] = useState('Caveat');
  const [fontSize, setFontSize] = useState(24);
  const [color, setColor] = useState('#111111');
  const [align, setAlign] = useState('left');
  const [maxWidth, setMaxWidth] = useState(540);
  const [jitter, setJitter] = useState(0.35);
  const [isLoading, setIsLoading] = useState(false);
  const previewCanvasRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      const raw = initialText || '';
      setText(raw);
      const isCode = isLikelyCode(raw);
      if (isCode) {
        setContentType('code');
        setFontFamily('JetBrains Mono');
        setJitter(0);
        setFontSize(20);
      } else {
        setContentType('text');
        setFontFamily('Caveat');
        setJitter(0.35);
        setFontSize(24);
      }
    }
  }, [isOpen, initialText]);

  const isCodeMode = contentType === 'code';

  // Compute character syntax colors & styles ONLY if in Code Mode
  const { charColors, charStyles } = useMemo(() => {
    if (!isCodeMode) return { charColors: {}, charStyles: {} };
    return generateSyntaxCharColors(text, 'light');
  }, [text, isCodeMode]);

  // Update canvas preview
  useEffect(() => {
    let cancelled = false;

    async function renderPreview() {
      if (!isOpen || !text.trim() || !previewCanvasRef.current) return;
      setIsLoading(true);
      await ensureFontLoaded(fontFamily, '600', `${fontSize}px`);
      if (cancelled) return;
      setIsLoading(false);

      const canvas = previewCanvasRef.current;
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 2;

      const layout = calculateTextLayout(ctx, text, maxWidth, fontSize, fontFamily);
      const pad = 16;
      const displayW = layout.width + pad * 2;
      const displayH = layout.height + pad * 2;

      canvas.width = Math.ceil(displayW * dpr);
      canvas.height = Math.ceil(displayH * dpr);
      canvas.style.width = `${displayW}px`;
      canvas.style.height = `${displayH}px`;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      drawHandwrittenText(ctx, {
        lines: layout.lines,
        lineHeight: layout.lineHeight,
        fontSize,
        fontFamily,
        color,
        align,
        x: pad,
        y: pad,
        width: layout.width,
        jitter: isCodeMode ? 0 : jitter,
        charColors,
        charStyles,
      });
      ctx.restore();
    }

    renderPreview();
    return () => { cancelled = true; };
  }, [isOpen, text, fontFamily, fontSize, color, align, maxWidth, jitter, isCodeMode, charColors, charStyles]);

  if (!isOpen) return null;

  const handleSelectContentType = (type) => {
    setContentType(type);
    if (type === 'code') {
      setFontFamily('JetBrains Mono');
      setJitter(0);
      setFontSize(20);
    } else {
      setFontFamily('Caveat');
      setJitter(0.35);
      setFontSize(24);
    }
  };

  const handleInsertEditable = async () => {
    await ensureFontLoaded(fontFamily, '600', `${fontSize}px`);
    const offscreen = document.createElement('canvas');
    const ctx = offscreen.getContext('2d');
    const layout = calculateTextLayout(ctx, text, maxWidth, fontSize, fontFamily);

    onInsertEditable?.({
      type: 'handwriting',
      text,
      fontFamily,
      fontSize,
      color,
      align,
      maxWidth,
      width: layout.width,
      height: layout.height,
      jitter: isCodeMode ? 0 : jitter,
      isCode: isCodeMode,
      charColors: isCodeMode ? charColors : {},
      charStyles: isCodeMode ? charStyles : {},
    });
    onClose();
  };

  const handleInsertRasterized = async () => {
    setIsLoading(true);
    const result = await rasterizeHandwritingToImage({
      text,
      fontFamily,
      fontSize,
      color,
      align,
      maxWidth,
      jitter: isCodeMode ? 0 : jitter,
      charColors: isCodeMode ? charColors : {},
      charStyles: isCodeMode ? charStyles : {},
    });
    setIsLoading(false);
    onInsertRasterized?.({
      type: 'image',
      dataURL: result.dataURL,
      w: result.width,
      h: result.height,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-card text-card-foreground border border-border rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${isCodeMode ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'}`}>
              {isCodeMode ? <Code className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-display font-semibold text-base">
                {isCodeMode ? 'Convert Code to Canvas' : 'Convert Text to Handwriting'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {isCodeMode
                  ? 'Accurate IDE syntax highlighting with indentation preservation'
                  : 'Render notes into realistic handwritten strokes on canvas'}
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Controls */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          
          {/* Explicit Content Type Question Banner */}
          <div className="p-3.5 bg-muted/70 dark:bg-muted/40 rounded-xl border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <span>Content Type</span>
              </span>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isCodeMode
                  ? 'Code Snippet: Syntax tokens (keywords, types, literals) colored'
                  : 'Normal Text: Uniform ink color, natural handwriting drift'}
              </p>
            </div>

            <div className="flex items-center bg-background/90 p-1 rounded-xl border border-border shadow-xs self-start sm:self-auto">
              <button
                type="button"
                onClick={() => handleSelectContentType('text')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  !isCodeMode
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Normal Text</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectContentType('code')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isCodeMode
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                <span>Code Snippet</span>
                {isCodeMode && <Check className="w-3 h-3 ml-0.5" />}
              </button>
            </div>
          </div>

          {/* Text Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {isCodeMode ? 'Code Input' : 'Text Input'}
              </label>
              <span className="text-[11px] text-muted-foreground font-mono">
                {text.split('\n').length} lines · {text.length} chars
              </span>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={isCodeMode ? "Paste code here (e.g. class Solution { ... })..." : "Enter or paste normal text to convert..."}
              rows={5}
              spellCheck={!isCodeMode}
              className={`w-full text-sm p-3 rounded-xl border border-input bg-background/80 focus:outline-none focus:ring-2 focus:ring-amber-500/30 ${isCodeMode ? 'font-mono' : 'font-sans'} leading-relaxed whitespace-pre`}
            />
          </div>

          {/* Style Controls Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wider">
                Font Family
              </label>
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className="w-full text-sm p-2 rounded-lg border border-input bg-background font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              >
                {HANDWRITING_FONTS.map((f) => (
                  <option key={f.family} value={f.family}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wider">
                Font Size ({fontSize}px)
              </label>
              <input
                type="range"
                min="14"
                max="48"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full accent-amber-500 mt-2"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wider">
                {isCodeMode ? 'Default Code Color' : 'Ink Color'}
              </label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-8 h-8 rounded-lg border border-border cursor-pointer p-0 bg-transparent"
                />
                <span className="text-xs font-mono text-muted-foreground">{color}</span>
              </div>
            </div>
          </div>

          {/* Alignment, Line Width & Organic Drift */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wider">
                Alignment
              </label>
              <div className="flex bg-muted p-1 rounded-lg border border-border">
                {[
                  { id: 'left', icon: <AlignLeft className="w-4 h-4" /> },
                  { id: 'center', icon: <AlignCenter className="w-4 h-4" /> },
                  { id: 'right', icon: <AlignRight className="w-4 h-4" /> },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setAlign(item.id)}
                    className={`flex-1 flex justify-center py-1.5 rounded-md transition-all ${
                      align === item.id
                        ? 'bg-background shadow text-amber-600 dark:text-amber-400 font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {item.icon}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wider">
                Max Width ({maxWidth}px)
              </label>
              <input
                type="range"
                min="200"
                max="900"
                step="20"
                value={maxWidth}
                onChange={(e) => setMaxWidth(Number(e.target.value))}
                className="w-full accent-amber-500 mt-2"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wider">
                Handwriting Drift ({isCodeMode ? '0%' : `${Math.round(jitter * 100)}%`})
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                disabled={isCodeMode}
                value={isCodeMode ? 0 : jitter}
                onChange={(e) => setJitter(Number(e.target.value))}
                className="w-full accent-amber-500 mt-2 disabled:opacity-40"
              />
            </div>
          </div>

          {/* Preview Box */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Live Preview
              </label>
              {isLoading && (
                <span className="text-xs text-amber-500 font-medium animate-pulse">Loading font…</span>
              )}
            </div>
            <div className="min-h-[140px] max-h-[220px] overflow-auto bg-card border border-dashed border-border rounded-xl p-4 flex items-center justify-start shadow-inner">
              <canvas ref={previewCanvasRef} className="max-w-full drop-shadow-sm" />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-border bg-muted/30 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleInsertRasterized}
              disabled={!text.trim() || isLoading}
              title="Bake directly as a raster stroke image onto the canvas"
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl border border-border bg-card hover:bg-muted text-card-foreground transition-all disabled:opacity-50"
            >
              <Layers className="w-4 h-4 text-muted-foreground" />
              <span>Bake to Canvas Layer</span>
            </button>

            <button
              type="button"
              onClick={handleInsertEditable}
              disabled={!text.trim() || isLoading}
              title="Insert as selectable, formatable object"
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 transition-all disabled:opacity-50"
            >
              <Wand2 className="w-4 h-4" />
              <span>Insert Editable Object</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

