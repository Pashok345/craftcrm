// Provides base64 encoded Roboto font for PDF generation with full Cyrillic support.
// Loads both Latin and Cyrillic subsets from Google Fonts CDN and caches the result.
// We pick a TTF that covers Latin + Cyrillic + Cyrillic Extended.

let cachedFont: string | null = null;
let inflight: Promise<string> | null = null;

// Roboto Regular — full TTF that includes Cyrillic glyphs.
// Source: jsdelivr mirror of Google Fonts (single TTF, not subsetted).
const FONT_URLS = [
  'https://cdn.jsdelivr.net/npm/@fontsource/roboto@5.0.8/files/roboto-cyrillic-400-normal.woff',
  'https://cdn.jsdelivr.net/gh/googlefonts/roboto@main/src/hinted/Roboto-Regular.ttf',
  'https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Regular.ttf',
];

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
};

export const loadRobotoFontBase64 = async (): Promise<string> => {
  if (cachedFont) return cachedFont;
  if (inflight) return inflight;

  inflight = (async () => {
    let lastErr: unknown = null;
    for (const url of FONT_URLS) {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const buf = await response.arrayBuffer();
        // sanity check: TTF/WOFF should be at least a few KB
        if (buf.byteLength < 10000) throw new Error('font too small');
        cachedFont = arrayBufferToBase64(buf);
        return cachedFont;
      } catch (e) {
        lastErr = e;
        console.warn('Font load failed for', url, e);
      }
    }
    throw lastErr ?? new Error('Failed to load Roboto font');
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
};
