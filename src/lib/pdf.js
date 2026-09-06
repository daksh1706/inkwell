// PDF import/export helpers
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import { getStroke } from 'perfect-freehand';

// Use CDN worker so we don't need to configure worker URL locally
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

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

/**
 * Convert a PDF File into an array of { dataURL, width, height } — one per page.
 */
export async function pdfFileToPages(file, scale = 1.5) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    pages.push({
      dataURL: canvas.toDataURL('image/png'),
      width: canvas.width,
      height: canvas.height,
    });
  }
  return pages;
}

/**
 * Render a canvas page (backdrop + SVG elements) to a PNG dataURL.
 * Used for building PDF export images.
 */
export async function pageToImage(page, width = 1200, height = 850) {
  const backdrop = page.canvas?.backdrop;
  
  // Use backdrop dimensions if available to preserve exact quality and aspect ratio
  const exportWidth = backdrop?.width || width;
  const exportHeight = backdrop?.height || height;

  const canvas = document.createElement('canvas');
  canvas.width = exportWidth;
  canvas.height = exportHeight;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, exportWidth, exportHeight);

  // Draw backdrop (e.g. imported PDF page) at 1:1 scale
  if (backdrop?.dataURL) {
    await new Promise((res) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, exportWidth, exportHeight);
        res();
      };
      img.onerror = res;
      img.src = backdrop.dataURL;
    });
  }

  // Rasterise canvas elements as SVG
  const elements = (page.canvas?.elements || []).filter(Boolean);
  if (elements.length > 0) {
    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${exportWidth}" height="${exportHeight}" viewBox="0 0 ${exportWidth} ${exportHeight}">${elementsToSvgInner(elements)}</svg>`;
    await new Promise((res) => {
      const img = new Image();
      img.onload = () => { ctx.drawImage(img, 0, 0, exportWidth, exportHeight); res(); };
      img.onerror = res;
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)));
    });
  }

  return canvas.toDataURL('image/png');
}

/**
 * Serialize a list of canvas elements to SVG inner markup (for export).
 */
function elementsToSvgInner(elements) {
  return elements.map((el) => {
    if (!el) return '';
    if (el.type === 'pen') {
      const outline = strokeOutline(el.points, el.penType || 'normal', el.strokeWidth || 2);
      const d = outlineToPath(outline);
      if (!d) return '';
      const styleStr = el.penType === 'highlighter' ? ' style="mix-blend-mode: multiply;"' : '';
      return `<path d="${d}" fill="${el.color || '#000'}" opacity="${el.opacity ?? 1}"${styleStr} />`;
    }
    if (el.type === 'rect') return `<rect x="${el.x}" y="${el.y}" width="${Math.abs(el.w)}" height="${Math.abs(el.h)}" rx="${el.radius || 0}" stroke="${el.color}" stroke-width="${el.strokeWidth}" fill="${el.fill || 'transparent'}" />`;
    if (el.type === 'ellipse') return `<ellipse cx="${el.x + el.w / 2}" cy="${el.y + el.h / 2}" rx="${Math.abs(el.w) / 2}" ry="${Math.abs(el.h) / 2}" stroke="${el.color}" stroke-width="${el.strokeWidth}" fill="${el.fill || 'transparent'}" />`;
    if (el.type === 'line') return `<line x1="${el.x1}" y1="${el.y1}" x2="${el.x2}" y2="${el.y2}" stroke="${el.color}" stroke-width="${el.strokeWidth}" stroke-linecap="round" />`;
    if (el.type === 'arrow') {
      const markerId = `arrow-export-${el.id}`;
      return `
        <g>
          <defs>
            <marker id="${markerId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="${el.color}" />
            </marker>
          </defs>
          <line
            x1="${el.x1}" y1="${el.y1}" x2="${el.x2}" y2="${el.y2}"
            stroke="${el.color}" stroke-width="${el.strokeWidth}"
            stroke-linecap="round"
            marker-end="url(#${markerId})"
          />
        </g>
      `;
    }
    if (el.type === 'text') {
      const safe = (el.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const family = el.font === 'display' ? 'Outfit, sans-serif'
                   : el.font === 'hand'    ? 'Caveat, cursive'
                   : 'IBM Plex Sans, sans-serif';
      return `<text x="${el.x}" y="${el.y + (el.fontSize || 18)}" font-size="${el.fontSize || 18}" fill="${el.color}" font-family="${family}">${safe}</text>`;
    }
    if (el.type === 'handwriting') {
      const safe = (el.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const fontFam = el.fontFamily || 'Caveat';
      return `
        <foreignObject x="${el.x}" y="${el.y}" width="${el.maxWidth || el.width || 400}" height="${el.height || 180}">
          <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: '${fontFam}', cursive, sans-serif; font-size: ${el.fontSize || 28}px; line-height: 1.35; color: ${el.color || '#111'}; white-space: pre-wrap; word-break: break-word;">
            ${safe}
          </div>
        </foreignObject>
      `;
    }
    if (el.type === 'sticky') {
      const safe = (el.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `
        <g>
          <rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" fill="${el.color}" rx="8" opacity="0.95" stroke="rgba(0,0,0,0.08)" stroke-width="1" />
          <foreignObject x="${el.x + 8}" y="${el.y + 6}" width="${el.w - 16}" height="${el.h - 12}">
            <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Caveat, cursive; font-size: 20px; line-height: 1.3; color: #111; white-space: pre-wrap; overflow: hidden; height: 100%; pointer-events: none;">
              ${safe}
            </div>
          </foreignObject>
        </g>
      `;
    }
    return '';
  }).join('\n');
}

/**
 * Build and download a multi-page PDF from an array of PNG dataURLs.
 */
export async function buildPdfFromImages(images, fileName = 'inkwell-export.pdf') {
  const doc = await PDFDocument.create();
  for (const dataURL of images) {
    const base64 = dataURL.split(',')[1];
    const pngBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const png = await doc.embedPng(pngBytes);
    const { width, height } = png;
    const page = doc.addPage([width, height]);
    page.drawImage(png, { x: 0, y: 0, width, height });
  }
  const pdfBytes = await doc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}