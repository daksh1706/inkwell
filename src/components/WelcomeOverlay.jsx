import { useState } from 'react';
import { X, BookOpen, Pen, Layout, FileInput, Crosshair, Lightbulb } from 'lucide-react';

const TIPS = [
  { icon: BookOpen,   title: 'Notebooks → Sections → Pages', body: 'Organize your work hierarchically. Right-click any item in the sidebar for options.' },
  { icon: Layout,     title: 'Notes + Canvas together',       body: 'Switch between Notes, Split, and Canvas views from the top bar. Use Split for tutorial flow.' },
  { icon: Pen,        title: '5 Pen styles',                  body: 'Select the pen tool then choose Normal, Fountain, Highlighter, Marker, or Pencil from the sub-toolbar.' },
  { icon: FileInput,  title: 'PDF Import',                    body: 'Right-click a notebook → "Import PDF". Each PDF page becomes a canvas page with the PDF as the backdrop — ready to annotate.' },
  { icon: Crosshair,  title: 'Laser Pointer (K)',             body: 'Press K to activate. Move your cursor to draw a glowing macOS Keynote-style laser trail — perfect for presentations.' },
  { icon: Lightbulb,  title: 'Keyboard shortcuts',            body: 'V select · P pen · R rect · O ellipse · L line · A arrow · T text · N sticky · E eraser · H hand · K laser\nCtrl+Z undo · Ctrl+Y redo · Delete removes selected element.' },
];

export default function WelcomeOverlay() {
  const [open, setOpen] = useState(() => !localStorage.getItem('inkwell-welcomed-v2'));

  if (!open) return null;

  const dismiss = () => {
    localStorage.setItem('inkwell-welcomed-v2', '1');
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={dismiss}>
      <div
        className="glass-panel rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-thin"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-8 pb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <h2 className="font-display font-bold text-2xl tracking-tight">Welcome to InkWell</h2>
            </div>
            <p className="text-sm text-muted-foreground">Your premium tutorial notebook with infinite canvas</p>
          </div>
          <button onClick={dismiss} className="tool-btn flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tips grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-8 pb-4">
          {TIPS.map((tip) => (
            <div key={tip.title} className="p-4 rounded-2xl bg-muted/60 border border-border/40">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <tip.icon className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="font-display font-semibold text-sm">{tip.title}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{tip.body}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="px-8 pb-8">
          <button
            onClick={dismiss}
            className="w-full h-11 rounded-xl bg-primary text-white font-display font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Let's go ✦
          </button>
        </div>
      </div>
    </div>
  );
}