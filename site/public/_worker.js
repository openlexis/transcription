// The TEI downloads are stored gzip-compressed (several books exceed Pages' 25 MiB file limit).
// Pages does not honor Content-Encoding in _headers, so this worker adds it for /downloads/*
// and sets Cache-Control: no-transform so a browser decodes the file into ordinary XML.
export default {
  async fetch(request, env) {
    const res = await env.ASSETS.fetch(request);
    if (!res.ok) return res;
    const headers = new Headers(res.headers);
    headers.set("Content-Type", "application/xml; charset=utf-8");
    headers.set("Content-Encoding", "gzip");
    headers.set("Cache-Control", "public, max-age=0, must-revalidate, no-transform");
    headers.set("Vary", "Accept-Encoding");
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  },
};
