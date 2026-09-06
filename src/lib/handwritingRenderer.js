// Handwriting & Code Font & Rendering Utility
export const HANDWRITING_FONTS = [
  {
    name: 'JetBrains Mono (Code)',
    family: 'JetBrains Mono',
    weight: '500',
    isMonospace: true,
    url: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap'
  },
  {
    name: 'IBM Plex Mono (Code)',
    family: 'IBM Plex Mono',
    weight: '500',
    isMonospace: true,
    url: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;1,400&display=swap'
  },
  {
    name: 'Caveat (Handwritten)',
    family: 'Caveat',
    weight: '600',
    url: 'https://fonts.googleapis.com/css2?family=Caveat:wght@500;600;700&display=swap'
  },
  {
    name: 'Dancing Script',
    family: 'Dancing Script',
    weight: '600',
    url: 'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@500;600;700&display=swap'
  },
  {
    name: 'Indie Flower',
    family: 'Indie Flower',
    weight: '400',
    url: 'https://fonts.googleapis.com/css2?family=Indie+Flower&display=swap'
  },
  {
    name: 'Kalam',
    family: 'Kalam',
    weight: '400',
    url: 'https://fonts.googleapis.com/css2?family=Kalam:wght@400;700&display=swap'
  },
  {
    name: 'Shadows Into Light',
    family: 'Shadows Into Light',
    weight: '400',
    url: 'https://fonts.googleapis.com/css2?family=Shadows+Into+Light&display=swap'
  },
  {
    name: 'Patrick Hand',
    family: 'Patrick Hand',
    weight: '400',
    url: 'https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap'
  },
];

/**
 * Ensures a custom web font stylesheet is injected and loaded
 */
export async function ensureFontLoaded(fontFamily, weight = '400', fontSize = '24px') {
  const fontMeta = HANDWRITING_FONTS.find(f => f.family === fontFamily);
  if (fontMeta && fontMeta.url) {
    const linkId = `font-link-${fontFamily.replace(/\s+/g, '-').toLowerCase()}`;
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = fontMeta.url;
      document.head.appendChild(link);
    }
  }

  try {
    if (document.fonts) {
      await document.fonts.load(`${weight} ${fontSize} "${fontFamily}"`);
      await document.fonts.ready;
    }
  } catch (err) {
    console.warn(`Font "${fontFamily}" load warning:`, err);
  }
}

/**
 * Wraps text into lines based on maximum width using canvas font measurement while preserving indentation
 */
export function calculateTextLayout(ctx, text, maxWidth, fontSize, fontFamily, lineHeightRatio = 1.35) {
  if (ctx) {
    ctx.font = `${fontSize}px "${fontFamily}", monospace, cursive, sans-serif`;
  }
  const lineHeight = fontSize * lineHeightRatio;
  // Convert tabs to 4 spaces for uniform code rendering
  const normalizedText = (text || '').replace(/\t/g, '    ');
  const rawParagraphs = normalizedText.split(/\r?\n/);
  const lines = [];

  for (const paragraph of rawParagraphs) {
    if (paragraph.length === 0) {
      lines.push('');
      continue;
    }

    // Split preserving whitespace tokens (e.g. leading 4 spaces "    ")
    const tokens = paragraph.match(/\S+|\s+/g) || [paragraph];
    let currentLine = '';

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const testLine = currentLine + token;
      let textWidth = 0;
      
      if (ctx) {
        textWidth = ctx.measureText(testLine).width;
      } else {
        // Approximate fallback
        textWidth = testLine.length * (fontSize * 0.55);
      }

      if (textWidth > maxWidth && currentLine.trim() !== '') {
        lines.push(currentLine);
        // If token starts with space, keep it clean on new line or trim leading space for wrapped word
        currentLine = token.startsWith(' ') && !token.startsWith('   ') ? token.trimStart() : token;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine !== '') {
      lines.push(currentLine);
    }
  }

  // Calculate actual bounding dimensions
  let actualMaxWidth = 0;
  for (const line of lines) {
    let w = 0;
    if (ctx) {
      w = ctx.measureText(line).width;
    } else {
      w = line.length * (fontSize * 0.55);
    }
    if (w > actualMaxWidth) actualMaxWidth = w;
  }

  const computedWidth = Math.min(maxWidth, Math.max(actualMaxWidth, 120));
  const totalHeight = Math.max(lines.length * lineHeight, lineHeight);

  return {
    lines,
    lineHeight,
    width: computedWidth,
    height: totalHeight,
  };
}

/**
 * Renders handwritten or code text onto Canvas 2D Context with High-DPI, syntax highlighting & natural jitter
 */
export function drawHandwrittenText(ctx, {
  lines,
  lineHeight,
  fontSize,
  fontFamily,
  color = '#111111',
  align = 'left',
  x = 0,
  y = 0,
  width = 300,
  jitter = 0.4,
  charColors = {},
  charStyles = {},
}) {
  ctx.save();
  ctx.textBaseline = 'top';

  const isMono = fontFamily.includes('Mono');
  let cumulativeCharIdx = 0;

  lines.forEach((line, index) => {
    const lineY = y + index * lineHeight;
    let lineX = x;

    ctx.font = `${fontSize}px "${fontFamily}", monospace, cursive, sans-serif`;
    const lineWidth = ctx.measureText(line).width;

    if (align === 'center') {
      lineX = x + Math.max(0, (width - lineWidth) / 2);
    } else if (align === 'right') {
      lineX = x + Math.max(0, width - lineWidth);
    }

    const lineStartCharIdx = cumulativeCharIdx;
    cumulativeCharIdx += line.length + 1; // including newline

    // Render character by character to support individual syntax colors, styles & organic drift
    let currentX = lineX;
    const chars = line.split('');

    for (let cIdx = 0; cIdx < chars.length; cIdx++) {
      const char = chars[cIdx];
      const absIdx = lineStartCharIdx + cIdx;
      const charColor = charColors[absIdx] || color;
      const charStyle = charStyles[absIdx] || {};

      const fontPrefix = `${charStyle.bold ? 'bold ' : ''}${charStyle.italic ? 'italic ' : ''}`;
      ctx.font = `${fontPrefix}${fontSize}px "${fontFamily}", monospace, cursive, sans-serif`;
      ctx.fillStyle = charColor;

      const charWidth = ctx.measureText(char).width;

      if (jitter > 0 && !isMono) {
        const seed = (index + 1) * 37 + (cIdx + 1) * 13;
        const driftY = Math.sin(seed) * (jitter * 1.5);
        const angle = Math.cos(seed) * (jitter * 0.015);

        ctx.save();
        ctx.translate(currentX, lineY + driftY);
        ctx.rotate(angle);
        ctx.fillText(char, 0, 0);
        ctx.restore();
      } else {
        ctx.fillText(char, currentX, lineY);
      }

      currentX += charWidth;
    }
  });

  ctx.restore();
}

/**
 * Rasterizes typed text into a high-DPI Image Bitmap dataURL for baking to canvas
 */
export async function rasterizeHandwritingToImage(options) {
  const {
    text,
    fontFamily = 'Caveat',
    fontSize = 28,
    color = '#111111',
    align = 'left',
    maxWidth = 480,
    jitter = 0.4,
    charColors = {},
    charStyles = {},
  } = options;

  await ensureFontLoaded(fontFamily, '600', `${fontSize}px`);

  const offscreen = document.createElement('canvas');
  const offCtx = offscreen.getContext('2d');
  const dpr = window.devicePixelRatio || 2;

  const layout = calculateTextLayout(offCtx, text, maxWidth, fontSize, fontFamily);
  const padding = 16;

  const totalWidth = layout.width + padding * 2;
  const totalHeight = layout.height + padding * 2;

  offscreen.width = Math.ceil(totalWidth * dpr);
  offscreen.height = Math.ceil(totalHeight * dpr);

  offCtx.scale(dpr, dpr);

  drawHandwrittenText(offCtx, {
    lines: layout.lines,
    lineHeight: layout.lineHeight,
    fontSize,
    fontFamily,
    color,
    align,
    x: padding,
    y: padding,
    width: layout.width,
    jitter,
    charColors,
    charStyles,
  });

  return {
    dataURL: offscreen.toDataURL('image/png'),
    width: totalWidth,
    height: totalHeight,
  };
}

