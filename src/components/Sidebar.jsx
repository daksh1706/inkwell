import { useState, useRef } from 'react';
import {
  BookOpen, ChevronRight, ChevronDown, Plus, MoreHorizontal,
  FileText, Trash2, Edit3, FolderOpen, Book, Upload, Download,
  Cloud, LogIn, LogOut, User as UserIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspace, actions, findPage } from '@/lib/store';
import { useAuth } from '@/lib/authContext';
import { pdfFileToPages, pageToImage, buildPdfFromImages } from '@/lib/pdf';
import { toast } from 'sonner';

// Small palette for notebook color dot
const NB_COLORS = ['#FF331F', '#0033FF', '#00C853', '#FFD600', '#AA00FF', '#FF7A00', '#333333'];

export default function Sidebar() {
  const state = useWorkspace();
  const { notebooks, activePageId } = state;
  const { user, isAuthenticated, openAuthModal, logout } = useAuth();

  const [expandedNotebooks, setExpandedNotebooks] = useState(() => {
    const set = new Set();
    notebooks.forEach((nb) => set.add(nb.id));
    return set;
  });
  const [expandedSections, setExpandedSections] = useState(() => {
    const set = new Set();
    notebooks.forEach((nb) => nb.sections.forEach((sec) => set.add(sec.id)));
    return set;
  });
  const [editingId, setEditingId] = useState(null);
  const [editVal, setEditVal] = useState('');
  const [contextMenu, setContextMenu] = useState(null); // { type, id, nbId, secId, x, y }
  const pdfInput = useRef(null);
  const pdfTarget = useRef(null); // { notebookId, sectionId }
  const [exportingSecId, setExportingSecId] = useState(null);

  const toggleNb = (id) => {
    const next = new Set(expandedNotebooks);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedNotebooks(next);
  };
  const toggleSec = (id) => {
    const next = new Set(expandedSections);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedSections(next);
  };

  const startEdit = (id, val, e) => {
    e?.stopPropagation();
    setEditingId(id);
    setEditVal(val);
    setContextMenu(null);
  };

  const commitEdit = (type, ids) => {
    if (!editVal.trim()) { setEditingId(null); return; }
    if (type === 'notebook') actions.renameNotebook(ids.nbId, editVal.trim());
    if (type === 'section') actions.renameSection(ids.nbId, ids.secId, editVal.trim());
    if (type === 'page') actions.renamePage(ids.pageId, editVal.trim());
    setEditingId(null);
  };

  const openCtx = (e, menu) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ ...menu, x: e.clientX, y: e.clientY });
  };

  const closeCtx = () => setContextMenu(null);

  // PDF import — pick file then create new section with backdrop pages
  const handlePdfImport = async (notebookId) => {
    pdfTarget.current = { notebookId };
    pdfInput.current.click();
    closeCtx();
  };

  const onPdfFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !pdfTarget.current) return;
    e.target.value = '';
    const toastId = toast.loading(`Importing "${file.name}"…`);
    try {
      const pages = await pdfFileToPages(file, 2.5);
      const name = file.name.replace(/\.pdf$/i, '');
      actions.addPagesFromPDF(pdfTarget.current.notebookId, null, pages, name);
      toast.success(`Imported ${pages.length} page${pages.length > 1 ? 's' : ''} from "${file.name}"`, { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('PDF import failed', { id: toastId });
    }
  };

  // PDF export — render all pages in a section to PNG then pack as PDF
  const handlePdfExport = async (notebookId, sectionId) => {
    closeCtx();
    const nb = state.notebooks.find((n) => n.id === notebookId);
    const sec = nb?.sections.find((s) => s.id === sectionId);
    if (!sec) return;
    setExportingSecId(sectionId);
    const toastId = toast.loading(`Exporting "${sec.name}"…`);
    try {
      const images = [];
      for (const pg of sec.pages) {
        const img = await pageToImage(pg);
        images.push(img);
      }
      await buildPdfFromImages(images, `${sec.name}.pdf`);
      toast.success(`Exported "${sec.name}.pdf"`, { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error('Export failed', { id: toastId });
    } finally {
      setExportingSecId(null);
    }
  };

  return (
    <aside
      className="h-full w-64 flex flex-col border-r border-border bg-sidebar overflow-hidden select-none"
      onClick={closeCtx}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-border">
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-4 h-4 text-white" />
        </div>
        <span className="font-display font-bold text-base tracking-tight text-foreground">InkWell</span>
        <button
          className="ml-auto tool-btn w-7 h-7"
          title="New notebook"
          onClick={() => actions.addNotebook()}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto scrollbar-thin py-2 px-1.5">
        {notebooks.map((nb) => (
          <div key={nb.id} className="mb-0.5">
            {/* Notebook row */}
            <div
              className={cn('sidebar-item group', 'justify-between')}
              onClick={() => toggleNb(nb.id)}
              onContextMenu={(e) => openCtx(e, { type: 'notebook', nbId: nb.id })}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: nb.color }} />
                {expandedNotebooks.has(nb.id)
                  ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                }
                {editingId === nb.id
                  ? <input
                      autoFocus
                      value={editVal}
                      onChange={(e) => setEditVal(e.target.value)}
                      onBlur={() => commitEdit('notebook', { nbId: nb.id })}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitEdit('notebook', { nbId: nb.id }); if (e.key === 'Escape') setEditingId(null); }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 bg-transparent outline-none border-b border-primary text-sm font-medium min-w-0"
                    />
                  : <span className="font-medium text-sm truncate">{nb.name}</span>
                }
              </div>
              <button
                className="tool-btn w-6 h-6 opacity-0 group-hover:opacity-100 flex-shrink-0"
                onClick={(e) => { e.stopPropagation(); openCtx(e, { type: 'notebook', nbId: nb.id }); }}
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Sections */}
            {expandedNotebooks.has(nb.id) && nb.sections.map((sec) => (
              <div key={sec.id} className="ml-4">
                <div
                  className={cn('sidebar-item group', 'justify-between')}
                  onClick={() => toggleSec(sec.id)}
                  onContextMenu={(e) => openCtx(e, { type: 'section', nbId: nb.id, secId: sec.id })}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {expandedSections.has(sec.id)
                      ? <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      : <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    }
                    <FolderOpen className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    {editingId === sec.id
                      ? <input
                          autoFocus
                          value={editVal}
                          onChange={(e) => setEditVal(e.target.value)}
                          onBlur={() => commitEdit('section', { nbId: nb.id, secId: sec.id })}
                          onKeyDown={(e) => { if (e.key === 'Enter') commitEdit('section', { nbId: nb.id, secId: sec.id }); if (e.key === 'Escape') setEditingId(null); }}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 bg-transparent outline-none border-b border-primary text-xs min-w-0"
                        />
                      : <span className="text-xs font-medium truncate">{sec.name}</span>
                    }
                    {exportingSecId === sec.id && <span className="text-[9px] text-primary ml-1 animate-pulse">Exporting…</span>}
                  </div>
                  <div className="flex gap-0.5">
                    <button
                      className="tool-btn w-5 h-5 opacity-0 group-hover:opacity-100 flex-shrink-0"
                      title="Add page"
                      onClick={(e) => { e.stopPropagation(); actions.addPage(nb.id, sec.id); }}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      className="tool-btn w-5 h-5 opacity-0 group-hover:opacity-100 flex-shrink-0"
                      onClick={(e) => { e.stopPropagation(); openCtx(e, { type: 'section', nbId: nb.id, secId: sec.id }); }}
                    >
                      <MoreHorizontal className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Pages */}
                {expandedSections.has(sec.id) && sec.pages.map((pg) => (
                  <div
                    key={pg.id}
                    className={cn('sidebar-item ml-4 group', pg.id === activePageId && 'active')}
                    onClick={() => actions.setActivePage(pg.id)}
                    onContextMenu={(e) => openCtx(e, { type: 'page', nbId: nb.id, secId: sec.id, pageId: pg.id })}
                  >
                    <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                    {editingId === pg.id
                      ? <input
                          autoFocus
                          value={editVal}
                          onChange={(e) => setEditVal(e.target.value)}
                          onBlur={() => commitEdit('page', { pageId: pg.id })}
                          onKeyDown={(e) => { if (e.key === 'Enter') commitEdit('page', { pageId: pg.id }); if (e.key === 'Escape') setEditingId(null); }}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 bg-transparent outline-none border-b border-primary text-xs min-w-0"
                        />
                      : <span className="text-xs truncate flex-1">{pg.name || 'Untitled'}</span>
                    }
                    <button
                      className="tool-btn w-5 h-5 opacity-0 group-hover:opacity-100 flex-shrink-0"
                      onClick={(e) => { e.stopPropagation(); openCtx(e, { type: 'page', nbId: nb.id, secId: sec.id, pageId: pg.id }); }}
                    >
                      <MoreHorizontal className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* User Section at bottom of sidebar */}
      <div className="p-3 border-t border-border bg-sidebar/80">
        {isAuthenticated ? (
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-card border border-border/80">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate leading-tight">{user?.name}</p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono leading-tight">MongoDB Cloud ✦</p>
              </div>
            </div>
            <button
              onClick={() => logout()}
              title="Sign Out"
              className="tool-btn w-6 h-6 text-muted-foreground hover:text-destructive flex-shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <button
              onClick={() => openAuthModal('signup')}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-primary text-primary-foreground font-display font-semibold text-xs hover:opacity-90 transition-all shadow-sm"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In / Sign Up</span>
            </button>
            <p className="text-[10px] text-center text-muted-foreground">
              Sync notes & canvas to MongoDB
            </p>
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 glass-panel rounded-xl py-1 w-48 shadow-2xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'notebook' && (
            <>
              <CtxItem icon={Edit3} label="Rename" onClick={() => startEdit(contextMenu.nbId, notebooks.find(n => n.id === contextMenu.nbId)?.name || '')} />
              <CtxItem icon={Plus} label="Add section" onClick={() => { actions.addSection(contextMenu.nbId); closeCtx(); }} />
              <CtxItem icon={Upload} label="Import PDF" onClick={() => handlePdfImport(contextMenu.nbId)} />
              {/* Color picker */}
              <div className="px-3 py-2">
                <div className="text-[10px] uppercase text-muted-foreground mb-1.5 font-mono">Color</div>
                <div className="flex gap-1.5 flex-wrap">
                  {NB_COLORS.map((c) => (
                    <button
                      key={c}
                      className="w-5 h-5 rounded-full border-2 border-transparent hover:scale-110 transition-transform"
                      style={{ background: c, borderColor: notebooks.find(n => n.id === contextMenu.nbId)?.color === c ? '#fff' : 'transparent', outline: notebooks.find(n => n.id === contextMenu.nbId)?.color === c ? `2px solid ${c}` : 'none', outlineOffset: '1px' }}
                      onClick={() => { actions.setNotebookColor(contextMenu.nbId, c); closeCtx(); }}
                    />
                  ))}
                </div>
              </div>
              <div className="h-px bg-border mx-2 my-1" />
              <CtxItem icon={Trash2} label="Delete notebook" danger onClick={() => { if (window.confirm('Delete this notebook?')) { actions.deleteNotebook(contextMenu.nbId); closeCtx(); } }} />
            </>
          )}
          {contextMenu.type === 'section' && (
            <>
              <CtxItem icon={Edit3} label="Rename" onClick={() => {
                const sec = notebooks.find(n => n.id === contextMenu.nbId)?.sections.find(s => s.id === contextMenu.secId);
                startEdit(contextMenu.secId, sec?.name || '');
              }} />
              <CtxItem icon={Plus} label="Add page" onClick={() => { actions.addPage(contextMenu.nbId, contextMenu.secId); closeCtx(); }} />
              <CtxItem icon={Download} label="Export as PDF" onClick={() => handlePdfExport(contextMenu.nbId, contextMenu.secId)} />
              <div className="h-px bg-border mx-2 my-1" />
              <CtxItem icon={Trash2} label="Delete section" danger onClick={() => { if (window.confirm('Delete this section and all its pages?')) { actions.deleteSection(contextMenu.nbId, contextMenu.secId); closeCtx(); } }} />
            </>
          )}
          {contextMenu.type === 'page' && (
            <>
              <CtxItem icon={Edit3} label="Rename" onClick={() => {
                const nb = notebooks.find(n => n.id === contextMenu.nbId);
                const sec = nb?.sections.find(s => s.id === contextMenu.secId);
                const pg = sec?.pages.find(p => p.id === contextMenu.pageId);
                startEdit(contextMenu.pageId, pg?.name || '');
              }} />
              <div className="h-px bg-border mx-2 my-1" />
              <CtxItem icon={Trash2} label="Delete page" danger onClick={() => { actions.deletePage(contextMenu.pageId); closeCtx(); }} />
            </>
          )}
        </div>
      )}

      {/* Hidden PDF file input */}
      <input ref={pdfInput} type="file" accept=".pdf,application/pdf" className="hidden" onChange={onPdfFile} />
    </aside>
  );
}

function CtxItem({ icon: Icon, label, onClick, danger }) {
  return (
    <button
      className={cn(
        'flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors',
        danger ? 'text-destructive hover:bg-destructive/8' : 'text-foreground/80 hover:bg-foreground/5 hover:text-foreground'
      )}
      onClick={onClick}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      {label}
    </button>
  );
}
