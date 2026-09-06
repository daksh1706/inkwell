// Lightweight, Fast Universal Syntax Highlighter for Notes & Canvas

export const SYNTAX_THEMES = {
  light: {
    keyword: '#0033FF',     // Royal blue (class, public, return, function, if, for)
    type: '#0891B2',        // Cyan / Teal (boolean, int, String, Solution, Array)
    literal: '#7C3AED',     // Purple (true, false, null, undefined)
    number: '#D97706',      // Amber / Orange (123, 3.14)
    string: '#059669',      // Emerald green ("hello", 'world')
    comment: '#6B7280',     // Slate gray (// comment, /* block */)
    function: '#B45309',    // Warm brown / Amber (uniformArray, main, print)
    punctuation: '#374151', // Slate punctuation ({, }, (, ), ;, [, ])
    default: '#111111',     // Standard text
  },
  dark: {
    keyword: '#60A5FA',
    type: '#22D3EE',
    literal: '#C084FC',
    number: '#FBBF24',
    string: '#34D399',
    comment: '#9CA3AF',
    function: '#F97316',
    punctuation: '#D1D5DB',
    default: '#F3F4F6',
  },
};

const KEYWORDS = new Set([
  'abstract', 'arguments', 'as', 'async', 'await', 'break', 'byte', 'case', 'catch',
  'class', 'const', 'continue', 'debugger', 'default', 'def', 'delete', 'do',
  'else', 'enum', 'eval', 'export', 'extends', 'final', 'finally', 'fn', 'for',
  'from', 'function', 'get', 'goto', 'if', 'implements', 'import', 'in',
  'instanceof', 'interface', 'is', 'lambda', 'let', 'mut', 'native', 'new',
  'of', 'package', 'pass', 'private', 'protected', 'pub', 'public', 'readonly',
  'return', 'set', 'static', 'struct', 'super', 'switch', 'synchronized',
  'this', 'throw', 'throws', 'trait', 'transient', 'try', 'type', 'typeof',
  'val', 'var', 'void', 'volatile', 'while', 'with', 'yield', 'union', 'sizeof'
]);

const TYPES = new Set([
  'int', 'boolean', 'bool', 'float', 'double', 'char', 'byte', 'short', 'long',
  'void', 'String', 'Integer', 'Boolean', 'Float', 'Double', 'Character', 'Byte',
  'Short', 'Long', 'List', 'ArrayList', 'Map', 'HashMap', 'Set', 'HashSet',
  'Array', 'Object', 'Promise', 'vector', 'str', 'dict', 'tuple', 'any',
  'unknown', 'never', 'number', 'string', 'symbol', 'bigint', 'undefined',
  'Console', 'Math', 'JSON', 'System', 'StringBuilder', 'Scanner', 'TreeSet', 'TreeMap'
]);

const LITERALS = new Set([
  'true', 'false', 'null', 'nil', 'undefined', 'None', 'True', 'False', 'NaN', 'Infinity', 'self'
]);

/**
 * Checks if a block of text strongly resembles code
 */
export function isLikelyCode(text) {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (trimmed.length < 4) return false;

  // Code indicators
  const indicators = [
    /\b(class|public|private|protected|function|def|const|let|var|return|import|export|if|for|while|struct|interface)\b/,
    /[{};]\s*$/,
    /(\w+)\s*\([^)]*\)\s*\{/,
    /\[\s*\]/,
    /=>/,
    /\/\/.+|\/\*[\s\S]*?\*\/|#.+/,
    /^\s*(class|public|private|def|fn|const|let|import)\s+/m
  ];

  let matches = 0;
  for (const reg of indicators) {
    if (reg.test(trimmed)) matches++;
  }

  return matches >= 1 || trimmed.includes('class ') || trimmed.includes('public ') || trimmed.includes('return ') || trimmed.includes('function ');
}

/**
 * Tokenizes text and returns character color maps and style patches
 */
export function generateSyntaxCharColors(text, theme = 'light') {
  if (!text) return { charColors: {}, charStyles: {} };
  const palette = SYNTAX_THEMES[theme] || SYNTAX_THEMES.light;
  const charColors = {};
  const charStyles = {};

  const lines = text.split('\n');
  let cumulativeIndex = 0;

  for (let lIdx = 0; lIdx < lines.length; lIdx++) {
    const line = lines[lIdx];
    const lineStartIdx = cumulativeIndex;
    cumulativeIndex += line.length + 1; // including newline

    // Tokenize line using regex
    // 1. Comments
    // 2. Strings
    // 3. Numbers
    // 4. Identifiers / Words
    // 5. Operators / Punctuation
    const tokenRegex = /(\/\/.*|#.*|\/\*[\s\S]*?\*\/)|(["'`])(?:(?=(\\?))\3[\s\S])*?\2|(\b\d+(?:\.\d+)?\b)|(\b[a-zA-Z_$][a-zA-Z0-9_$]*\b)|([{}()\[\].,;+\-*\/%=<>!&|^~?:])/g;
    let match;

    while ((match = tokenRegex.exec(line)) !== null) {
      const matchText = match[0];
      const startOffset = match.index;
      const length = matchText.length;
      const absStart = lineStartIdx + startOffset;

      let color = null;
      let style = null;

      if (match[1]) {
        // Comment
        color = palette.comment;
        style = { italic: true };
      } else if (match[2] !== undefined) {
        // String literal
        color = palette.string;
      } else if (match[4]) {
        // Number
        color = palette.number;
      } else if (match[5]) {
        // Word (keyword, type, literal, method, identifier)
        const word = match[5];
        if (KEYWORDS.has(word)) {
          color = palette.keyword;
          style = { bold: true };
        } else if (TYPES.has(word)) {
          color = palette.type;
        } else if (LITERALS.has(word)) {
          color = palette.literal;
          style = { bold: true };
        } else if (/^[A-Z][a-zA-Z0-9_$]*$/.test(word)) {
          // PascalCase / Capitalized class or type name (e.g. Solution, MyTree, Node)
          color = palette.type;
        } else {
          // Check if followed by '(' (method/function call)
          const restOfLine = line.slice(startOffset + length).trim();
          if (restOfLine.startsWith('(')) {
            color = palette.function;
          } else {
            color = palette.default;
          }
        }
      } else if (match[6]) {
        // Punctuation / Operator
        color = palette.punctuation;
      }

      if (color) {
        for (let i = 0; i < length; i++) {
          charColors[absStart + i] = color;
          if (style) {
            charStyles[absStart + i] = { ...style };
          }
        }
      }
    }
  }

  return { charColors, charStyles };
}

/**
 * Formats a code string into styled HTML with syntax highlighting for Notes
 */
export function formatCodeHtml(code, theme = 'light') {
  if (!code) return '';
  const palette = SYNTAX_THEMES[theme] || SYNTAX_THEMES.light;
  const lines = code.split('\n');

  return lines.map(line => {
    if (!line) return '<br>';
    const tokenRegex = /(\/\/.*|#.*|\/\*[\s\S]*?\*\/)|(["'`])(?:(?=(\\?))\3[\s\S])*?\2|(\b\d+(?:\.\d+)?\b)|(\b[a-zA-Z_$][a-zA-Z0-9_$]*\b)|([{}()\[\].,;+\-*\/%=<>!&|^~?:])/g;
    
    let lastIdx = 0;
    let html = '';
    let match;

    while ((match = tokenRegex.exec(line)) !== null) {
      const matchText = match[0];
      const start = match.index;
      
      // Add text before match
      if (start > lastIdx) {
        html += escapeHtml(line.slice(lastIdx, start));
      }
      lastIdx = start + matchText.length;

      let style = '';
      if (match[1]) {
        // Comment
        style = `color: ${palette.comment}; font-style: italic;`;
      } else if (match[2] !== undefined) {
        // String
        style = `color: ${palette.string};`;
      } else if (match[4]) {
        // Number
        style = `color: ${palette.number};`;
      } else if (match[5]) {
        const word = match[5];
        if (KEYWORDS.has(word)) {
          style = `color: ${palette.keyword}; font-weight: 600;`;
        } else if (TYPES.has(word) || /^[A-Z][a-zA-Z0-9_$]*$/.test(word)) {
          style = `color: ${palette.type};`;
        } else if (LITERALS.has(word)) {
          style = `color: ${palette.literal}; font-weight: 600;`;
        } else {
          const rest = line.slice(start + matchText.length).trim();
          if (rest.startsWith('(')) {
            style = `color: ${palette.function};`;
          }
        }
      } else if (match[6]) {
        style = `color: ${palette.punctuation};`;
      }

      if (style) {
        html += `<span style="${style}">${escapeHtml(matchText)}</span>`;
      } else {
        html += escapeHtml(matchText);
      }
    }

    if (lastIdx < line.length) {
      html += escapeHtml(line.slice(lastIdx));
    }

    return html;
  }).join('\n');
}

function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

