import { useState } from 'react';
import {
  MousePointer2, Pen, Square, Circle, Minus, ArrowRight, Type, StickyNote, Eraser, Hand,
  Undo2, Redo2, ZoomIn, ZoomOut, Trash2, Maximize2, Palette, ChevronLeft, ChevronRight,
  Highlighter, PenTool, Pencil, Brush, Crosshair,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const COLORS = ['#111111', '#FF331F', '#0033FF', '#00C853', '#FFD600', '#AA00FF', '#FF7A00', '#FFFFFF'];
const STICKY_COLORS = ['#FFD600', '#FFB74D', '#A5D6A7', '#90CAF9', '#F48FB1', '#CE93D8'];
const STROKES = [1, 2, 4, 6, 10];

const PEN_TYPES = [
  { id: 'normal',      label: 'Normal',      icon: Pen },
  { id: 'fountain',    label: 'Fountain',    icon: PenTool },
  { id: 'highlighter', label: 'Highlighter', icon: Highlighter },
  { id: 'marker',      label: 'Marker',      icon: Brush },
  { id: 'pencil',      label: 'Pencil',      icon: Pencil },
];

const TOOLS = [
  { id: 'select',  icon: MousePointer2, label: 'Select (V)',        t: 'toolbar-select-button'  },
  { id: 'hand',    icon: Hand,          label: 'Hand / Pan (H)',    t: 'toolbar-hand-button'    },
  { id: 'pen',     icon: Pen,           label: 'Pen (P)',           t: 'toolbar-draw-button'    },
  { id: 'rect',    icon: Square,        label: 'Rectangle (R)',     t: 'toolbar-shapes-button'  },
  { id: 'ellipse', icon: Circle,        label: 'Ellipse (O)',       t: 'toolbar-ellipse-button' },
  { id: 'line',    icon: Minus,         label: 'Line (L)',          t: 'toolbar-line-button'    },
  { id: 'arrow',   icon: ArrowRight,    label: 'Arrow (A)',         t: 'toolbar-arrow-button'   },
  { id: 'text',    icon: Type,          label: 'Text (T)',          t: 'toolbar-text-button'    },
  { id: 'sticky',  icon: StickyNote,    label: 'Sticky note (N)',   t: 'toolbar-sticky-button'  },
  { id: 'eraser',  icon: Eraser,        label: 'Eraser (E)',        t: 'toolbar-eraser-button'  },
  { id: 'laser',   icon: Crosshair,     label: 'Laser pointer (K)', t: 'toolbar-laser-button'   },
];

export default function CanvasToolbar({
  tool, setTool, penType, setPenType,
  color, setColor, stroke, setStroke,
  stickyColor, setStickyColor,
  onUndo, onRedo, canUndo, canRedo,
  onZoomIn, onZoomOut, onZoomReset, zoom, onClear,
}) {
  const [propsOpen, setPropsOpen] = useState(true);

  return (
    <>
      {/* ── Top floating tool palette ── */}
      <div
        className="absolute top-4 left-1/2 -translate-x-1/2 z-20 glass-panel rounded-2xl px-2 py-1.5 flex items-center gap-0.5"
        data-testid="canvas-toolbar"
      >
        {TOOLS.map((T) => (
          <button
            key={T.id}
            data-testid={T.t}
            title={T.label}
            onClick={() => setTool(T.id)}
            className={cn('tool-btn', tool === T.id && 'active')}
          >
            {T.id === 'laser'
              ? <T.icon className="w-4 h-4" style={tool === 'laser' ? { color: '#FF331F' } : {}} />
              : <T.icon className="w-4 h-4" />
            }
          </button>
        ))}
      </div>

      {/* ── Pen-style sub-toolbar (shows when pen is active) ── */}
      {tool === 'pen' && (
        <div
          className="absolute top-[68px] left-1/2 -translate-x-1/2 z-20 glass-panel rounded-2xl px-2 py-1.5 flex items-center gap-1"
          data-testid="pen-types"
        >
          {PEN_TYPES.map((P) => (
            <button
              key={P.id}
              data-testid={`pen-type-${P.id}`}
              title={P.label}
              onClick={() => setPenType(P.id)}
              className={cn('tool-btn px-2.5 w-auto gap-1.5 text-xs font-medium', penType === P.id && 'active')}
            >
              <P.icon className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{P.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Left properties panel — collapsible ── */}
      {propsOpen ? (
        <div
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 glass-panel rounded-2xl p-3 w-44 flex flex-col gap-3"
          data-testid="canvas-properties"
        >
          <div className="flex items-center justify-between -mt-1 -mr-1">
            <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">Properties</div>
            <button
              data-testid="props-collapse"
              onClick={() => setPropsOpen(false)}
              className="tool-btn w-6 h-6"
              title="Collapse"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Color */}
          <PropSection title="Color">
            <div className="grid grid-cols-4 gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  data-testid={`color-${c.replace('#', '')}`}
                  onClick={() => setColor(c)}
                  className={cn(
                    'w-7 h-7 rounded-lg border-2 transition-transform hover:scale-110',
                    color === c ? 'border-primary ring-2 ring-primary ring-offset-1 ring-offset-card' : 'border-border/50'
                  )}
                  style={{ background: c }}
                />
              ))}
              {/* Custom color picker */}
              <label
                className="w-7 h-7 rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                title="Custom color"
              >
                <Palette className="w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-0 h-0 opacity-0 absolute"
                />
              </label>
            </div>
          </PropSection>

          {/* Stroke */}
          <PropSection title="Stroke">
            <div className="flex items-center gap-1">
              {STROKES.map((s) => (
                <button
                  key={s}
                  data-testid={`stroke-${s}`}
                  onClick={() => setStroke(s)}
                  className={cn(
                    'flex-1 h-8 rounded-lg flex items-center justify-center hover:bg-foreground/5 transition-colors',
                    stroke === s && 'bg-primary/10'
                  )}
                >
                  <span
                    className="rounded-full"
                    style={{ width: Math.min(s + 3, 14), height: Math.min(s + 3, 14), background: 'hsl(var(--foreground))' }}
                  />
                </button>
              ))}
            </div>
          </PropSection>

          {/* Sticky color (only when sticky tool active) */}
          {tool === 'sticky' && (
            <PropSection title="Sticky">
              <div className="grid grid-cols-3 gap-1.5">
                {STICKY_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setStickyColor(c)}
                    className={cn(
                      'w-full h-7 rounded-lg border-2 transition-transform hover:scale-105',
                      stickyColor === c ? 'border-primary ring-2 ring-primary ring-offset-1 ring-offset-card' : 'border-border/40'
                    )}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </PropSection>
          )}
        </div>
      ) : (
        /* Collapsed icon */
        <button
          data-testid="props-expand"
          onClick={() => setPropsOpen(true)}
          title="Expand properties"
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 glass-panel rounded-full w-10 h-10 flex items-center justify-center hover:scale-105 transition-transform"
        >
          <Palette className="w-4 h-4" />
          <ChevronRight className="w-3 h-3 absolute -right-0.5 bottom-0.5 text-muted-foreground" />
        </button>
      )}

      {/* ── Bottom: undo/redo + zoom + clear ── */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 glass-panel rounded-2xl px-2 py-1.5 flex items-center gap-0.5">
        <button data-testid="canvas-undo"      title="Undo"       disabled={!canUndo} onClick={onUndo}      className={cn('tool-btn', !canUndo && 'opacity-30')}><Undo2    className="w-4 h-4" /></button>
        <button data-testid="canvas-redo"      title="Redo"       disabled={!canRedo} onClick={onRedo}      className={cn('tool-btn', !canRedo && 'opacity-30')}><Redo2    className="w-4 h-4" /></button>
        <div className="w-px h-5 bg-border mx-1" />
        <button data-testid="canvas-zoom-out"   title="Zoom out"               onClick={onZoomOut}   className="tool-btn"><ZoomOut   className="w-4 h-4" /></button>
        <button
          data-testid="canvas-zoom-reset"
          onClick={onZoomReset}
          className="px-2 h-9 text-xs font-mono text-muted-foreground hover:text-foreground rounded-xl hover:bg-foreground/5 transition-colors min-w-[52px]"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button data-testid="canvas-zoom-in"    title="Zoom in"                onClick={onZoomIn}    className="tool-btn"><ZoomIn    className="w-4 h-4" /></button>
        <button data-testid="canvas-fit"        title="Reset view"             onClick={onZoomReset}  className="tool-btn"><Maximize2 className="w-4 h-4" /></button>
        <div className="w-px h-5 bg-border mx-1" />
        <button data-testid="canvas-clear"      title="Clear page"             onClick={onClear}      className="tool-btn hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
      </div>
    </>
  );
}

function PropSection({ title, children }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground mb-1.5">{title}</div>
      {children}
    </div>
  );
}