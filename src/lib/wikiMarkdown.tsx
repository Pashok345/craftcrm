const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const sanitizeUrl = (url: string): string | null => {
  try {
    const u = new URL(url, window.location.origin);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
};

const inline = (raw: string) => {
  let html = escapeHtml(raw);
  // images ![alt](url)
  html = html.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt, url) => {
    const safe = sanitizeUrl(url);
    if (!safe) return '';
    return `<img src="${safe.replace(/"/g, '&quot;')}" alt="${alt}" class="rounded-lg max-w-full my-3 border border-border" loading="lazy" />`;
  });
  // links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text, url) => {
    const safe = sanitizeUrl(url);
    if (!safe) return text;
    return `<a href="${safe.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">${text}</a>`;
  });
  html = html.replace(/`([^`\n]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-muted text-sm font-mono">$1</code>');
  html = html.replace(/\*\*([^\n*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^\n_]+)__/g, '<u>$1</u>');
  html = html.replace(/(^|[\s(])\*([^\n*]+)\*(?=[\s.,!?):]|$)/g, '$1<em>$2</em>');
  // bare urls
  html = html.replace(/(^|[\s>])(https?:\/\/[^\s<]+)/g, (m, pre, url) => {
    const safe = sanitizeUrl(url);
    if (!safe) return m;
    return `${pre}<a href="${safe.replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">${url}</a>`;
  });
  return html;
};

/** Minimal, safe markdown → HTML for wiki articles. */
export const renderWikiMarkdown = (text: string): string => {
  if (!text) return '';
  const lines = text.split('\n');
  const out: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let inCode = false;
  const codeBuf: string[] = [];

  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (inCode) {
        out.push(
          `<pre class="rounded-lg bg-muted p-3 overflow-x-auto my-3"><code class="text-sm font-mono">${escapeHtml(codeBuf.join('\n'))}</code></pre>`
        );
        codeBuf.length = 0;
        inCode = false;
      } else {
        closeList();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      const sizes = ['text-2xl', 'text-xl', 'text-lg', 'text-base'];
      out.push(`<h${level + 1} class="${sizes[level - 1]} font-semibold mt-6 mb-2">${inline(heading[2])}</h${level + 1}>`);
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      closeList();
      out.push(`<blockquote class="border-l-4 border-primary/40 pl-4 italic text-muted-foreground my-3">${inline(quote[1])}</blockquote>`);
      continue;
    }

    if (/^\s*([-*])\s+/.test(line)) {
      if (listType !== 'ul') {
        closeList();
        out.push('<ul class="list-disc pl-6 space-y-1 my-2">');
        listType = 'ul';
      }
      out.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      if (listType !== 'ol') {
        closeList();
        out.push('<ol class="list-decimal pl-6 space-y-1 my-2">');
        listType = 'ol';
      }
      out.push(`<li>${inline(line.replace(/^\s*\d+\.\s+/, ''))}</li>`);
      continue;
    }

    if (/^\s*(-{3,}|_{3,})\s*$/.test(line)) {
      closeList();
      out.push('<hr class="my-6 border-border" />');
      continue;
    }

    if (!line.trim()) {
      closeList();
      continue;
    }

    closeList();
    out.push(`<p class="my-2 leading-relaxed">${inline(line)}</p>`);
  }
  closeList();
  if (inCode && codeBuf.length) {
    out.push(`<pre class="rounded-lg bg-muted p-3 overflow-x-auto my-3"><code class="text-sm font-mono">${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
  }
  return out.join('\n');
};

export const WikiContent = ({ content }: { content: string }) => (
  <div className="text-foreground" dangerouslySetInnerHTML={{ __html: renderWikiMarkdown(content) }} />
);
