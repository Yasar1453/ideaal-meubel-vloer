/* Opslag op Netlify (Blobs): winkelgegevens, productfoto's, bestellingen en het wachtwoord. */
import { getStore } from '@netlify/blobs';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const winkel = () => getStore({ name: 'winkel', consistency: 'strong' });
export const bestellingen = () => getStore({ name: 'bestellingen', consistency: 'strong' });
export const prive = () => getStore({ name: 'prive', consistency: 'strong' });
export const fotos = winkel;

/** Map met sjablonen en content (meegeleverd via included_files). */
export const ROOT = [process.cwd(), process.env.LAMBDA_TASK_ROOT, '/var/task'].filter(Boolean)
  .find((d) => existsSync(join(d, 'content/kennisbank'))) || process.cwd();

/** Actuele winkelgegevens; de eerste keer de versie uit de code. */
export async function leesWinkel() {
  const w = await winkel().get('winkel', { type: 'json' });
  return w || JSON.parse(readFileSync(join(ROOT, 'data/winkel.json'), 'utf8'));
}

export async function schrijfWinkel(w) {
  await winkel().setJSON('winkel', w);
}
