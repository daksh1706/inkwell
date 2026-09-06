// Handwriting Font & Rendering Utility
export const HANDWRITING_FONTS = [
  {
    name: 'Caveat',
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
 * Wraps text into lines based on maximum width using canvas font measurement
 */
export function calculateTextLayout(ctx, text, maxWidth, fontSize, fontFamily, lineHeightRatio = 1.35) {
  if (ctx) {
    ctx.font = `${fontSize}px "${fontFamily}", cursive, sans-serif`;
  }
  const lineHeight = fontSize * lineHeightRatio;
  const rawParagraphs = (text || '').split(/\r?\n/);
  const lines = [];

  for (const paragraph of rawParagraphs) {
    if (paragraph.trim() === '') {
      lines.push('');
      continue;
    }

    const words = paragraph.split(' ');
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      let textWidth = 0;
      
      if (ctx) {
        textWidth = ctx.measureText(testLine).width;
      } else {
        // Approximate fallback
        textWidth = testLine.length * (fontSize * 0.45);
      }

      if (textWidth > maxWidth && currentLine !== '') {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
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
      w = line.length * (fontSize * 0.45);
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
 * Renders handwritten text onto Canvas 2D Context with High-DPI and natural jitter
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
}) {
  ctx.save();
  ctx.font = `${fontSize}px "${fontFamily}", cursive, sans-serif`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';

  lines.forEach((line, index) => {
    const lineY = y + index * lineHeight;
    let lineX = x;

    const lineWidth = ctx.measureText(line).width;
    if (align === 'center') {
      lineX = x + Math.max(0, (width - lineWidth) / 2);
    } else if (align === 'right') {
      lineX = x + Math.max(0, width - lineWidth);
    }

    if (jitter > 0) {
      let currentWordX = lineX;
      const words = line.split(' ');

      words.forEach((word, wIdx) => {
        const seed = (index + 1) * 37 + (wIdx + 1) * 17;
        const driftY = Math.sin(seed) * jitter * 2;
        const angle = Math.cos(seed) * (jitter * 0.02);

        ctx.save();
        ctx.translate(currentWordX, lineY + driftY);
        ctx.rotate(angle);
        ctx.fillText(word, 0, 0);
        ctx.restore();

        currentWordX += ctx.measureText(word + ' ').width;
      });
    } else {
      ctx.fillText(line, lineX, lineY);
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
  });

  return {
    dataURL: offscreen.toDataURL('image/png'),
    width: totalWidth,
    height: totalHeight,
  };
}
