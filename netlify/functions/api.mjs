/* API voor het beheerportaal en voor bestelaanvragen van de website. */
import { scryptSync, randomBytes, timingSafeEqual, createHmac, createHash } from 'node:crypto';
import { purgeCache } from '@netlify/functions';
import { leesWinkel, schrijfWinkel, bestellingen, prive, fotos } from '../../lib/opslag.mjs';

const TYPES = ['Plank', 'Visgraat', 'Tegeldessin'];
const TINTEN = ['Licht', 'Naturel', 'Grijs', 'Donker'];
const KLASSEN = ['AC3', 'AC4', 'AC5', 'Klasse 23', 'Klasse 31', 'Klasse 32', 'Klasse 33', 'Klasse 34'];
const SOORTEN = ['Laminaat', 'PVC'];
const STATUS = ['nieuw', 'bezig', 'klaar'];
const SESSIE_DAGEN = 14;

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
});
const fout = (melding, status = 400) => json({ ok: false, melding }, status);
const schoon = (v, max) => String(v ?? '').replace(/[\x00-\x1F\x7F]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const getal = (v) => Number(String(v ?? '').trim().replace(',', '.'));
const rond = (n) => Math.round(n * 100) / 100;

/* ---------- Wachtwoord en sessie ---------- */
const hashWw = (ww, salt) => scryptSync(ww, salt, 64).toString('hex');
const teken = (geheim, tekst) => createHmac('sha256', geheim).update(tekst).digest('hex');

async function ingelogd(req) {
  const m = (req.headers.get('cookie') || '').match(/(?:^|;\s*)ib_sessie=([0-9]+)\.([0-9a-f]{64})/);
  if (!m || Number(m[1]) < Date.now()) return false;
  const geheim = await prive().get('geheim');
  if (!geheim) return false;
  const verwacht = Buffer.from(teken(geheim, m[1]), 'hex');
  return timingSafeEqual(verwacht, Buffer.from(m[2], 'hex'));
}

async function sessieCookie() {
  let geheim = await prive().get('geheim');
  if (!geheim) { geheim = randomBytes(32).toString('hex'); await prive().set('geheim', geheim); }
  const tot = String(Date.now() + SESSIE_DAGEN * 864e5);
  return `ib_sessie=${tot}.${teken(geheim, tot)}; Path=/api; Max-Age=${SESSIE_DAGEN * 86400}; HttpOnly; Secure; SameSite=Strict`;
}
const uitCookie = 'ib_sessie=; Path=/api; Max-Age=0; HttpOnly; Secure; SameSite=Strict';

async function wachtwoordKlopt(ww) {
  const acc = await prive().get('account', { type: 'json' });
  if (!acc) return false;
  const a = Buffer.from(hashWw(String(ww), acc.salt), 'hex');
  return timingSafeEqual(a, Buffer.from(acc.hash, 'hex'));
}
async function zetWachtwoord(ww) {
  const salt = randomBytes(16).toString('hex');
  await prive().setJSON('account', { salt, hash: hashWw(ww, salt) });
  await prive().set('geheim', randomBytes(32).toString('hex')); // oude sessies vervallen
}

/* ---------- Website bijwerken ---------- */
async function verversSite() {
  try { await purgeCache({ tags: ['site'] }); } catch (e) { console.error('purgeCache', e); }
}

/* ---------- Producten ---------- */
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/ı/g, 'i')
  .replace(/&/g, 'en').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'vloer';

async function productOpslaan(body) {
  const W = await leesWinkel();
  const bestaand = W.laminaat.find((x) => x.id === body.id);
  const p = {
    id: bestaand ? bestaand.id : '',
    naam: schoon(body.naam, 60),
    soort: SOORTEN.includes(body.soort) ? body.soort : 'Laminaat',
    lijn: schoon(body.lijn, 30) || 'Classic',
    type: TYPES.includes(body.type) ? body.type : 'Plank',
    tint: TINTEN.includes(body.tint) ? body.tint : 'Naturel',
    dikte: Math.round(getal(body.dikte)),
    klasse: KLASSEN.includes(body.klasse) ? body.klasse : 'AC4',
    formaat: schoon(body.formaat, 40) || '-',
    pak: rond(getal(body.pak)),
    prijs: rond(getal(body.prijs)),
    water: body.water === true,
    tekst: schoon(body.tekst, 600),
  };
  if (bestaand?.foto) p.foto = bestaand.foto;
  if (!p.naam) return fout('Vul een naam in.');
  if (!p.tekst) return fout('Vul een beschrijving in.');
  if (!(p.prijs > 0 && p.prijs <= 1000)) return fout('Vul een geldige prijs per m² in.');
  if (!(p.pak > 0 && p.pak <= 20)) return fout('Vul in hoeveel m² er in een pak zit.');
  if (!(p.dikte >= 2 && p.dikte <= 20)) return fout('Vul een dikte in millimeters in (bijv. 8).');
  if (!bestaand && !body.foto) return fout('Kies een foto van de vloer.');

  if (!bestaand) {
    const basis = slug(p.naam); let id = basis; let i = 2;
    while (W.laminaat.some((x) => x.id === id)) id = `${basis}-${i++}`;
    p.id = id;
  }
  if (body.foto) {
    const m = String(body.foto).match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
    const buf = m && Buffer.from(m[1], 'base64');
    if (!buf || buf.length > 3e6 || buf[0] !== 0xff || buf[1] !== 0xd8) return fout('De foto kon niet worden gelezen. Kies een andere foto.');
    const naam = `${p.id}-${Date.now().toString(36)}.jpg`;
    await fotos().set('foto/' + naam, buf);
    if (p.foto?.startsWith('foto/')) await fotos().delete(p.foto);
    p.foto = 'foto/' + naam;
  }
  W.laminaat = bestaand ? W.laminaat.map((x) => (x.id === p.id ? p : x)) : [...W.laminaat, p];
  await schrijfWinkel(W);
  await verversSite();
  return json({ ok: true, product: p });
}

async function productWeg(id) {
  const W = await leesWinkel();
  const p = W.laminaat.find((x) => x.id === id);
  if (!p) return fout('Product niet gevonden.', 404);
  W.laminaat = W.laminaat.filter((x) => x.id !== id);
  await schrijfWinkel(W);
  if (p.foto?.startsWith('foto/')) await fotos().delete(p.foto);
  await verversSite();
  return json({ ok: true });
}

/* ---------- Bestelaanvraag van de website ---------- */
async function nieuweBestelling(req, context) {
  const origin = req.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(req.url).host) return fout('Niet toegestaan', 403);
  let d;
  try { d = JSON.parse((await req.text()).slice(0, 20000)); } catch { return fout('Ongeldig'); }
  if (!d || typeof d !== 'object') return fout('Ongeldig');
  const naam = schoon(d.naam, 100);
  const email = schoon(d.email, 254);
  const tekst = String(d.tekst ?? '').replace(/\r\n/g, '\n').trim();
  if (!naam || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !tekst || tekst.length > 8000) return fout('Ongeldig');

  // Maximaal 10 aanvragen per uur per bezoeker.
  const ip = createHash('sha256').update(String(context.ip || '')).digest('hex').slice(0, 24);
  const nu = Date.now();
  const tijden = ((await prive().get('limiet/' + ip, { type: 'json' })) || []).filter((t) => t > nu - 36e5);
  if (tijden.length >= 10) return fout('Te veel aanvragen. Bel ons even.', 429);
  await prive().setJSON('limiet/' + ip, [...tijden, nu]);

  const producten = Object.fromEntries((await leesWinkel()).laminaat.map((p) => [p.id, p]));
  const regels = (Array.isArray(d.regels) ? d.regels : []).slice(0, 50).flatMap((r) => {
    const p = producten[r?.id]; const n = Math.trunc(Number(r?.pakken));
    return p && n >= 1 && n <= 999 ? [{ id: p.id, naam: p.naam, pakken: n, m2: rond(n * p.pak), bedrag: rond(n * p.pak * p.prijs) }] : [];
  });
  const datum = new Date();
  const id = datum.toISOString().replace(/[-:T]/g, '').slice(0, 14) + '-' + randomBytes(2).toString('hex');
  await bestellingen().setJSON(id, {
    id, datum: datum.toISOString(), status: 'nieuw', naam, email,
    telefoon: schoon(d.telefoon, 40), adres: schoon(d.adres, 200), regels,
    totaal: Math.min(1e6, Math.max(0, Number(d.totaal) || 0)), tekst,
  });
  return json({ ok: true });
}

/* ---------- Router ---------- */
export default async (req, context) => {
  const pad = new URL(req.url).pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');
  const [deel, id] = pad.split('/');
  const m = req.method;

  try {
    if (deel === 'bestelling' && m === 'POST') return await nieuweBestelling(req, context);

    // Alles hieronder is voor het portaal: alleen JSON met de eigen kop (beschermt tegen verzoeken van andere sites).
    if (m !== 'GET' && req.headers.get('x-beheer') !== '1') return fout('Niet toegestaan', 403);
    const body = m === 'GET' || m === 'DELETE' ? {} : await req.json().catch(() => ({}));

    if (deel === 'sessie' && m === 'GET') {
      return json({ ingesteld: !!(await prive().get('account')), ingelogd: await ingelogd(req) });
    }
    if (deel === 'instellen' && m === 'POST') {
      if (await prive().get('account')) return fout('Er is al een wachtwoord ingesteld.', 403);
      if (String(body.wachtwoord || '').length < 8) return fout('Kies een wachtwoord van minstens 8 tekens.');
      await zetWachtwoord(String(body.wachtwoord));
      return json({ ok: true }, 200, { 'Set-Cookie': await sessieCookie() });
    }
    if (deel === 'inloggen' && m === 'POST') {
      const p = (await prive().get('inlog', { type: 'json' })) || { n: 0, t: 0 };
      const recent = p.t > Date.now() - 9e5;
      if (recent && p.n >= 5) return fout('Te vaak een verkeerd wachtwoord. Probeer het over 15 minuten opnieuw.', 429);
      if (await wachtwoordKlopt(body.wachtwoord || '')) {
        await prive().setJSON('inlog', { n: 0, t: 0 });
        return json({ ok: true }, 200, { 'Set-Cookie': await sessieCookie() });
      }
      await prive().setJSON('inlog', { n: (recent ? p.n : 0) + 1, t: Date.now() });
      await new Promise((r) => setTimeout(r, 800));
      return fout('Wachtwoord klopt niet.', 401);
    }
    if (deel === 'uitloggen' && m === 'POST') return json({ ok: true }, 200, { 'Set-Cookie': uitCookie });

    if (!(await ingelogd(req))) return fout('Log opnieuw in.', 401);

    if (deel === 'wachtwoord' && m === 'POST') {
      if (!(await wachtwoordKlopt(body.oud || ''))) return fout('Het huidige wachtwoord klopt niet.');
      if (String(body.nieuw || '').length < 8) return fout('Kies een nieuw wachtwoord van minstens 8 tekens.');
      await zetWachtwoord(String(body.nieuw));
      return json({ ok: true }, 200, { 'Set-Cookie': await sessieCookie() });
    }
    if (deel === 'bestellingen') {
      if (m === 'GET') {
        const { blobs } = await bestellingen().list();
        const lijst = (await Promise.all(blobs.map((b) => bestellingen().get(b.key, { type: 'json' })))).filter(Boolean);
        lijst.sort((a, b) => (a.datum < b.datum ? 1 : -1));
        return json({ ok: true, bestellingen: lijst });
      }
      if (!id || !/^[0-9a-f-]+$/.test(id)) return fout('Onbekende bestelling', 404);
      if (m === 'DELETE') { await bestellingen().delete(id); return json({ ok: true }); }
      if (m === 'POST') {
        const b = await bestellingen().get(id, { type: 'json' });
        if (!b) return fout('Onbekende bestelling', 404);
        if (!STATUS.includes(body.status)) return fout('Onbekende status');
        await bestellingen().setJSON(id, { ...b, status: body.status });
        return json({ ok: true });
      }
    }
    if (deel === 'producten') {
      if (m === 'GET') return json({ ok: true, producten: (await leesWinkel()).laminaat });
      if (m === 'POST') return await productOpslaan(body);
      if (m === 'DELETE' && id) return await productWeg(id);
    }
    return fout('Niet gevonden', 404);
  } catch (e) {
    console.error(e);
    return fout('Er ging iets mis. Probeer het opnieuw.', 500);
  }
};

export const config = { path: '/api/*' };
