// Public share preview: returns HTML with OG tags for social crawlers,
// and redirects real users to the app route.
// URL: /functions/v1/share-preview?type=project|task&id=<uuid>
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APP_ORIGIN = 'https://craftcrm.markweb.pro';
// Fallback OG image – brand cover from the CDN library
const DEFAULT_OG_IMAGE = `${APP_ORIGIN}/__l5e/assets-v1/d9091e50-8563-4ba4-ad61-c8d541cd8280/cover-01.jpg`;

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function resolveImage(supabase: any, rawUrl: string | null | undefined): Promise<string> {
  if (!rawUrl) return DEFAULT_OG_IMAGE;
  // Absolute URL already
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
  // CDN asset URL
  if (rawUrl.startsWith('/__l5e/')) return `${APP_ORIGIN}${rawUrl}`;
  // Signed storage sentinel: "sb://bucket/path"
  if (rawUrl.startsWith('sb://')) {
    const [, , bucket, ...rest] = rawUrl.split('/');
    const path = rest.join('/');
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 365);
    if (data?.signedUrl) return data.signedUrl;
  }
  return DEFAULT_OG_IMAGE;
}

function buildHtml(opts: {
  title: string;
  description: string;
  image: string;
  redirectTo: string;
  canonical: string;
}): string {
  const { title, description, image, redirectTo, canonical } = opts;
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const img = escapeHtml(image);
  const r = escapeHtml(redirectTo);
  const c = escapeHtml(canonical);
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<title>${t}</title>
<meta name="description" content="${d}" />
<link rel="canonical" href="${c}" />
<meta property="og:type" content="article" />
<meta property="og:title" content="${t}" />
<meta property="og:description" content="${d}" />
<meta property="og:image" content="${img}" />
<meta property="og:url" content="${c}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${t}" />
<meta name="twitter:description" content="${d}" />
<meta name="twitter:image" content="${img}" />
<meta http-equiv="refresh" content="0; url=${r}" />
<style>body{font-family:system-ui,sans-serif;padding:2rem;max-width:640px;margin:0 auto;color:#333}img{max-width:100%;border-radius:12px}</style>
</head>
<body>
<img src="${img}" alt="" />
<h1>${t}</h1>
<p>${d}</p>
<p><a href="${r}">Открыть в CraftCRM →</a></p>
<script>window.location.replace(${JSON.stringify(redirectTo)});</script>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const type = url.searchParams.get('type');
    const id = url.searchParams.get('id');

    if (!type || !id || (type !== 'project' && type !== 'task')) {
      return new Response('Bad request', { status: 400 });
    }
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return new Response('Invalid id', { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let title = 'CraftCRM';
    let description = 'Управление проектами и задачами';
    let image = DEFAULT_OG_IMAGE;
    let redirectTo = APP_ORIGIN;

    if (type === 'project') {
      const { data } = await supabase
        .from('projects')
        .select('title, description, cover_image_url')
        .eq('id', id)
        .maybeSingle();
      if (data) {
        title = data.title || title;
        description = (data.description || '').slice(0, 200) || 'Проект в CraftCRM';
        image = await resolveImage(supabase, data.cover_image_url);
      }
      redirectTo = `${APP_ORIGIN}/projects/${id}`;
    } else {
      // Tasks may contain sensitive content — require auth and honor RLS.
      const authHeader = req.headers.get('Authorization');
      redirectTo = `${APP_ORIGIN}/tasks/${id}`;
      if (authHeader?.startsWith('Bearer ')) {
        const userClient = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_ANON_KEY')!,
          { global: { headers: { Authorization: authHeader } } },
        );
        const token = authHeader.replace('Bearer ', '');
        const { data: claims } = await userClient.auth.getClaims(token);
        if (claims?.claims) {
          const { data } = await userClient
            .from('tasks')
            .select('title, description, bg_image_url')
            .eq('id', id)
            .maybeSingle();
          if (data) {
            title = data.title || title;
            description = (data.description || '').replace(/<[^>]+>/g, '').slice(0, 200) || 'Задача в CraftCRM';
            image = await resolveImage(supabase, data.bg_image_url);
          }
        }
      } else {
        title = 'Задача в CraftCRM';
        description = 'Увійдіть, щоб переглянути деталі задачі.';
      }
    }

    const canonical = `${url.origin}${url.pathname}?type=${type}&id=${id}`;
    const html = buildHtml({ title, description, image, redirectTo, canonical });

    const cacheControl = type === 'project'
      ? 'public, max-age=300'
      : 'private, no-store';

    return new Response(html, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': cacheControl,
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });

  } catch (e) {
    console.error('share-preview error', e);
    return new Response('Server error', { status: 500 });
  }
});
