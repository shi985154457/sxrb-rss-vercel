// Minimal test - verify Edge Function works
export const config = { runtime: 'edge' };

function esc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

export default async function handler(req) {
  const now = new Date().toUTCString();
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n<channel>\n' +
    '<title>Shanxi Daily Test</title>\n<link>http://epaper.sxrb.com</link>\n' +
    '<description>Test feed</description>\n<language>zh-cn</language>\n' +
    '<lastBuildDate>' + now + '</lastBuildDate>\n' +
    '<atom:link href="' + esc(req.url) + '" rel="self" type="application/rss+xml"/>\n' +
    '<item>\n<title>Test Article</title>\n<link>http://epaper.sxrb.com</link>\n' +
    '<guid isPermaLink="true">http://epaper.sxrb.com/test</guid>\n' +
    '<pubDate>' + now + '</pubDate>\n</item>\n' +
    '</channel>\n</rss>',
    { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } }
  );
}