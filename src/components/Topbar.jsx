import { useRef, useState, useEffect, useCallback } from 'react';
import {
  SplitSquareHorizontal, FileText, Monitor, Moon, Sun, FileUp, Loader2,
  Cloud, LogIn, LogOut, Save, Check, AlertCircle, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useActivePage, useWorkspace, useSyncStatus, actions } from '@/lib/store';
import { useTheme } from '@/lib/theme';
import { useAuth } from '@/lib/authContext';
import { pdfFileToPages } from '@/lib/pdf';
import { toast } from 'sonner';

const VIEWS = [
  { id: 'notes',  icon: FileText,              label: 'Notes' },
  { id: 'split',  icon: SplitSquareHorizontal, label: 'Split' },
  { id: 'canvas', icon: Monitor,               label: 'Canvas' },
];

export default function Topbar() {
  const active            = useActivePage();
  const state             = useWorkspace();
  const syncState         = useSyncStatus();
  const { theme, toggle } = useTheme();
  const { user, isAuthenticated, openAuthModal, logout } = useAuth();
  
  const pdfRef            = useRef(null);
  const [importing, setImporting]   = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = () => setUserMenuOpen(false);
    if (userMenuOpen) {
      window.addEventListener('click', handleClickOutside);
    }
    return () => window.removeEventListener('click', handleClickOutside);
  }, [userMenuOpen]);

  // ── Manual Save Handler ────────────────────────────────────────────────
  const handleManualSave = useCallback(async () => {
    if (manualSaving) return;
    setManualSaving(true);
    try {
      const res = await actions.saveNow();
      if (res.isCloud) {
        toast.success('All changes saved to cloud!');
      } else {
        toast.success('Saved locally! Sign in to sync with cloud.');
      }
    } catch (err) {
      toast.error('Save failed: ' + (err.message || 'Unknown error'));
    } finally {
      setTimeout(() => setManualSaving(false), 400);
    }
  }, [manualSaving]);

  // ── Global Keyboard Shortcut for Save (Ctrl+S / Cmd+S) ─────────────────
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleManualSave();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleManualSave]);

  if (!active) return null;
  const { notebook, page } = active;
  const view = page.view || 'split';

  // ── PDF Import ──────────────────────────────────────────────────────────
  const handlePdfClick = () => pdfRef.current?.click();

  const onPdfFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setImporting(true);
    const toastId = toast.loading(`Importing "${file.name}"…`);
    try {
      const pages = await pdfFileToPages(file, 2.5);
      const name  = file.name.replace(/\.pdf$/i, '');
      // Add PDF pages to the current notebook as a new section
      actions.addPagesFromPDF(notebook.id, null, pages, name);
      toast.success(
        `Imported ${pages.length} page${pages.length !== 1 ? 's' : ''} from "${file.name}"`,
        { id: toastId }
      );
    } catch (err) {
      console.error('PDF import error:', err);
      toast.error('PDF import failed — make sure the file is a valid PDF', { id: toastId });
    } finally {
      setImporting(false);
    }
  };

  return (
    <header className="h-12 flex items-center gap-2 px-4 border-b border-border bg-background/80 backdrop-blur-xl flex-shrink-0 z-10">

      {/* Page title (inline editable) */}
      <div className="flex-1 min-w-0">
        <h1
          className="font-display font-semibold text-sm truncate text-foreground/80 cursor-text outline-none"
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => {
            const name = e.target.textContent?.trim();
            if (name && name !== page.name) actions.renamePage(page.id, name);
            else e.target.textContent = page.name;
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
          }}
        >
          {page.name || 'Untitled'}
        </h1>
      </div>

      {/* ── Auto Cloud-Save Status Indicator ── */}
      <div className="flex items-center flex-shrink-0">
        {syncState.status === 'saving' || manualSaving ? (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-medium border border-amber-500/20"
            title="Automatically saving changes to cloud…"
          >
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
            <span className="hidden sm:inline">Saving to cloud…</span>
          </div>
        ) : syncState.status === 'saved' && syncState.isCloud ? (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-medium border border-emerald-500/20"
            title="Automatic cloud backup active · All changes saved to MongoDB"
          >
            <Cloud className="w-3.5 h-3.5 text-emerald-500" />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline">Saved to Cloud</span>
          </div>
        ) : syncState.status === 'error' ? (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-destructive/10 text-destructive text-xs font-medium border border-destructive/20"
            title="Cloud sync offline · Changes saved locally in browser"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Offline (Saved locally)</span>
          </div>
        ) : (
          <button
            onClick={() => openAuthModal('signin')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/70 hover:bg-muted text-muted-foreground text-xs font-medium border border-border/60 transition-colors"
            title="Saved locally in browser · Click to sign in and enable cloud sync"
          >
            <Check className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">Saved locally</span>
          </button>
        )}
      </div>

      {/* ── Manual Save Button ── */}
      <button
        onClick={handleManualSave}
        disabled={manualSaving}
        title="Save now (Ctrl/⌘ + S)"
        className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium bg-secondary/80 hover:bg-secondary text-foreground border border-border active:scale-95 transition-all shadow-sm flex-shrink-0"
      >
        {manualSaving ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
        ) : (
          <Save className="w-3.5 h-3.5 text-primary" />
        )}
        <span>Save</span>
        <kbd className="hidden md:inline-block text-[9px] text-muted-foreground font-mono bg-muted/80 px-1 py-0.5 rounded border border-border/50">
          ⌘S
        </kbd>
      </button>

      {/* ── Import PDF button ── */}
      <button
        onClick={handlePdfClick}
        disabled={importing}
        title="Import PDF — each page becomes a canvas page with the PDF as backdrop"
        className={cn(
          'flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium transition-all border flex-shrink-0',
          importing
            ? 'bg-muted text-muted-foreground border-border cursor-not-allowed'
            : 'bg-primary/10 text-primary border-primary/25 hover:bg-primary/20 hover:border-primary/40'
        )}
      >
        {importing
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <FileUp className="w-3.5 h-3.5" />
        }
        <span className="hidden sm:inline">{importing ? 'Importing…' : 'Import PDF'}</span>
      </button>
      {/* hidden file input */}
      <input
        ref={pdfRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={onPdfFile}
      />

      {/* ── View switcher ── */}
      <div className="flex items-center gap-0.5 p-0.5 rounded-xl bg-muted flex-shrink-0">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            data-testid={`view-${v.id}`}
            className={cn('view-pill', view === v.id && 'active')}
            onClick={() => actions.setPageView(page.id, v.id)}
            title={v.label}
          >
            <v.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{v.label}</span>
          </button>
        ))}
      </div>

      {/* ── Cloud Sync Status / Auth Button ── */}
      {isAuthenticated ? (
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setUserMenuOpen(!userMenuOpen);
            }}
            className="flex items-center gap-2 h-8 px-2.5 rounded-lg border border-border bg-card/60 hover:bg-muted text-xs font-medium transition-colors flex-shrink-0"
            title={`Logged in as ${user?.name} (${user?.email})`}
          >
            <div className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center font-bold text-[10px]">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <span className="max-w-[100px] truncate hidden md:inline">{user?.name}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="Connected to MongoDB" />
          </button>

          {/* User Dropdown Menu */}
          {userMenuOpen && (
            <div 
              className="absolute right-0 top-10 w-56 p-2 rounded-xl bg-card border border-border shadow-xl z-50 text-xs animate-scale-up"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-2.5 py-2 border-b border-border/80 mb-1">
                <p className="font-semibold text-foreground truncate">{user?.name}</p>
                <p className="text-muted-foreground text-[11px] truncate">{user?.email}</p>
                <div className="flex items-center gap-1.5 mt-2 text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  MongoDB Cloud Sync Active
                </div>
              </div>
              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  logout();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors text-left"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => openAuthModal('signin')}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-all shadow-sm flex-shrink-0"
          title="Sign in to save all your data to MongoDB cloud"
        >
          <LogIn className="w-3.5 h-3.5" />
          <span>Sign In</span>
        </button>
      )}

      {/* ── Theme toggle ── */}
      <button
        className="tool-btn flex-shrink-0"
        onClick={toggle}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark'
          ? <Sun  className="w-4 h-4" />
          : <Moon className="w-4 h-4" />
        }
      </button>
    </header>
  );
}
