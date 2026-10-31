/* Maakt elke pagina met de actuele producten uit het beheerportaal.
   Het CDN bewaart het resultaat; na een wijziging in het portaal wordt die cache geleegd (tag "site"). */
import { bouwSite } from '../../lib/bouw.mjs';
import { leesWinkel, ROOT } from '../../lib/opslag.mjs';

const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', xml: 'application/xml; charset=utf-8', txt: 'text/plain; charset=utf-8' };

export default async (req, context) => {
  let pad = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '');
  if (pad === '') pad = 'index.html';
  if (!/\.[a-z]+$/.test(pad)) pad += '.html';

  const W = await leesWinkel();
  const BASE = (process.env.SITE_URL || context.site?.url || W.website).replace(/\/?$/, '/');
  const site = bouwSite(W, { root: ROOT, BASE });
  let body = site.get(pad);
  let status = 200;
  if (body === undefined) { body = site.get('404.html'); status = 404; }

  return new Response(body, {
    status,
    headers: {
      'Content-Type': TYPES[pad.split('.').pop()] || TYPES.html,
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Netlify-CDN-Cache-Control': 'public, durable, max-age=31536000, stale-while-revalidate=60',
      'Netlify-Cache-Tag': 'site',
    },
  });
};

export const config = {
  path: ['/', '/index.html', '/laminaat', '/laminaat.html', '/laminaat/*', '/kennisbank', '/kennisbank.html', '/kennisbank/*',
    '/bestellen', '/bestellen.html', '/pvc-vloeren', '/pvc-vloeren.html', '/pvc/*', '/visgraat', '/visgraat.html', '/diensten/*', '/assortiment/*', '/product.html', '/js/data.js', '/sitemap.xml', '/robots.txt', '/llms.txt'],
};
