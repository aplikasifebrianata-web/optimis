import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

function unwrapAtRuleBlocks(input: string, headerRegex: RegExp): string {
  let css = input;
  while (true) {
    headerRegex.lastIndex = 0;
    const match = headerRegex.exec(css);
    if (!match) break;

    const startIdx = match.index;
    const openBraceIdx = startIdx + match[0].length - 1;
    let depth = 1;
    let i = openBraceIdx + 1;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inComment = false;

    while (i < css.length && depth > 0) {
      const ch = css[i];
      const next = css[i + 1];

      if (inComment) {
        if (ch === '*' && next === '/') {
          inComment = false;
          i += 2;
          continue;
        }
        i++;
        continue;
      }
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (inSingleQuote) {
        if (ch === "'") inSingleQuote = false;
        i++;
        continue;
      }
      if (inDoubleQuote) {
        if (ch === '"') inDoubleQuote = false;
        i++;
        continue;
      }
      if (ch === '/' && next === '*') {
        inComment = true;
        i += 2;
        continue;
      }
      if (ch === "'") {
        inSingleQuote = true;
        i++;
        continue;
      }
      if (ch === '"') {
        inDoubleQuote = true;
        i++;
        continue;
      }
      if (ch === '{') {
        depth++;
      } else if (ch === '}') {
        depth--;
      }
      i++;
    }

    if (depth === 0) {
      const closeBraceIdx = i - 1;
      const innerContent = css.slice(openBraceIdx + 1, closeBraceIdx);
      css = css.slice(0, startIdx) + innerContent + css.slice(closeBraceIdx + 1);
    } else {
      break;
    }
  }
  return css;
}

function oklchToHex(lPercent: number, c: number, hDeg: number): string {
  const L = lPercent > 1 ? lPercent / 100 : lPercent;
  const hRad = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const rLin = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  const toSrgbHex = (v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    const gamma =
      clamped <= 0.0031308
        ? 12.92 * clamped
        : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
    return Math.round(Math.max(0, Math.min(255, gamma * 255)))
      .toString(16)
      .padStart(2, '0');
  };

  return `#${toSrgbHex(rLin)}${toSrgbHex(gLin)}${toSrgbHex(bLin)}`;
}

function makeCssUniversallyCompatible(rawCss: string): string {
  // 1. Hapus deklarasi @layer kosong (seperti @layer components; atau @layer theme, base;)
  let css = rawCss.replace(/@layer\s+[a-zA-Z0-9_,\s.-]+\s*;/g, '');
  // 2. Buka blok @layer <name> { ... } agar browser HP lama tetap membaca seluruh style
  css = unwrapAtRuleBlocks(css, /@layer\s+[a-zA-Z0-9_.-]+\s*\{/g);
  // 3. Buka blok @supports (((-webkit-hyphens:none))...) agar variabel --tw-* selalu terinisialisasi
  css = unwrapAtRuleBlocks(
    css,
    /@supports\s*\(\(\(-webkit-hyphens:\s*none\)\)[^{]*\{/g
  );
  // 4. Konversi warna oklch(...) pada CSS variable ke format standar #rrggbb agar didukung semua browser HP
  css = css.replace(
    /oklch\(\s*([0-9.]+)%?\s+([0-9.]+)\s+([0-9.]+)\s*\)/g,
    (_m, lStr, cStr, hStr) =>
      oklchToHex(parseFloat(lStr), parseFloat(cStr), parseFloat(hStr))
  );
  return css;
}

function universalCssCompatibilityPlugin(): Plugin {
  return {
    name: 'optimis-universal-css-compatibility',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const collectedCss: string[] = [];

      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (fileName.endsWith('.css') && chunk.type === 'asset' && typeof chunk.source === 'string') {
          const transformed = makeCssUniversallyCompatible(chunk.source);
          chunk.source = transformed;
          collectedCss.push(transformed);
        }
      }

      const htmlAsset = bundle['index.html'];
      if (
        htmlAsset &&
        htmlAsset.type === 'asset' &&
        typeof htmlAsset.source === 'string' &&
        collectedCss.length > 0
      ) {
        const inlineStyleTag = `<style id="optimis-inline-css">${collectedCss.join('\n')}</style>`;
        htmlAsset.source = htmlAsset.source
          .replace(/<link\s+rel="stylesheet"\s+crossorigin/g, '<link rel="stylesheet"')
          .replace('</head>', `${inlineStyleTag}\n  </head>`);
      }
    },
  };
}

export default defineConfig(() => {
  return {
    publicDir: 'public',
    plugins: [react(), tailwindcss(), universalCssCompatibilityPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true,
      sourcemap: false,
      cssTarget: ['chrome80', 'safari13', 'firefox80'],
      chunkSizeWarningLimit: 4000,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
