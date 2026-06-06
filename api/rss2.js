// Vercel Edge Function - RSS for Shanxi Daily e-paper (v2 fixed)
export const config = { runtime: 'edge', regions: ['hkg1'] };

const EPAPER = 'http://epaper.sxrb.com';
const PATH = '/shtml/sxrb';

function esc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function fetchHTML(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.text();
  } finally { clearTimeout(t); }
}

function parseArticles(html, dateStr) {
  const articles = [];
  const seen = new Set();
  const re = /href="\/shtml\/sxrb\/[^"]*?(\d{7,})\.shtml"[^>]*title="([^"]+)"[^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const id = m[1];
    let title = m[2].trim();
    if (seen.has(id)) continue;
    if (title.length < 2) continue;
    seen.add(id);
    title = title.replace(/^[路.\s]+/, '').replace(/\s+/g, ' ').trim();
    if (title.length < 2) continue;
    articles.push({ id, title, url: EPAPER + '/shtml/sxrb/' + dateStr + '/' + id + '.shtml', date: dateStr });
  }
  return articles;
}

function getEditionUrls(html) {
  const urls = [];
  const re = /href="(\/shtml\/sxrb\/\d{8}\/v\d{2}\.shtml)"/gi;
  const seen = new Set();
  let m;
  while ((m = re.exec(html)) !== null) {
    if (!seen.has(m[1])) { seen.add(m[1]); urls.push(m[1]); }
  }
  return urls;
}

function getToday() {
  const d = new Date();
  return d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');
}

function rss(items, feedUrl) {
  const now = new Date().toUTCString();
  let x = '<?xml version="1.0" encoding="UTF-8"?>\n';
  x += '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n<channel>\n';
  x += '<title>Shanxi Daily RSS</title>\n<link>http://epaper.sxrb.com</link>\n';
  x += '<description>Shanxi Daily e-paper RSS feed</description>\n<language>zh-cn</language>\n';
  x += '<lastBuildDate>' + now + '</lastBuildDate>\n';
  x += '<atom:link href="' + esc(feedUrl) + '" rel="self" type="application/rss+xml"/>\n';
  for (const a of items) {
    const d = a.date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
    x += '<item>\n<title>' + esc(a.title) + '</title>\n';
    x += '<link>' + esc(a.url) + '</link>\n<guid isPermaLink="true">' + esc(a.url) + '</guid>\n';
    x += '<pubDate>' + d + ' 08:00:00 +0800</pubDate>\n</item>\n';
  }
  x += '</channel>\n</rss>';
  return x;
}

export default async function handler(req) {
  const u = new URL(req.url);
  if (u.pathname === '/favicon.ico') return new Response(null, { status: 204 });
  try {
    const today = getToday();
    const html = await fetchHTML(EPAPER + PATH + '/' + today + '/index.shtml');
    let articles = parseArticles(html, today);
    const editions = getEditionUrls(html);
    if (editions.length > 0) {
      const promises = editions.map(e => fetchHTML(EPAPER + e).then(h => parseArticles(h, today)).catch(() => []));
      const results = await Promise.all(promises.map(p => p.catch(() => [])));
      for (const r of results) articles = articles.concat(r);
    }
    const seen = new Set();
    const unique = articles.filter(a => !seen.has(a.id) && seen.add(a.id));
    if (unique.length === 0) {
      return new Response('No articles. HTML len=' + html.length + '. First 500: ' + html.substring(0, 500), {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
    return new Response(rss(unique, req.url), {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch(e) {
    return new Response('Error: ' + e.message + '\n' + (e.stack || ''), { status: 500 });
  }
}