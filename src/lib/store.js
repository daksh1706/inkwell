// InkWell Notebook Store — localStorage & MongoDB Cloud Sync
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'inkwell.workspace.v2';
const TOKEN_KEY = 'inkwell_auth_token';

export const uid = () => Math.random().toString(36).slice(2, 10);

export function emptyPage(name) {
  return {
    id: uid(),
    name,
    notes: '',
    canvas: { elements: [], transform: { x: 0, y: 0, scale: 1 } },
    view: 'split',
    updated: Date.now(),
  };
}

function sampleElements() {
  return [
    { id: uid(), type: 'text', x: 120, y: 60, text: 'Tutorial Canvas ✦', color: '#111111', fontSize: 36, font: 'display' },
    { id: uid(), type: 'rect', x: 100, y: 120, w: 240, h: 110, color: '#FF331F', strokeWidth: 2, fill: 'transparent', radius: 12 },
    { id: uid(), type: 'text', x: 130, y: 160, text: '1. Hook', color: '#111111', fontSize: 22, font: 'display' },
    { id: uid(), type: 'text', x: 130, y: 195, text: 'Why this matters', color: '#666666', fontSize: 14, font: 'body' },
    { id: uid(), type: 'arrow', x1: 345, y1: 175, x2: 430, y2: 175, color: '#111111', strokeWidth: 2 },
    { id: uid(), type: 'rect', x: 440, y: 120, w: 240, h: 110, color: '#0033FF', strokeWidth: 2, fill: 'transparent', radius: 12 },
    { id: uid(), type: 'text', x: 470, y: 160, text: '2. Demo', color: '#111111', fontSize: 22, font: 'display' },
    { id: uid(), type: 'text', x: 470, y: 195, text: "Show, don't tell", color: '#666666', fontSize: 14, font: 'body' },
    { id: uid(), type: 'arrow', x1: 685, y1: 175, x2: 770, y2: 175, color: '#111111', strokeWidth: 2 },
    { id: uid(), type: 'rect', x: 780, y: 120, w: 240, h: 110, color: '#00C853', strokeWidth: 2, fill: 'transparent', radius: 12 },
    { id: uid(), type: 'text', x: 810, y: 160, text: '3. Recap', color: '#111111', fontSize: 22, font: 'display' },
    { id: uid(), type: 'text', x: 810, y: 195, text: 'Pin the key idea', color: '#666666', fontSize: 14, font: 'body' },
    { id: uid(), type: 'sticky', x: 280, y: 280, w: 200, h: 120, text: 'Idea: open with a story 💡', color: '#FFD600' },
    { id: uid(), type: 'sticky', x: 560, y: 310, w: 200, h: 120, text: 'Use real screen captures', color: '#CE93D8' },
  ];
}

export const seedData = () => {
  const pageA = {
    id: uid(),
    name: 'Welcome to InkWell',
    notes: `<h1>Welcome to InkWell ✦</h1>
<p>A calm, paper-feel notebook with an Excalidraw-style infinite canvas — connected to MongoDB for persistent cloud sync.</p>
<h2>What you can do</h2>
<ul>
  <li>Organize <strong>notebooks → sections → pages</strong> in the left sidebar</li>
  <li>Switch view to <strong>Notes</strong>, <strong>Canvas</strong>, or <strong>Split</strong> from the top bar</li>
  <li>Draw with <strong>5 pen styles</strong>: Normal, Fountain, Highlighter, Marker, Pencil</li>
  <li>Import PDFs — each page becomes a canvas backdrop</li>
  <li>Use the 🔴 <strong>Laser Pointer (K)</strong> for smooth macOS-style presentations</li>
  <li>Create an account to <strong>save all data to MongoDB</strong> automatically!</li>
</ul>
<h2>Keyboard Shortcuts</h2>
<p><code>V</code> select · <code>P</code> pen · <code>R</code> rect · <code>O</code> ellipse · <code>L</code> line · <code>A</code> arrow · <code>T</code> text · <code>N</code> sticky · <code>E</code> eraser · <code>H</code> hand · <code>K</code> laser</p>
<p>Scroll to pan · <code>Ctrl/⌘ + scroll</code> to zoom.</p>`,
    canvas: { elements: sampleElements(), transform: { x: 0, y: 0, scale: 1 } },
    view: 'split',
    updated: Date.now(),
  };
  const pageB = {
    id: uid(),
    name: 'Sketch ideas',
    notes: '<h2>Sketch ideas</h2><p>Use this page as a scratchpad. Try the pen tool!</p>',
    canvas: { elements: [], transform: { x: 0, y: 0, scale: 1 } },
    view: 'canvas',
    updated: Date.now(),
  };
  const nb = {
    id: uid(),
    name: 'My Notebook',
    color: '#FF331F',
    sections: [
      { id: uid(), name: 'Getting Started', pages: [pageA, pageB] },
      {
        id: uid(), name: 'Tutorials', pages: [
          { id: uid(), name: 'Lesson 1 — Intro', notes: '<h2>Lesson 1</h2><p>Outline your lesson here…</p>', canvas: { elements: [], transform: { x: 0, y: 0, scale: 1 } }, view: 'split', updated: Date.now() },
        ]
      },
    ],
  };
  return {
    activePageId: pageA.id,
    notebooks: [nb],
  };
};

const load = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedData();
    const data = JSON.parse(raw);
    if (!data.notebooks || data.notebooks.length === 0) return seedData();
    return data;
  } catch {
    return seedData();
  }
};

const saveLocal = (data) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('InkWell: localStorage save failed', e);
  }
};

// Singleton store
let memoryState = null;
const listeners = new Set();
let cloudSyncTimeout = null;

export const getState = () => {
  if (!memoryState) memoryState = load();
  return memoryState;
};

// Debounced cloud sync to MongoDB
const syncToCloudDebounced = (state) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;

  if (cloudSyncTimeout) {
    clearTimeout(cloudSyncTimeout);
  }

  cloudSyncTimeout = setTimeout(async () => {
    try {
      await fetch('/api/workspace', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          activePageId: state.activePageId,
          notebooks: state.notebooks,
        }),
      });
    } catch (err) {
      console.warn('MongoDB cloud sync failed:', err);
    }
  }, 1000);
};

export const setState = (updater) => {
  const next = typeof updater === 'function' ? updater(getState()) : updater;
  memoryState = next;
  saveLocal(next);
  syncToCloudDebounced(next);
  listeners.forEach((l) => l(next));
};

// When user logs in or loads cloud data
export const loadUserWorkspace = (cloudData) => {
  if (!cloudData || !cloudData.notebooks || cloudData.notebooks.length === 0) {
    const defaultData = seedData();
    setState(defaultData);
  } else {
    // Make sure activePageId is valid
    let activePageId = cloudData.activePageId;
    const allPages = cloudData.notebooks.flatMap((n) => n.sections.flatMap((sec) => sec.pages));
    if (!allPages.find((p) => p.id === activePageId)) {
      activePageId = allPages[0]?.id || null;
    }
    setState({
      activePageId,
      notebooks: cloudData.notebooks,
    });
  }
};

export const fetchCloudWorkspace = async (token) => {
  try {
    const res = await fetch('/api/workspace', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.data) {
        loadUserWorkspace(data.data);
      }
    }
  } catch (err) {
    console.warn('Failed to fetch user workspace from MongoDB:', err);
  }
};

export const useWorkspace = () => {
  const [state, setLocal] = useState(getState);
  useEffect(() => {
    const l = (s) => setLocal({ ...s });
    listeners.add(l);
    return () => listeners.delete(l);
  }, []);
  return state;
};

export const findPage = (state, pageId) => {
  for (const nb of state.notebooks) {
    for (const sec of nb.sections) {
      const p = sec.pages.find((pg) => pg.id === pageId);
      if (p) return { notebook: nb, section: sec, page: p };
    }
  }
  return null;
};

export const useActivePage = () => {
  const state = useWorkspace();
  if (!state.activePageId) return null;
  return findPage(state, state.activePageId);
};

export const actions = {
  setActivePage: (pageId) => setState((s) => ({ ...s, activePageId: pageId })),

  addNotebook: (name = 'New Notebook') => setState((s) => {
    const sec = { id: uid(), name: 'Section 1', pages: [emptyPage('Untitled')] };
    const nb = { id: uid(), name, color: '#FF331F', sections: [sec] };
    const next = { ...s, notebooks: [...s.notebooks, nb] };
    next.activePageId = sec.pages[0].id;
    return next;
  }),

  renameNotebook: (id, name) => setState((s) => ({
    ...s,
    notebooks: s.notebooks.map((n) => n.id === id ? { ...n, name } : n),
  })),

  setNotebookColor: (id, color) => setState((s) => ({
    ...s,
    notebooks: s.notebooks.map((n) => n.id === id ? { ...n, color } : n),
  })),

  deleteNotebook: (id) => setState((s) => {
    const notebooks = s.notebooks.filter((n) => n.id !== id);
    let activePageId = s.activePageId;
    const allPages = notebooks.flatMap((n) => n.sections.flatMap((sec) => sec.pages));
    if (!allPages.find((p) => p.id === activePageId)) {
      activePageId = allPages[0]?.id || null;
    }
    return { ...s, notebooks, activePageId };
  }),

  addSection: (notebookId) => setState((s) => ({
    ...s,
    notebooks: s.notebooks.map((n) =>
      n.id === notebookId
        ? { ...n, sections: [...n.sections, { id: uid(), name: 'New Section', pages: [emptyPage('Untitled')] }] }
        : n
    ),
  })),

  renameSection: (notebookId, sectionId, name) => setState((s) => ({
    ...s,
    notebooks: s.notebooks.map((n) =>
      n.id === notebookId
        ? { ...n, sections: n.sections.map((sec) => sec.id === sectionId ? { ...sec, name } : sec) }
        : n
    ),
  })),

  deleteSection: (notebookId, sectionId) => setState((s) => {
    const nb = s.notebooks.find((n) => n.id === notebookId);
    if (!nb) return s;
    const section = nb.sections.find((sec) => sec.id === sectionId);
    const removedPageIds = new Set((section?.pages || []).map((p) => p.id));
    const notebooks = s.notebooks.map((n) =>
      n.id === notebookId
        ? { ...n, sections: n.sections.filter((sec) => sec.id !== sectionId) }
        : n
    );
    let activePageId = s.activePageId;
    if (removedPageIds.has(activePageId)) {
      const allPages = notebooks.flatMap((n) => n.sections.flatMap((sec) => sec.pages));
      activePageId = allPages[0]?.id || null;
    }
    return { ...s, notebooks, activePageId };
  }),

  addPage: (notebookId, sectionId) => setState((s) => {
    const np = emptyPage('Untitled');
    return {
      ...s,
      activePageId: np.id,
      notebooks: s.notebooks.map((n) =>
        n.id === notebookId
          ? { ...n, sections: n.sections.map((sec) => sec.id === sectionId ? { ...sec, pages: [...sec.pages, np] } : sec) }
          : n
      ),
    };
  }),

  addPagesFromPDF: (notebookId, sectionId, pdfPages, pdfName) => setState((s) => {
    // pdfPages: array of { dataURL, width, height }
    const newSection = {
      id: uid(),
      name: pdfName || 'PDF Import',
      pages: pdfPages.map((pg, i) => ({
        id: uid(),
        name: `Page ${i + 1}`,
        notes: '',
        canvas: {
          elements: [],
          transform: { x: 0, y: 0, scale: 1 },
          backdrop: { dataURL: pg.dataURL, width: pg.width, height: pg.height },
        },
        view: 'canvas',
        updated: Date.now(),
      })),
    };
    const firstPageId = newSection.pages[0]?.id || null;
    return {
      ...s,
      activePageId: firstPageId,
      notebooks: s.notebooks.map((n) =>
        n.id === notebookId
          ? { ...n, sections: [...n.sections, newSection] }
          : n
      ),
    };
  }),

  renamePage: (pageId, name) => setState((s) => ({
    ...s,
    notebooks: s.notebooks.map((n) => ({
      ...n,
      sections: n.sections.map((sec) => ({
        ...sec,
        pages: sec.pages.map((p) => p.id === pageId ? { ...p, name, updated: Date.now() } : p),
      })),
    })),
  })),

  deletePage: (pageId) => setState((s) => {
    const next = {
      ...s,
      notebooks: s.notebooks.map((n) => ({
        ...n,
        sections: n.sections.map((sec) => ({
          ...sec,
          pages: sec.pages.filter((p) => p.id !== pageId),
        })),
      })),
    };
    if (s.activePageId === pageId) {
      const allPages = next.notebooks.flatMap((n) => n.sections.flatMap((sec) => sec.pages));
      next.activePageId = allPages[0]?.id || null;
    }
    return next;
  }),

  updatePage: (pageId, patch) => setState((s) => ({
    ...s,
    notebooks: s.notebooks.map((n) => ({
      ...n,
      sections: n.sections.map((sec) => ({
        ...sec,
        pages: sec.pages.map((p) => p.id === pageId ? { ...p, ...patch, updated: Date.now() } : p),
      })),
    })),
  })),

  setPageView: (pageId, view) => setState((s) => ({
    ...s,
    notebooks: s.notebooks.map((n) => ({
      ...n,
      sections: n.sections.map((sec) => ({
        ...sec,
        pages: sec.pages.map((p) => p.id === pageId ? { ...p, view } : p),
      })),
    })),
  })),
};