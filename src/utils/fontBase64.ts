// Provides base64-encoded Roboto Regular (Cyrillic subset) for jsPDF.
// The default Roboto v32 Latin-only file does NOT contain Cyrillic glyphs and
// produces "..." / mojibake in PDFs. We use Google Fonts v51 cyrillic subset
// which covers Latin + Cyrillic in ~60 KB.

let cachedFont: string | null = null;
let inflight: Promise<string> | null = null;

const FONT_URLS = [
  // Roboto v51 — includes Cyrillic glyphs.
  'https://fonts.gstatic.com/s/roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbVmQiA8.ttf',
  // Fallback: cyrillic+latin variant
  'https://fonts.gstatic.com/s/roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbWmT.ttf',
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
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        if (buf.byteLength < 10000) throw new Error('font too small');
        cachedFont = arrayBufferToBase64(buf);
        return cachedFont;
      } catch (e) {
        lastErr = e;
        console.warn('[fontBase64] failed:', url, e);
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
