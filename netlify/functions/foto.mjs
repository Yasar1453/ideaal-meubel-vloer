/* Productfoto's die via het beheerportaal zijn geüpload. De bestandsnaam bevat een versie, dus ze mogen lang bewaard worden. */
import { fotos } from '../../lib/opslag.mjs';

export default async (req) => {
  const naam = new URL(req.url).pathname.replace(/^\/foto\//, '');
  if (!/^[a-z0-9-]+\.jpg$/.test(naam)) return new Response('Niet gevonden', { status: 404 });
  const data = await fotos().get('foto/' + naam, { type: 'arrayBuffer' });
  if (!data) return new Response('Niet gevonden', { status: 404 });
  return new Response(data, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' } });
};

export const config = { path: '/foto/*' };
