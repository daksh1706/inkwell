import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { actions, uid } from '@/lib/store';
import CanvasToolbar from '@/components/CanvasToolbar';
import { getStroke } from 'perfect-freehand';
import { Trash2, Bold, Italic, Highlighter, Palette, X, Move } from 'lucide-react';

const SHAPE_TOOLS = ['rect', 'ellipse', 'line', 'arrow'];
const LASER_DECAY = 900; // ms

// ── Perfect-freehand presets ─────────────────────────────────────────────────
const PEN_PRESETS = {
  normal:      { size: 1, thinning: 0,    smoothing: 0.5,  streamline: 0.5,  simulatePressure: false, opacity: 1.0  },
  fountain:    { size: 1, thinning: 0.7,  smoothing: 0.55, streamline: 0.5,  simulatePressure: true,  opacity: 1.0  },
  marker:      { size: 1, thinning: 0.1,  smoothing: 0.5,  streamline: 0.4,  simulatePressure: false, opacity: 1.0  },
  highlighter: { size: 1, thinning: 0,    smoothing: 0.5,  streamline: 0.4,  simulatePressure: false, opacity: 0.38 },
  pencil:      { size: 1, thinning: 0.4,  smoothing: 0.55, streamline: 0.5,  simulatePressure: true,  opacity: 0.80 },
};
const PEN_SCALE = { normal: 1.8, fountain: 2.4, marker: 5, highlighter: 16, pencil: 1.5 };

function strokeOutline(points, penType, strokeWidth) {
  const preset = PEN_PRESETS[penType] || PEN_PRESETS.normal;
  const size   = strokeWidth * (PEN_SCALE[penType] || 1.8);
  return getStroke(points, { ...preset, size });
}

function outlineToPath(pts) {
  if (!pts || pts.length < 2) return '';
  const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  return d + ' Z';
}

export default function Canvas({ page }) {
  const wrapRef = useRef(null);

  // ── Tool state ──────────────────────────────────────────────────────────
  const [tool,        setTool]        = useState('select');
  const [penType,     setPenType]     = useState('normal');
  const [color,       setColor]       = useState('#111111');
  const [stroke,      setStroke]      = useState(2);
  const [stickyColor, setStickyColor] = useState('#FFD600');

  // ── Canvas state ────────────────────────────────────────────────────────
  const [transform,   setTransform]   = useState(() => page.canvas?.transform || { x: 0, y: 0, scale: 1 });
  const [elements,    setElements]    = useState(() => (page.canvas?.elements || []).filter(Boolean));
  const [draft,       setDraft]       = useState(null);
  const [selectedId,  setSelectedId]  = useState(null);
  const [editingId,   setEditingId]   = useState(null);
  const [editText,    setEditText]    = useState('');
  const [charSelection, setCharSelection] = useState(null);

  // ── History ────────────────────────────────────────────────────────────
  const historyRef = useRef([(page.canvas?.elements || []).filter(Boolean)]);
  const hIdxRef    = useRef(0);
  const [, forceUpdate] = useState(0);

  // ── Interaction refs ────────────────────────────────────────────────────
  const isPanningRef  = useRef(false);
  const panStartRef   = useRef(null);
  const dragRef       = useRef(null);
  const drawingRef    = useRef(false);
  const eraserActiveRef = useRef(false);
  const editorRef     = useRef(null);

  // ── Laser ───────────────────────────────────────────────────────────────
  const [laserPos,    setLaserPos]    = useState(null);
  const laserPointsRef = useRef([]);
  const [laserTrail,  setLaserTrail]  = useState([]);
  const laserRaf      = useRef(null);
  const laserActiveRef = useRef(false);

  // ── Sync page ───────────────────────────────────────────────────────────
  useEffect(() => {
    const els = (page.canvas?.elements || []).filter(Boolean);
    setElements(els);
    setTransform(page.canvas?.transform || { x: 0, y: 0, scale: 1 });
    historyRef.current = [els];
    hIdxRef.current    = 0;
    setSelectedId(null);
    setEditingId(null);
    setDraft(null);
    setLaserTrail([]);
    setLaserPos(null);
    laserPointsRef.current  = [];
    laserActiveRef.current  = false;
    drawingRef.current      = false;
    dragRef.current         = null;
    isPanningRef.current    = false;
  }, [page.id]); // eslint-disable-line

  // ── Focus editor on edit ────────────────────────────────────────────────
  useEffect(() => {
    if (editingId && editorRef.current) {
      editorRef.current.focus();
      editorRef.current.select();
    }
  }, [editingId]);

  // ── Persist (debounced) ─────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      actions.updatePage(page.id, {
        canvas: { ...(page.canvas || {}), elements, transform },
      });
    }, 300);
    return () => clearTimeout(t);
  }, [elements, transform]); // eslint-disable-line

  // ── Undo / redo (using refs to avoid stale closures) ───────────────────
  const snapshot = useCallback((next) => {
    const h = historyRef.current;
    const i = hIdxRef.current;
    const newH = h.slice(0, i + 1);
    newH.push(next);
    if (newH.length > 60) newH.shift();
    historyRef.current = newH;
    hIdxRef.current    = newH.length - 1;
    forceUpdate(n => n + 1);
  }, []);

  // ── Listen for externally added canvas elements (e.g. from Notes convert) ─
  useEffect(() => {
    const onAddElement = (e) => {
      if (e.detail && e.detail.pageId === page.id && e.detail.element) {
        const newEl = e.detail.element;
        setElements(prev => {
          const next = [...prev.filter(el => el && el.id !== newEl.id), newEl];
          snapshot(next);
          return next;
        });
        setSelectedId(newEl.id);
        setTool('select');
      }
    };
    window.addEventListener('inkwell:add-canvas-element', onAddElement);
    return () => window.removeEventListener('inkwell:add-canvas-element', onAddElement);
  }, [page.id, snapshot]);

  const undo = useCallback(() => {
    const i = hIdxRef.current;
    if (i > 0) {
      hIdxRef.current = i - 1;
      setElements(historyRef.current[i - 1] || []);
      forceUpdate(n => n + 1);
    }
  }, []);

  const redo = useCallback(() => {
    const i = hIdxRef.current;
    const h = historyRef.current;
    if (i < h.length - 1) {
      hIdxRef.current = i + 1;
      setElements(h[i + 1] || []);
      forceUpdate(n => n + 1);
    }
  }, []);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setElements(prev => {
      const next = prev.filter(el => el && el.id !== selectedId);
      snapshot(next);
      return next;
    });
    setSelectedId(null);
  }, [selectedId, snapshot]);

  // ── Character formatting & styling callbacks ──────────────────────────────
  const applyCharStyle = useCallback((stylePatch) => {
    if (!charSelection) return;
    const { elId, startIdx, endIdx } = charSelection;
    setElements(prev => {
      const next = prev.map(el => {
        if (el && el.id === elId && el.type === 'handwriting') {
          const charColors = { ...(el.charColors || {}) };
          const charStyles = { ...(el.charStyles || {}) };
          for (let i = startIdx; i <= endIdx; i++) {
            if (stylePatch.color !== undefined) {
              charColors[i] = stylePatch.color;
            }
            charStyles[i] = { ...(charStyles[i] || {}), ...stylePatch };
          }
          return { ...el, charColors, charStyles };
        }
        return el;
      });
      snapshot(next);
      return next;
    });
  }, [charSelection, snapshot]);

  const deleteSelectedChars = useCallback(() => {
    if (!charSelection) return;
    const { elId, startIdx, endIdx } = charSelection;
    setElements(prev => {
      return prev.map(el => {
        if (el && el.id === elId && el.type === 'handwriting') {
          const currentErased = new Set(el.erasedIndices || []);
          for (let i = startIdx; i <= endIdx; i++) {
            currentErased.add(i);
          }
          const textWithoutSpaces = (el.text || '').replace(/\s/g, '');
          if (currentErased.size >= textWithoutSpaces.length && textWithoutSpaces.length > 0) {
            return null;
          }
          return { ...el, erasedIndices: Array.from(currentErased) };
        }
        return el;
      }).filter(Boolean);
    });
    setCharSelection(null);
  }, [charSelection]);

  const handleColorChange = useCallback((newColor) => {
    setColor(newColor);
    if (charSelection) {
      applyCharStyle({ color: newColor });
    } else if (selectedId) {
      setElements(prev => {
        const next = prev.map(el => el && el.id === selectedId ? { ...el, color: newColor } : el);
        snapshot(next);
        return next;
      });
    }
  }, [charSelection, selectedId, applyCharStyle, snapshot]);

  // ── Track text / character selections inside canvas elements ─────────────
  useEffect(() => {
    const updateSelection = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setCharSelection(null);
        return;
      }
      const range = sel.getRangeAt(0);

      // 1. Direct span resolution
      const getSpanInfo = (node) => {
        if (!node) return null;
        const elem = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        const span = elem?.closest?.('[data-char-idx]');
        if (!span) return null;
        const elId = span.dataset.elid;
        const idx = parseInt(span.dataset.charIdx, 10);
        return isNaN(idx) || !elId ? null : { elId, idx, span };
      };

      const startInfo = getSpanInfo(range.startContainer);
      const endInfo = getSpanInfo(range.endContainer);

      let foundElId = null;
      let minIdx = Infinity;
      let maxIdx = -Infinity;

      if (startInfo && endInfo && startInfo.elId === endInfo.elId) {
        foundElId = startInfo.elId;
        minIdx = Math.min(startInfo.idx, endInfo.idx);
        maxIdx = Math.max(startInfo.idx, endInfo.idx);
      } else {
        // 2. Fallback: check intersecting char spans in container
        const common = range.commonAncestorContainer;
        const container = common?.nodeType === Node.ELEMENT_NODE ? common : common?.parentElement;
        const handwritingBlock = container?.closest?.('.handwriting-text-block') || container?.closest?.('[data-elid]');
        if (handwritingBlock) {
          const elId = handwritingBlock.dataset.elid;
          const spans = handwritingBlock.querySelectorAll('[data-char-idx]');
          spans.forEach(span => {
            if (sel.containsNode(span, true)) {
              const idx = parseInt(span.dataset.charIdx, 10);
              if (!isNaN(idx)) {
                foundElId = elId;
                if (idx < minIdx) minIdx = idx;
                if (idx > maxIdx) maxIdx = idx;
              }
            }
          });
        }
      }

      if (foundElId && isFinite(minIdx) && isFinite(maxIdx)) {
        const rect = range.getBoundingClientRect();
        setCharSelection({
          elId: foundElId,
          startIdx: minIdx,
          endIdx: maxIdx,
          rect: {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
          },
        });
        setSelectedId(foundElId);
      }
    };

    document.addEventListener('selectionchange', updateSelection);
    window.addEventListener('mouseup', updateSelection);
    window.addEventListener('pointerup', updateSelection);
    return () => {
      document.removeEventListener('selectionchange', updateSelection);
      window.removeEventListener('mouseup', updateSelection);
      window.removeEventListener('pointerup', updateSelection);
    };
  }, []);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault(); undo(); return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault(); redo(); return;
      }
      if (e.key === 'Escape') {
        setSelectedId(null); setEditingId(null); setDraft(null); return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        setElements(prev => {
          const next = prev.filter(el => el && el.id !== selectedId);
          snapshot(next);
          return next;
        });
        setSelectedId(null);
        return;
      }
      const map = { v: 'select', p: 'pen', r: 'rect', o: 'ellipse', l: 'line', a: 'arrow', t: 'text', n: 'sticky', e: 'eraser', h: 'hand', k: 'laser' };
      const t = map[e.key.toLowerCase()];
      if (t) setTool(t);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, selectedId, snapshot]);

  // ── Wheel zoom / pan ────────────────────────────────────────────────────
  const onWheel = useCallback((e) => {
    e.preventDefault();
    const rect = wrapRef.current.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) {
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.08 : 0.92;
      setTransform(t => {
        const newScale = Math.min(5, Math.max(0.05, t.scale * factor));
        const k = newScale / t.scale;
        return { scale: newScale, x: cx - (cx - t.x) * k, y: cy - (cy - t.y) * k };
      });
    } else {
      setTransform(t => ({ ...t, x: t.x - e.deltaX, y: t.y - e.deltaY }));
    }
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  // ── Canvas coordinate conversion ─────────────────────────────────────────
  const toCanvas = useCallback((clientX, clientY) => {
    const rect = wrapRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - transform.x) / transform.scale,
      y: (clientY - rect.top  - transform.y) / transform.scale,
    };
  }, [transform]);

  // ── Laser RAF loop ────────────────────────────────────────────────────────
  const runLaserLoop = useCallback(() => {
    const now = Date.now();
    const alive = laserPointsRef.current.filter(p => now - p.t < LASER_DECAY);
    laserPointsRef.current = alive;
    setLaserTrail([...alive]);
    if (alive.length > 0) {
      laserRaf.current = requestAnimationFrame(runLaserLoop);
    } else {
      laserRaf.current = null;
    }
  }, []);

  const addLaserPoint = useCallback((x, y) => {
    laserPointsRef.current.push({ x, y, t: Date.now() });
    if (!laserRaf.current) {
      laserRaf.current = requestAnimationFrame(runLaserLoop);
    }
  }, [runLaserLoop]);

  useEffect(() => () => { if (laserRaf.current) cancelAnimationFrame(laserRaf.current); }, []);

  // ── Character & Object Level Eraser ───────────────────────────────────────
  const eraseAtPoint = useCallback((clientX, clientY) => {
    const elem = document.elementFromPoint(clientX, clientY);
    if (!elem) return;

    // 1. Check if we hit a character inside a handwriting element
    const charNode = elem.closest('[data-char-idx]');
    if (charNode) {
      const elId = charNode.dataset.elid;
      const charIdx = parseInt(charNode.dataset.charIdx, 10);
      if (!isNaN(charIdx) && elId) {
        setElements(prev => {
          return prev.map(el => {
            if (el && el.id === elId && el.type === 'handwriting') {
              const currentErased = new Set(el.erasedIndices || []);
              if (!currentErased.has(charIdx)) {
                currentErased.add(charIdx);
                const textWithoutSpaces = (el.text || '').replace(/\s/g, '');
                if (currentErased.size >= textWithoutSpaces.length && textWithoutSpaces.length > 0) {
                  return null;
                }
                return { ...el, erasedIndices: Array.from(currentErased) };
              }
            }
            return el;
          }).filter(Boolean);
        });
        return;
      }
    }

    // 2. Check if we hit a line inside a handwriting element
    const lineNode = elem.closest('[data-line-idx]');
    if (lineNode && lineNode.dataset.elid) {
      const elId = lineNode.dataset.elid;
      const lineIdx = parseInt(lineNode.dataset.lineIdx, 10);
      if (!isNaN(lineIdx)) {
        setElements(prev => {
          return prev.map(el => {
            if (el && el.id === elId && el.type === 'handwriting') {
              const lines = (el.text || '').split('\n');
              if (lineIdx >= 0 && lineIdx < lines.length) {
                let startIdx = 0;
                for (let i = 0; i < lineIdx; i++) {
                  startIdx += lines[i].length + 1;
                }
                const endIdx = startIdx + lines[lineIdx].length;
                const currentErased = new Set(el.erasedIndices || []);
                for (let c = startIdx; c <= endIdx; c++) {
                  currentErased.add(c);
                }
                const textWithoutSpaces = (el.text || '').replace(/\s/g, '');
                if (currentErased.size >= textWithoutSpaces.length && textWithoutSpaces.length > 0) {
                  return null;
                }
                return { ...el, erasedIndices: Array.from(currentErased) };
              }
            }
            return el;
          }).filter(Boolean);
        });
        return;
      }
    }

    // 3. Fallback for other canvas objects (strokes, shapes, stickies, images)
    const elNode = elem.closest('[data-elid]');
    const elId = elNode?.dataset?.elid;
    if (elId) {
      setElements(prev => {
        const targetEl = prev.find(el => el && el.id === elId);
        if (targetEl && targetEl.type === 'handwriting') {
          return prev; // Don't wipe the whole handwriting block unless it's empty
        }
        return prev.filter(el => el && el.id !== elId);
      });
    }
  }, []);

  // ── Pointer down ─────────────────────────────────────────────────────────
  const onPointerDown = useCallback((e) => {
    if (e.button !== 0) return;

    // Prevent firing on toolbar buttons or inline editor inputs/textareas
    if (e.target.closest('[data-toolbar]') || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const currentTool = tool;

    // Hand / shift-drag panning
    if (currentTool === 'hand' || e.shiftKey) {
      isPanningRef.current = true;
      panStartRef.current  = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    const { x, y } = toCanvas(e.clientX, e.clientY);

    // Laser
    if (currentTool === 'laser') {
      laserActiveRef.current = true;
      laserPointsRef.current = [];
      addLaserPoint(x, y);
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    // Use closest() to find data-elid — handles <g> wrappers (sticky, arrow, etc.)
    const elNode = e.target?.closest('[data-elid]');
    const elId   = elNode?.dataset?.elid;

    // Select / drag
    if (currentTool === 'select') {
      if (elId) {
        if (e.detail === 2) {
          const el = elements.find(q => q && q.id === elId);
          if (el && (el.type === 'text' || el.type === 'sticky' || el.type === 'handwriting')) {
            setEditingId(el.id);
            setEditText(el.text || '');
            setSelectedId(el.id);
            return;
          }
        }
        setSelectedId(elId);

        const targetEl = elements.find(q => q && q.id === elId);
        const isHandwritingCharClick = targetEl?.type === 'handwriting' && (
          e.target.closest('[data-char-idx]') ||
          e.target.closest('[data-line-idx]') ||
          e.target.closest('.handwriting-text-block')
        );

        if (!isHandwritingCharClick) {
          setElements(prev => {
            const el = prev.find(q => q && q.id === elId);
            if (el) {
              dragRef.current = { id: elId, startX: x, startY: y, orig: JSON.parse(JSON.stringify(el)) };
            }
            return prev;
          });
          e.currentTarget.setPointerCapture(e.pointerId);
        }
      } else {
        setSelectedId(null);
        setCharSelection(null);
        window.getSelection()?.removeAllRanges();
      }
      return;
    }

    // Eraser — erase character or element on click and activate drag-erase
    if (currentTool === 'eraser') {
      eraserActiveRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      eraseAtPoint(e.clientX, e.clientY);
      return;
    }

    // Pen drawing
    if (currentTool === 'pen') {
      drawingRef.current = true;
      setDraft({
        id: uid(), type: 'pen',
        points: [[x, y]],
        color, strokeWidth: stroke, penType,
        opacity: PEN_PRESETS[penType]?.opacity ?? 1,
      });
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    // Text
    if (currentTool === 'text') {
      const newEl = { id: uid(), type: 'text', x, y, text: 'Double-click to edit', color, fontSize: 18, font: 'body' };
      setElements(prev => { const next = [...prev, newEl]; snapshot(next); return next; });
      setEditingId(newEl.id);
      setEditText('Double-click to edit');
      setSelectedId(newEl.id);
      setTool('select');
      return;
    }

    // Sticky note
    if (currentTool === 'sticky') {
      const newEl = { id: uid(), type: 'sticky', x: x - 90, y: y - 60, w: 180, h: 120, text: 'Note…', color: stickyColor };
      setElements(prev => { const next = [...prev, newEl]; snapshot(next); return next; });
      setEditingId(newEl.id);
      setEditText('Note…');
      setSelectedId(newEl.id);
      setTool('select');
      return;
    }

    // Shape tools
    if (SHAPE_TOOLS.includes(currentTool)) {
      let newEl;
      if (currentTool === 'rect')    newEl = { id: uid(), type: 'rect',    x, y, w: 0, h: 0, color, strokeWidth: stroke, fill: 'transparent', radius: 8 };
      if (currentTool === 'ellipse') newEl = { id: uid(), type: 'ellipse', x, y, w: 0, h: 0, color, strokeWidth: stroke, fill: 'transparent' };
      if (currentTool === 'line')    newEl = { id: uid(), type: 'line',    x1: x, y1: y, x2: x, y2: y, color, strokeWidth: stroke };
      if (currentTool === 'arrow')   newEl = { id: uid(), type: 'arrow',   x1: x, y1: y, x2: x, y2: y, color, strokeWidth: stroke };
      if (newEl) {
        setDraft(newEl);
        e.currentTarget.setPointerCapture(e.pointerId);
      }
    }
  }, [tool, transform, toCanvas, color, stroke, penType, stickyColor, snapshot, addLaserPoint]);

  // ── Pointer move ─────────────────────────────────────────────────────────
  const onPointerMove = useCallback((e) => {
    // Panning
    if (isPanningRef.current && panStartRef.current) {
      const { x, y, tx, ty } = panStartRef.current;
      setTransform(t => ({ ...t, x: tx + (e.clientX - x), y: ty + (e.clientY - y) }));
      return;
    }

    const rect = wrapRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { x, y } = toCanvas(e.clientX, e.clientY);

    // Laser
    if (tool === 'laser') {
      setLaserPos({ x: sx, y: sy });
      if (laserActiveRef.current) addLaserPoint(x, y);
      return;
    }

    // Eraser drag — erase whatever character or element we move over
    if (tool === 'eraser' && eraserActiveRef.current) {
      eraseAtPoint(e.clientX, e.clientY);
      return;
    }

    // Dragging element
    if (dragRef.current) {
      const dx = x - dragRef.current.startX;
      const dy = y - dragRef.current.startY;
      const orig = dragRef.current.orig;
      setElements(prev => prev.map(el => {
        if (!el || el.id !== dragRef.current?.id) return el;
        if (['rect', 'ellipse', 'sticky', 'text', 'handwriting', 'image'].includes(el.type)) return { ...el, x: orig.x + dx, y: orig.y + dy };
        if (['line', 'arrow'].includes(el.type)) return { ...el, x1: orig.x1 + dx, y1: orig.y1 + dy, x2: orig.x2 + dx, y2: orig.y2 + dy };
        if (el.type === 'pen') return { ...el, points: orig.points.map(([px, py]) => [px + dx, py + dy]) };
        return el;
      }));
      return;
    }

    // Drawing
    if (!draft) return;
    if (draft.type === 'pen' && drawingRef.current) {
      setDraft(d => ({ ...d, points: [...d.points, [x, y]] }));
    } else if (['rect', 'ellipse'].includes(draft.type)) {
      setDraft(d => ({ ...d, w: x - d.x, h: y - d.y }));
    } else if (['line', 'arrow'].includes(draft.type)) {
      setDraft(d => ({ ...d, x2: x, y2: y }));
    }
  }, [tool, toCanvas, draft, addLaserPoint]);

  // ── Pointer up ───────────────────────────────────────────────────────────
  const onPointerUp = useCallback((e) => {
    // Panning ended
    if (isPanningRef.current) {
      isPanningRef.current = false;
      panStartRef.current  = null;
      return;
    }

    // Laser ended
    if (tool === 'laser') {
      laserActiveRef.current = false;
      return;
    }

    // Eraser ended — snapshot after the full drag
    if (eraserActiveRef.current) {
      eraserActiveRef.current = false;
      setElements(prev => { snapshot(prev); return prev; });
      return;
    }

    // Drag ended
    if (dragRef.current) {
      setElements(prev => { snapshot(prev); return prev; });
      dragRef.current = null;
      return;
    }

    // Drawing ended
    if (draft) {
      drawingRef.current = false;
      let d = { ...draft };

      if (['rect', 'ellipse'].includes(d.type)) {
        if (d.w < 0) { d.x += d.w; d.w = -d.w; }
        if (d.h < 0) { d.y += d.h; d.h = -d.h; }
        if (d.w < 3 && d.h < 3) { setDraft(null); return; }
      }

      if (d.type === 'pen' && d.points.length < 2) { setDraft(null); return; }

      setElements(prev => { const next = [...prev, d]; snapshot(next); return next; });
      setDraft(null);
    }
  }, [tool, draft, snapshot]);

  const onPointerLeave = useCallback(() => {
    setLaserPos(null);
    if (laserActiveRef.current) laserActiveRef.current = false;
  }, []);

  // ── Element renderer ─────────────────────────────────────────────────────
  const renderElement = useCallback((el, isDraft = false) => {
    if (!el) return null;

    // Hide the element while editing so it doesn't double-render with the input overlay
    if (!isDraft && el.id === editingId) return null;

    const key = isDraft ? `draft-${el.id}` : el.id;
    const isSelected = !isDraft && el.id === selectedId;

    const interactProps = isDraft ? {} : {
      'data-elid': el.id,
      style: { cursor: tool === 'select' ? 'move' : tool === 'eraser' ? 'crosshair' : undefined },
    };

    if (el.type === 'pen') {
      const outline = strokeOutline(el.points, el.penType || 'normal', el.strokeWidth || 2);
      const d = outlineToPath(outline);
      if (!d) return null;
      const blend = el.penType === 'highlighter' ? { mixBlendMode: 'multiply' } : {};
      return (
        <path
          key={key}
          {...interactProps}
          style={{ ...(interactProps.style || {}), ...blend }}
          d={d}
          fill={el.color || '#000'}
          opacity={el.opacity ?? 1}
        />
      );
    }

    if (el.type === 'rect') {
      return (
        <rect key={key} {...interactProps}
          x={el.x} y={el.y} width={Math.abs(el.w)} height={Math.abs(el.h)}
          rx={el.radius || 0}
          stroke={el.color} strokeWidth={el.strokeWidth}
          fill={el.fill || 'transparent'}
        />
      );
    }

    if (el.type === 'ellipse') {
      return (
        <ellipse key={key} {...interactProps}
          cx={el.x + el.w / 2} cy={el.y + el.h / 2}
          rx={Math.abs(el.w) / 2} ry={Math.abs(el.h) / 2}
          stroke={el.color} strokeWidth={el.strokeWidth}
          fill={el.fill || 'transparent'}
        />
      );
    }

    if (el.type === 'line') {
      return (
        <line key={key} {...interactProps}
          x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2}
          stroke={el.color} strokeWidth={el.strokeWidth}
          strokeLinecap="round"
        />
      );
    }

    if (el.type === 'arrow') {
      const markerId = `arrow-${el.id}`;
      return (
        <g key={key} {...interactProps}>
          <defs>
            <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={el.color} />
            </marker>
          </defs>
          <line
            x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2}
            stroke={el.color} strokeWidth={el.strokeWidth}
            strokeLinecap="round"
            markerEnd={`url(#${markerId})`}
          />
        </g>
      );
    }

    if (el.type === 'text') {
      const family = el.font === 'display' ? 'Outfit, sans-serif'
                   : el.font === 'hand'    ? 'Caveat, cursive'
                   : 'IBM Plex Sans, sans-serif';
      return (
        <text key={key} {...interactProps}
          x={el.x} y={el.y + (el.fontSize || 18)}
          fontSize={el.fontSize || 18}
          fill={el.color}
          fontFamily={family}
          style={{ userSelect: 'none', ...(interactProps.style || {}) }}
        >
          {el.text}
        </text>
      );
    }

    if (el.type === 'sticky') {
      return (
        <g key={key} {...interactProps}>
          <rect x={el.x} y={el.y} width={el.w} height={el.h}
            fill={el.color} rx={8} opacity={0.95}
            stroke="rgba(0,0,0,0.08)" strokeWidth={1}
          />
          <foreignObject x={el.x + 8} y={el.y + 6} width={el.w - 16} height={el.h - 12}>
            <div xmlns="http://www.w3.org/1999/xhtml" style={{
              fontFamily: 'Caveat, cursive', fontSize: 20, lineHeight: 1.3,
              color: '#111', whiteSpace: 'pre-wrap', overflow: 'hidden', height: '100%',
              pointerEvents: 'none',
            }}>
              {el.text}
            </div>
          </foreignObject>
        </g>
      );
    }

    if (el.type === 'handwriting') {
      const fontFam = el.fontFamily || 'Caveat';
      const width = el.maxWidth || el.width || 400;
      const height = el.height || 180;
      const lines = (el.text || '').split('\n');
      const erasedSet = new Set(el.erasedIndices || []);
      const charColors = el.charColors || {};
      const charStyles = el.charStyles || {};
      let cumulativeCharIndex = 0;

      return (
        <g key={key} {...interactProps}>
          <foreignObject
            x={el.x}
            y={el.y}
            width={width + 30}
            height={height + 40}
            style={{ overflow: 'visible', pointerEvents: 'auto' }}
          >
            <div
              xmlns="http://www.w3.org/1999/xhtml"
              data-elid={el.id}
              className="handwriting-text-block"
              style={{
                fontFamily: `"${fontFam}", cursive, sans-serif`,
                fontSize: `${el.fontSize || 28}px`,
                lineHeight: 1.35,
                color: el.color || '#111111',
                textAlign: el.align || 'left',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                width: `${width}px`,
                userSelect: tool === 'select' ? 'text' : 'none',
                WebkitUserSelect: tool === 'select' ? 'text' : 'none',
                touchAction: 'auto',
                padding: '4px',
                pointerEvents: 'auto',
                cursor: tool === 'eraser' ? 'crosshair' : tool === 'select' ? 'text' : undefined,
              }}
            >
              {lines.map((line, lineIdx) => {
                const lineStartCharIdx = cumulativeCharIndex;
                cumulativeCharIndex += line.length + 1; // account for newline
                return (
                  <div
                    key={lineIdx}
                    data-elid={el.id}
                    data-line-idx={lineIdx}
                    style={{ minHeight: '1.2em' }}
                  >
                    {line.length === 0 ? (
                      <span data-elid={el.id} data-char-idx={lineStartCharIdx}>&nbsp;</span>
                    ) : (
                      line.split('').map((char, cIdx) => {
                        const absIdx = lineStartCharIdx + cIdx;
                        const isErased = erasedSet.has(absIdx);
                        const cColor = charColors[absIdx] || el.color || '#111111';
                        const cStyle = charStyles[absIdx] || {};
                        const isCharSelected = charSelection && charSelection.elId === el.id && absIdx >= charSelection.startIdx && absIdx <= charSelection.endIdx;

                        return (
                          <span
                            key={cIdx}
                            data-elid={el.id}
                            data-char-idx={absIdx}
                            style={{
                              display: 'inline',
                              visibility: isErased ? 'hidden' : 'visible',
                              color: cColor,
                              fontWeight: cStyle.bold ? 'bold' : undefined,
                              fontStyle: cStyle.italic ? 'italic' : undefined,
                              textDecoration: cStyle.underline ? 'underline' : undefined,
                              backgroundColor: cStyle.highlight || undefined,
                              borderRadius: cStyle.highlight ? '2px' : undefined,
                              userSelect: tool === 'select' ? 'text' : 'none',
                            }}
                          >
                            {char}
                          </span>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>
          </foreignObject>
        </g>
      );
    }

    if (el.type === 'image') {
      return (
        <image
          key={key}
          {...interactProps}
          href={el.dataURL}
          x={el.x}
          y={el.y}
          width={el.w}
          height={el.h}
          style={{ userSelect: 'none', ...(interactProps.style || {}) }}
        />
      );
    }

    return null;
  }, [tool, selectedId, charSelection]);

  // ── Selection box ─────────────────────────────────────────────────────────
  const selectionBox = useMemo(() => {
    if (!selectedId) return null;
    const el = elements.find(e => e && e.id === selectedId);
    if (!el || el.type === 'handwriting') return null;
    let bbox;
    if (['rect', 'ellipse', 'sticky'].includes(el.type)) bbox = { x: el.x, y: el.y, w: Math.abs(el.w), h: Math.abs(el.h) };
    else if (['line', 'arrow'].includes(el.type)) {
      const minX = Math.min(el.x1, el.x2), minY = Math.min(el.y1, el.y2);
      bbox = { x: minX, y: minY, w: Math.abs(el.x2 - el.x1), h: Math.abs(el.y2 - el.y1) };
    }
    else if (el.type === 'text') bbox = { x: el.x - 2, y: el.y, w: (el.text?.length || 1) * (el.fontSize || 18) * 0.55, h: (el.fontSize || 18) + 8 };
    else if (el.type === 'image') bbox = { x: el.x - 2, y: el.y - 2, w: (el.w || 200) + 4, h: (el.h || 150) + 4 };
    else if (el.type === 'pen') {
      const xs = el.points.map(p => p[0]), ys = el.points.map(p => p[1]);
      bbox = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    }
    if (!bbox) return null;
    const pad = 8;
    return <rect className="selection-marquee" x={bbox.x - pad} y={bbox.y - pad} width={bbox.w + pad * 2} height={bbox.h + pad * 2} rx={5} pointerEvents="none" />;
  }, [selectedId, elements]);

  // ── Laser SVG ─────────────────────────────────────────────────────────────
  const laserSvg = useMemo(() => {
    if (laserTrail.length < 2) return null;
    const d = laserTrail.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const s = transform.scale;
    return (
      <g>
        <path d={d} stroke="#FF3300" strokeWidth={12 / s} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.15} />
        <path d={d} stroke="#FF4422" strokeWidth={5 / s}  fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.80} className="laser-trail" />
        <path d={d} stroke="#FF9977" strokeWidth={2 / s}  fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={1.00} />
      </g>
    );
  }, [laserTrail, transform.scale]);

  // ── Grid ─────────────────────────────────────────────────────────────────
  const gridSize    = 24 * transform.scale;
  const gridOffsetX = ((transform.x % gridSize) + gridSize) % gridSize;
  const gridOffsetY = ((transform.y % gridSize) + gridSize) % gridSize;
  const backdrop    = page.canvas?.backdrop;

  const hIdx    = hIdxRef.current;
  const history = historyRef.current;

  const cursor =
    tool === 'hand'   ? (isPanningRef.current ? 'grabbing' : 'grab') :
    tool === 'select' ? 'default' :
    tool === 'laser'  ? 'none' :
    'crosshair';

  return (
    <div
      ref={wrapRef}
      data-testid="canvas-layer"
      className="absolute inset-0 overflow-hidden dot-grid no-select"
      style={{
        '--grid-size':     `${gridSize}px`,
        '--grid-offset-x': `${gridOffsetX}px`,
        '--grid-offset-y': `${gridOffsetY}px`,
        cursor,
        touchAction: 'none',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
    >
      {/* ── Main SVG canvas ── */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ overflow: 'visible', pointerEvents: 'none' }}
      >
        <g
          transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}
          style={{ pointerEvents: 'all' }}
        >
          {/* PDF backdrop */}
          {backdrop?.dataURL && (
            <image
              href={backdrop.dataURL}
              x={0} y={0}
              width={backdrop.width}
              height={backdrop.height}
              opacity={0.97}
              style={{ pointerEvents: 'none' }}
            />
          )}

          {/* Committed elements */}
          {elements.map(el => renderElement(el, false))}

          {/* Draft (being drawn) */}
          {draft && renderElement(draft, true)}

          {/* Selection marquee */}
          {selectionBox}

          {/* Laser trail */}
          {laserSvg}
        </g>
      </svg>

      {/* ── Laser dot (screen space) ── */}
      {tool === 'laser' && laserPos && (
        <div
          className="absolute pointer-events-none"
          style={{ left: laserPos.x, top: laserPos.y, transform: 'translate(-50%,-50%)', zIndex: 50 }}
        >
          {/* Ping ring */}
          <div className="absolute rounded-full laser-dot-ping" style={{ width: 24, height: 24, top: -12, left: -12, background: 'rgba(255,51,0,0.3)' }} />
          {/* Core dot */}
          <div className="relative w-4 h-4 rounded-full" style={{
            background: 'radial-gradient(circle at 35% 35%, #FF9966, #FF2200)',
            boxShadow: '0 0 12px 4px rgba(255,51,0,0.75), 0 0 28px 8px rgba(255,51,0,0.3)',
          }} />
        </div>
      )}

      {/* ── Inline text editor ── */}
      {editingId && (() => {
        const el = elements.find(e => e && e.id === editingId);
        if (!el) return null;
        const sx = el.x * transform.scale + transform.x;
        const sy = el.y * transform.scale + transform.y;

        if (el.type === 'text') {
          return (
            <input
              ref={editorRef}
              key={`editor-${el.id}`}
              autoFocus
              value={editText}
              onChange={e => setEditText(e.target.value)}
              onBlur={() => {
                setElements(prev => {
                  const next = prev.map(q => q && q.id === el.id ? { ...q, text: editText || 'Text' } : q);
                  snapshot(next);
                  return next;
                });
                setEditingId(null);
              }}
              onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditingId(null); }}
              className="absolute bg-transparent outline-none border border-primary/60 rounded px-1"
              style={{ left: sx, top: sy, fontSize: (el.fontSize || 18) * transform.scale, color: el.color,
                fontFamily: el.font === 'display' ? 'Outfit' : el.font === 'hand' ? 'Caveat' : 'IBM Plex Sans', minWidth: 80,
                userSelect: 'text', WebkitUserSelect: 'text' }}
            />
          );
        }

        if (el.type === 'sticky') {
          return (
            <textarea
              ref={editorRef}
              key={`editor-${el.id}`}
              autoFocus
              value={editText}
              onChange={e => setEditText(e.target.value)}
              onBlur={() => {
                setElements(prev => {
                  const next = prev.map(q => q && q.id === el.id ? { ...q, text: editText } : q);
                  snapshot(next);
                  return next;
                });
                setEditingId(null);
              }}
              onKeyDown={e => { if (e.key === 'Escape') setEditingId(null); }}
              className="absolute resize-none outline-none p-2 rounded-xl"
              style={{ left: sx, top: sy, width: el.w * transform.scale, height: el.h * transform.scale,
                background: el.color, color: '#111', fontFamily: 'Caveat, cursive',
                fontSize: 20 * transform.scale, lineHeight: 1.3,
                userSelect: 'text', WebkitUserSelect: 'text' }}
            />
          );
        }

        if (el.type === 'handwriting') {
          return (
            <textarea
              ref={editorRef}
              key={`editor-${el.id}`}
              autoFocus
              value={editText}
              onChange={e => setEditText(e.target.value)}
              onBlur={() => {
                setElements(prev => {
                  const next = prev.map(q => q && q.id === el.id ? { ...q, text: editText || 'Handwriting' } : q);
                  snapshot(next);
                  return next;
                });
                setEditingId(null);
              }}
              onKeyDown={e => { if (e.key === 'Escape') setEditingId(null); }}
              className="absolute resize-none outline-none p-2 rounded-xl bg-background/95 backdrop-blur-md border border-amber-500 shadow-xl"
              style={{
                left: sx,
                top: sy,
                width: ((el.maxWidth || el.width || 400) + 16) * transform.scale,
                minHeight: ((el.height || 100) + 20) * transform.scale,
                color: el.color || '#111111',
                fontFamily: `"${el.fontFamily || 'Caveat'}", cursive, sans-serif`,
                fontSize: (el.fontSize || 28) * transform.scale,
                lineHeight: 1.35,
                textAlign: el.align || 'left',
                userSelect: 'text',
                WebkitUserSelect: 'text',
              }}
            />
          );
        }
        return null;
      })()}

      {/* ── Single Unified Floating Action Bar ── */}
      {(() => {
        // Only show if characters are actively selected, or if a non-handwriting object is selected
        if (!charSelection && (!selectedId || elements.find(e => e && e.id === selectedId)?.type === 'handwriting')) {
          return null;
        }

        const targetId = charSelection?.elId || selectedId;
        const el = elements.find(e => e && e.id === targetId);
        if (!el) return null;

        let posX = 0;
        let posY = 0;

        if (charSelection) {
          const { rect } = charSelection;
          const containerRect = wrapRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
          posX = rect.left - containerRect.left + rect.width / 2;
          posY = rect.top - containerRect.top - 44;
        } else {
          let bbox;
          if (['rect', 'ellipse', 'sticky'].includes(el.type)) bbox = { x: el.x, y: el.y, w: Math.abs(el.w), h: Math.abs(el.h) };
          else if (['line', 'arrow'].includes(el.type)) bbox = { x: Math.min(el.x1, el.x2), y: Math.min(el.y1, el.y2), w: Math.abs(el.x2 - el.x1), h: Math.abs(el.y2 - el.y1) };
          else if (el.type === 'text') bbox = { x: el.x - 2, y: el.y, w: (el.text?.length || 1) * (el.fontSize || 18) * 0.55, h: (el.fontSize || 18) + 8 };
          else if (el.type === 'handwriting') bbox = { x: el.x - 4, y: el.y - 4, w: (el.maxWidth || el.width || 300) + 16, h: (el.height || 100) + 20 };
          else if (el.type === 'image') bbox = { x: el.x - 2, y: el.y - 2, w: (el.w || 200) + 4, h: (el.h || 150) + 4 };
          else if (el.type === 'pen') {
            const xs = el.points.map(p => p[0]), ys = el.points.map(p => p[1]);
            bbox = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
          }
          if (!bbox) return null;
          posX = (bbox.x + bbox.w / 2) * transform.scale + transform.x;
          posY = bbox.y * transform.scale + transform.y - 44;
        }

        const isHandwriting = el.type === 'handwriting';
        const isBold = charSelection
          ? el.charStyles?.[charSelection.startIdx]?.bold
          : false;
        const isItalic = charSelection
          ? el.charStyles?.[charSelection.startIdx]?.italic
          : false;
        const isHighlight = charSelection
          ? el.charStyles?.[charSelection.startIdx]?.highlight
          : false;

        const handleDelete = () => {
          if (charSelection) {
            deleteSelectedChars();
          } else {
            deleteSelected();
          }
        };

        const toggleBold = () => {
          if (charSelection) {
            applyCharStyle({ bold: !isBold });
          } else if (isHandwriting) {
            const textLen = (el.text || '').length;
            setElements(prev => {
              const next = prev.map(q => {
                if (q && q.id === el.id) {
                  const charStyles = { ...(q.charStyles || {}) };
                  for (let i = 0; i < textLen; i++) {
                    charStyles[i] = { ...(charStyles[i] || {}), bold: !isBold };
                  }
                  return { ...q, charStyles };
                }
                return q;
              });
              snapshot(next);
              return next;
            });
          }
        };

        const toggleItalic = () => {
          if (charSelection) {
            applyCharStyle({ italic: !isItalic });
          } else if (isHandwriting) {
            const textLen = (el.text || '').length;
            setElements(prev => {
              const next = prev.map(q => {
                if (q && q.id === el.id) {
                  const charStyles = { ...(q.charStyles || {}) };
                  for (let i = 0; i < textLen; i++) {
                    charStyles[i] = { ...(charStyles[i] || {}), italic: !isItalic };
                  }
                  return { ...q, charStyles };
                }
                return q;
              });
              snapshot(next);
              return next;
            });
          }
        };

        const toggleHighlight = () => {
          if (charSelection) {
            applyCharStyle({ highlight: isHighlight ? null : 'rgba(255, 214, 0, 0.35)' });
          } else if (isHandwriting) {
            const textLen = (el.text || '').length;
            setElements(prev => {
              const next = prev.map(q => {
                if (q && q.id === el.id) {
                  const charStyles = { ...(q.charStyles || {}) };
                  for (let i = 0; i < textLen; i++) {
                    charStyles[i] = { ...(charStyles[i] || {}), highlight: isHighlight ? null : 'rgba(255, 214, 0, 0.35)' };
                  }
                  return { ...q, charStyles };
                }
                return q;
              });
              snapshot(next);
              return next;
            });
          }
        };

        return (
          <div
            data-toolbar="true"
            className="absolute z-40 flex items-center gap-1.5 px-2.5 py-1 bg-card/95 text-card-foreground border border-border shadow-2xl rounded-2xl backdrop-blur-xl -translate-x-1/2 select-none animate-in fade-in zoom-in-95 duration-150"
            style={{
              left: Math.max(140, Math.min(window.innerWidth - 160, posX)),
              top: Math.max(16, posY),
            }}
          >
            {/* Move handle */}
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-foreground/80 hover:text-foreground hover:bg-muted/80 rounded-lg cursor-grab active:cursor-grabbing transition-colors"
              title={charSelection ? "Drag to move selected text" : "Drag to move entire element"}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                const { x, y } = toCanvas(e.clientX, e.clientY);

                if (charSelection && el.type === 'handwriting') {
                  const { startIdx, endIdx, rect } = charSelection;
                  const fullText = el.text || '';
                  const selectedText = fullText.slice(startIdx, endIdx + 1);

                  // Copy styles and colors for the slice
                  const newCharColors = {};
                  const newCharStyles = {};
                  for (let i = startIdx; i <= endIdx; i++) {
                    if (el.charColors?.[i]) newCharColors[i - startIdx] = el.charColors[i];
                    if (el.charStyles?.[i]) newCharStyles[i - startIdx] = el.charStyles[i];
                  }

                  const wrapRect = wrapRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
                  const canvasX = (rect.left - wrapRect.left - transform.x) / transform.scale;
                  const canvasY = (rect.top - wrapRect.top - transform.y) / transform.scale;
                  const canvasWidth = rect.width / transform.scale;
                  const canvasHeight = rect.height / transform.scale;

                  const newId = uid();
                  const newEl = {
                    id: newId,
                    type: 'handwriting',
                    x: canvasX,
                    y: canvasY,
                    width: Math.max(canvasWidth + 20, 100),
                    maxWidth: Math.max(canvasWidth + 20, 100),
                    height: Math.max(canvasHeight + 10, 40),
                    text: selectedText,
                    fontFamily: el.fontFamily,
                    fontSize: el.fontSize,
                    color: el.color,
                    align: el.align,
                    charColors: newCharColors,
                    charStyles: newCharStyles,
                    erasedIndices: [],
                  };

                  const updatedOrigErased = new Set(el.erasedIndices || []);
                  for (let i = startIdx; i <= endIdx; i++) {
                    updatedOrigErased.add(i);
                  }

                  const textWithoutSpaces = fullText.replace(/\s/g, '');
                  const shouldRemoveOrig = updatedOrigErased.size >= textWithoutSpaces.length && textWithoutSpaces.length > 0;

                  setElements(prev => {
                    let next = prev.map(q => {
                      if (q && q.id === el.id) {
                        return shouldRemoveOrig ? null : { ...q, erasedIndices: Array.from(updatedOrigErased) };
                      }
                      return q;
                    }).filter(Boolean);
                    next = [...next, newEl];
                    snapshot(next);
                    return next;
                  });

                  dragRef.current = { id: newId, startX: x, startY: y, orig: JSON.parse(JSON.stringify(newEl)) };
                  setSelectedId(newId);
                  setCharSelection(null);
                  window.getSelection()?.removeAllRanges();
                  wrapRef.current?.setPointerCapture(e.pointerId);
                } else {
                  dragRef.current = { id: el.id, startX: x, startY: y, orig: JSON.parse(JSON.stringify(el)) };
                  wrapRef.current?.setPointerCapture(e.pointerId);
                }
              }}
            >
              <Move className="w-3.5 h-3.5 text-primary" />
              <span>Move</span>
            </div>

            {isHandwriting && (
              <>
                <div className="w-px h-3.5 bg-border mx-0.5" />

                {/* Bold */}
                <button
                  type="button"
                  title="Toggle Bold"
                  onClick={toggleBold}
                  className={`p-1 rounded-lg hover:bg-muted font-bold text-xs w-6 h-6 flex items-center justify-center transition-colors ${isBold ? 'bg-primary/15 text-primary' : ''}`}
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>

                {/* Italic */}
                <button
                  type="button"
                  title="Toggle Italic"
                  onClick={toggleItalic}
                  className={`p-1 rounded-lg hover:bg-muted italic text-xs w-6 h-6 flex items-center justify-center transition-colors ${isItalic ? 'bg-primary/15 text-primary' : ''}`}
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>

                {/* Highlight */}
                <button
                  type="button"
                  title="Yellow Highlight"
                  onClick={toggleHighlight}
                  className={`p-1 rounded-lg hover:bg-muted text-xs w-6 h-6 flex items-center justify-center transition-colors ${isHighlight ? 'bg-amber-400/20 text-amber-500' : 'text-amber-500'}`}
                >
                  <Highlighter className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            <div className="w-px h-3.5 bg-border mx-0.5" />

            {/* Single Delete / Erase button */}
            <button
              type="button"
              data-testid="selection-delete-btn"
              title={charSelection ? "Erase selected characters" : "Delete selected item (Del / Backspace)"}
              onClick={handleDelete}
              className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
              <span>{charSelection ? 'Erase' : 'Delete'}</span>
            </button>

            {/* Close / Deselect */}
            <button
              type="button"
              title="Deselect"
              onClick={() => {
                setCharSelection(null);
                setSelectedId(null);
              }}
              className="p-1 rounded-lg hover:bg-muted text-muted-foreground transition-colors ml-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })()}

      {/* ── Toolbar (data-toolbar attr prevents pointer-down from triggering canvas) ── */}
      <div data-toolbar="true">
        <CanvasToolbar
          tool={tool}               setTool={setTool}
          penType={penType}         setPenType={setPenType}
          color={color}             setColor={handleColorChange}
          stroke={stroke}           setStroke={setStroke}
          stickyColor={stickyColor} setStickyColor={setStickyColor}
          onUndo={undo}             onRedo={redo}
          canUndo={hIdx > 0}        canRedo={hIdx < history.length - 1}
          onZoomIn={()    => setTransform(t => ({ ...t, scale: Math.min(5,    t.scale * 1.2) }))}
          onZoomOut={()   => setTransform(t => ({ ...t, scale: Math.max(0.05, t.scale / 1.2) }))}
          onZoomReset={() => setTransform({ x: 0, y: 0, scale: 1 })}
          zoom={transform.scale}
          onDeleteSelected={deleteSelected}
          selectedElement={elements.find(e => e && e.id === selectedId)}
          onClear={() => {
            if (window.confirm('Clear all elements on this page?')) {
              setElements([]);
              snapshot([]);
            }
          }}
        />
      </div>
    </div>
  );
}