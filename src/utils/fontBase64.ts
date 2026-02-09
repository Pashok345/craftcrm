// This module provides base64 encoded Roboto font for PDF generation with Cyrillic support
// Font is loaded dynamically from Google Fonts CDN and cached

let cachedFont: string | null = null;

export const loadRobotoFontBase64 = async (): Promise<string> => {
  if (cachedFont) return cachedFont;
  
  try {
    const response = await fetch('https://fonts.gstatic.com/s/roboto/v32/KFOmCnqEu92Fr1Mu4mxP.ttf');
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Convert to base64
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    cachedFont = btoa(binary);
    return cachedFont;
  } catch (error) {
    console.error('Failed to load font:', error);
    throw error;
  }
};
