/* Beheerportaal: bestellingen bijhouden en producten toevoegen, bewerken of verwijderen. */
(function () {
  const app = document.getElementById('app');
  const TYPES = ['Plank', 'Visgraat', 'Tegeldessin'];
  const TINTEN = ['Licht', 'Naturel', 'Grijs', 'Donker'];
  const KLASSEN = ['AC3', 'AC4', 'AC5'];
  const STATUS = { nieuw: 'Nieuw', bezig: 'In behandeling', klaar: 'Afgerond' };
  const h = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const eur = (n) => '€ ' + Number(n).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const komma = (n) => (n === '' || n == null ? '' : String(n).replace('.', ','));
  const foto = (p) => '../' + (p.foto || `img/laminaat/${p.id}.jpg`);
  let melding = '';
  let cache = { producten: null, bestellingen: null };

  async function api(pad, opties = {}) {
    const r = await fetch('/api/' + pad, {
      method: opties.method || 'GET', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Beheer': '1' },
      body: opties.body ? JSON.stringify(opties.body) : undefined,
    });
    let d = {};
    try { d = await r.json(); } catch (e) { /* leeg */ }
    if (r.status === 401 && pad !== 'inloggen') { start(); throw new Error('Log opnieuw in.'); }
    if (!r.ok || d.ok === false) throw new Error(d.melding || 'Er ging iets mis. Probeer het opnieuw.');
    return d;
  }

  /* ---------- Inloggen ---------- */
  async function start() {
    let s;
    try { s = await api('sessie'); } catch (e) { app.innerHTML = `<main class="login"><p class="fout">Het portaal is niet bereikbaar. Probeer het later opnieuw.</p></main>`; return; }
    if (s.ingelogd) { route(); return; }
    const nieuw = !s.ingesteld;
    app.innerHTML = `<main class="login">
      <img src="../img/logo.svg" alt="" width="56" height="56">
      <h1>Beheerportaal</h1>
      ${nieuw ? '<p>Welkom. Kies eerst een wachtwoord. Daarmee logt u voortaan in.</p>' : ''}
      <form id="login">
        <label>${nieuw ? 'Nieuw wachtwoord' : 'Wachtwoord'} <input type="password" name="ww" autocomplete="${nieuw ? 'new-password' : 'current-password'}" ${nieuw ? 'minlength="8"' : ''} required autofocus></label>
        ${nieuw ? '<label>Herhaal wachtwoord <input type="password" name="ww2" autocomplete="new-password" minlength="8" required></label>' : ''}
        <p class="fout" role="alert" hidden></p>
        <button class="knop">${nieuw ? 'Wachtwoord opslaan' : 'Inloggen'}</button>
      </form>
      <a class="terug" href="../index.html">Naar de website</a></main>`;
    const f = document.getElementById('login');
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fo = f.querySelector('.fout'); const knop = f.querySelector('button');
      const ww = f.ww.value;
      if (nieuw && ww !== f.ww2.value) { fo.textContent = 'De twee wachtwoorden zijn niet hetzelfde.'; fo.hidden = false; return; }
      knop.disabled = true;
      try {
        await api(nieuw ? 'instellen' : 'inloggen', { method: 'POST', body: { wachtwoord: ww } });
        melding = nieuw ? 'Wachtwoord ingesteld. Welkom in het beheerportaal.' : '';
        route();
      } catch (err) { fo.textContent = err.message; fo.hidden = false; knop.disabled = false; }
    });
  }

  /* ---------- Opbouw ---------- */
  function kader(actief, inhoud) {
    const nieuw = (cache.bestellingen || []).filter((b) => b.status === 'nieuw').length;
    app.innerHTML = `<header class="balk"><div class="balk-in">
        <a class="merk" href="#bestellingen"><img src="../img/logo-licht.svg" alt="" width="34" height="34"><span>Beheer</span></a>
        <nav>
          <a href="#bestellingen" class="${actief === 'bestellingen' ? 'actief' : ''}">Bestellingen${nieuw ? ` <b class="teller">${nieuw}</b>` : ''}</a>
          <a href="#producten" class="${actief === 'producten' ? 'actief' : ''}">Producten</a>
        </nav>
        <div class="balk-rechts"><a href="../index.html" target="_blank" rel="noopener">Website</a><a href="#account">Account</a><button class="link" id="uit">Uitloggen</button></div>
      </div></header>
      <main class="inhoud">${melding ? `<p class="melding" role="status">${h(melding)}</p>` : ''}${inhoud}</main>`;
    melding = '';
    document.getElementById('uit').addEventListener('click', async () => { await api('uitloggen', { method: 'POST' }).catch(() => {}); location.hash = ''; start(); });
  }

  async function route() {
    const [pagina, arg] = location.hash.replace(/^#/, '').split('/');
    try {
      if (!cache.bestellingen) cache.bestellingen = (await api('bestellingen')).bestellingen;
      if (pagina === 'producten') return toonProducten();
      if (pagina === 'product') return toonProduct(arg ? decodeURIComponent(arg) : '');
      if (pagina === 'account') return toonAccount();
      return toonBestellingen(arg || 'open');
    } catch (err) { if (err.message !== 'Log opnieuw in.') kader('', `<p class="fout">${h(err.message)}</p>`); }
  }
  window.addEventListener('hashchange', route);

  /* ---------- Bestellingen ---------- */
  const inFilter = (b, f) => f === 'alle' || (f === 'klaar' ? b.status === 'klaar' : b.status !== 'klaar');
  function extra(tekst) {
    const uit = {};
    for (const regel of String(tekst).split('\n')) {
      for (const k of ['Ondervloer', 'Plinten', 'Leggen door Ideaal', 'Levering', 'Opmerking']) {
        if (regel.startsWith(k + ': ')) uit[k === 'Leggen door Ideaal' ? 'Leggen' : k] = regel.slice(k.length + 2);
      }
    }
    if ((uit.Opmerking || '-') === '-') delete uit.Opmerking;
    if ((uit.Plinten || '0 m').startsWith('0 m')) delete uit.Plinten;
    if ((uit.Ondervloer || 'Geen').startsWith('Geen')) delete uit.Ondervloer;
    return uit;
  }

  async function toonBestellingen(f) {
    cache.bestellingen = (await api('bestellingen')).bestellingen;
    const alle = cache.bestellingen;
    const lijst = alle.filter((b) => inFilter(b, f));
    const tabs = { open: 'Open', klaar: 'Afgerond', alle: 'Alle' };
    kader('bestellingen', `<div class="kop"><h1>Bestellingen</h1></div>
      <div class="tabs">${Object.entries(tabs).map(([k, t]) => `<a href="#bestellingen/${k}" class="${f === k ? 'actief' : ''}">${t} <span>${alle.filter((b) => inFilter(b, k)).length}</span></a>`).join('')}</div>
      ${lijst.length ? '' : `<div class="leeg">${f === 'open' ? 'Geen open bestellingen. Nieuwe aanvragen van de website verschijnen hier vanzelf.' : 'Nog niets te tonen.'}</div>`}
      ${lijst.map((b) => {
        const d = new Date(b.datum);
        const x = extra(b.tekst);
        return `<details class="bestelling st-${h(b.status)}" data-id="${h(b.id)}"${b.status === 'nieuw' ? ' open' : ''}>
          <summary><span class="b-naam">${h(b.naam)}</span>
            <span class="b-datum">${d.toLocaleDateString('nl-NL')} ${d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}</span>
            <span class="b-bedrag">${eur(b.totaal)}</span><span class="pil">${h(STATUS[b.status] || b.status)}</span></summary>
          <div class="b-body"><div class="b-kolommen">
            <div><h3>Klant</h3><p>${h(b.naam)}<br>${h(b.adres)}</p>
              <p><a href="tel:${h(String(b.telefoon).replace(/[^0-9+]/g, ''))}">${h(b.telefoon)}</a><br><a href="mailto:${h(b.email)}">${h(b.email)}</a></p></div>
            <div><h3>Vloeren</h3>
              ${b.regels.length ? `<table>${b.regels.map((r) => `<tr><td>${h(r.naam)}</td><td>${r.pakken} ${r.pakken === 1 ? 'pak' : 'pakken'} (${komma(Number(r.m2).toFixed(2))} m²)</td><td>${eur(r.bedrag)}</td></tr>`).join('')}</table>` : '<p>Zie de volledige aanvraag hieronder.</p>'}
              ${Object.keys(x).length ? `<dl class="extra">${Object.entries(x).map(([k, v]) => `<dt>${h(k)}</dt><dd>${h(v)}</dd>`).join('')}</dl>` : ''}
            </div></div>
            <details class="volledig"><summary>Volledige aanvraag</summary><pre>${h(b.tekst)}</pre></details>
            <div class="b-acties">
              <div class="status-form"><label for="s-${h(b.id)}">Status</label>
                <select id="s-${h(b.id)}">${Object.entries(STATUS).map(([k, t]) => `<option value="${k}"${b.status === k ? ' selected' : ''}>${t}</option>`).join('')}</select>
                <button class="knop klein" data-actie="status">Opslaan</button></div>
              <button class="link rood" data-actie="weg">Verwijderen</button>
            </div></div></details>`;
      }).join('')}`);

    app.querySelectorAll('.bestelling').forEach((el) => {
      const id = el.dataset.id; const b = alle.find((x) => x.id === id);
      el.querySelector('[data-actie=status]').addEventListener('click', async (e) => {
        e.target.disabled = true;
        try { await api('bestellingen/' + id, { method: 'POST', body: { status: el.querySelector('select').value } }); melding = 'Status aangepast.'; }
        catch (err) { melding = err.message; }
        toonBestellingen(f);
      });
      el.querySelector('[data-actie=weg]').addEventListener('click', async () => {
        if (!confirm(`Bestelling van ${b.naam} definitief verwijderen?`)) return;
        try { await api('bestellingen/' + id, { method: 'DELETE' }); melding = 'Bestelling verwijderd.'; } catch (err) { melding = err.message; }
        toonBestellingen(f);
      });
    });
  }

  /* ---------- Producten ---------- */
  async function toonProducten() {
    const lijst = cache.producten = (await api('producten')).producten;
    kader('producten', `<div class="kop"><h1>Producten <small>${lijst.length}</small></h1><a class="knop" href="#product">+ Nieuw product</a></div>
      <ul class="producten">${lijst.map((p) => `<li data-id="${h(p.id)}">
        <img src="${h(foto(p))}" alt="" width="64" height="64" loading="lazy">
        <div class="pr-info"><strong>${h(p.naam)}</strong><span>${h(p.type)} · ${h(p.dikte)} mm · ${h(p.klasse)}</span></div>
        <div class="pr-prijs">${eur(p.prijs)}<span>per m²</span></div>
        <div class="pr-acties"><a class="knop klein licht" href="#product/${encodeURIComponent(p.id)}">Bewerken</a><button class="link rood">Verwijderen</button></div>
      </li>`).join('')}</ul>`);
    app.querySelectorAll('.producten li').forEach((li) => {
      li.querySelector('button.rood').addEventListener('click', async () => {
        const p = lijst.find((x) => x.id === li.dataset.id);
        if (!confirm(`${p.naam} verwijderen van de website?`)) return;
        try { await api('producten/' + encodeURIComponent(p.id), { method: 'DELETE' }); melding = `${p.naam} is verwijderd van de website.`; }
        catch (err) { melding = err.message; }
        toonProducten();
      });
    });
  }

  /* Foto in de browser vierkant maken (800 × 800), zodat ook grote telefoonfoto's altijd lukken. */
  async function maakFoto(bestand) {
    const bm = await createImageBitmap(bestand);
    const z = Math.min(bm.width, bm.height);
    const c = document.createElement('canvas'); c.width = 800; c.height = 800;
    c.getContext('2d').drawImage(bm, (bm.width - z) / 2, (bm.height - z) / 2, z, z, 0, 0, 800, 800);
    return c.toDataURL('image/jpeg', 0.85);
  }

  async function toonProduct(id) {
    if (!cache.producten) cache.producten = (await api('producten')).producten;
    const bestaand = cache.producten.find((x) => x.id === id);
    const p = bestaand || { id: '', naam: '', lijn: '', type: 'Plank', tint: 'Naturel', dikte: 8, klasse: 'AC4', formaat: '', pak: '', prijs: '', water: false, tekst: '' };
    const opties = (lijst, w) => lijst.map((o) => `<option${o === w ? ' selected' : ''}>${o}</option>`).join('');
    kader('producten', `<div class="kop"><h1>${bestaand ? 'Product bewerken' : 'Nieuw product'}</h1><a class="link" href="#producten">Terug naar producten</a></div>
      <p class="fout" role="alert" hidden></p>
      <form class="product-form" id="pf" novalidate><div class="pf-grid">
        <div class="pf-foto">
          <label for="foto">Foto ${bestaand ? '<small>(alleen kiezen om te vervangen)</small>' : ''}</label>
          <div class="foto-vak"><img id="foto-voorbeeld" src="${bestaand ? h(foto(p)) : ''}" alt=""${bestaand ? '' : ' hidden'}><span${bestaand ? ' hidden' : ''}>Nog geen foto</span></div>
          <input type="file" id="foto" accept="image/*">
          <p class="hint">Er wordt automatisch een vierkante uitsnede gemaakt.</p>
        </div>
        <div class="pf-velden">
          <label>Naam <input name="naam" value="${h(p.naam)}" maxlength="60" required placeholder="bijv. Eiken Naturel"></label>
          <label>Beschrijving <textarea name="tekst" rows="5" maxlength="600" required placeholder="Korte beschrijving voor op de website">${h(p.tekst)}</textarea></label>
          <div class="rij">
            <label>Prijs per m² (€) <input name="prijs" value="${h(komma(p.prijs))}" inputmode="decimal" required placeholder="24,95"></label>
            <label>m² per pak <input name="pak" value="${h(komma(p.pak))}" inputmode="decimal" required placeholder="2,13"></label>
          </div>
          <div class="rij">
            <label>Soort <select name="type">${opties(TYPES, p.type)}</select></label>
            <label>Kleur <select name="tint">${opties(TINTEN, p.tint)}</select></label>
          </div>
          <div class="rij">
            <label>Dikte (mm) <input name="dikte" value="${h(p.dikte)}" inputmode="numeric" required></label>
            <label>Slijtklasse <select name="klasse">${opties(KLASSEN, p.klasse)}</select></label>
          </div>
          <div class="rij">
            <label>Formaat plank <input name="formaat" value="${h(p.formaat === '-' ? '' : p.formaat)}" maxlength="40" placeholder="bijv. 1380 × 193 mm"></label>
            <label>Collectie <input name="lijn" value="${h(p.lijn)}" maxlength="30" placeholder="bijv. Classic"></label>
          </div>
          <label class="vink"><input type="checkbox" name="water"${p.water ? ' checked' : ''}> Waterbestendig</label>
          <div class="pf-acties"><button class="knop">Opslaan en op de website zetten</button><a class="link" href="#producten">Annuleren</a></div>
        </div></div></form>`);

    const f = document.getElementById('pf');
    const fo = app.querySelector('.fout');
    let fotoData = null;
    document.getElementById('foto').addEventListener('change', async (e) => {
      const b = e.target.files[0]; if (!b) return;
      try {
        fotoData = await maakFoto(b);
        const vb = document.getElementById('foto-voorbeeld'); vb.src = fotoData; vb.hidden = false; vb.nextElementSibling.hidden = true;
      } catch (err) { fotoData = null; fo.textContent = 'Deze foto kan niet worden gelezen. Kies een JPG- of PNG-foto.'; fo.hidden = false; }
    });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const knop = f.querySelector('.pf-acties .knop');
      knop.disabled = true; knop.textContent = 'Opslaan…'; fo.hidden = true;
      try {
        const r = await api('producten', { method: 'POST', body: {
          id: p.id, naam: f.naam.value, tekst: f.tekst.value, prijs: f.prijs.value, pak: f.pak.value, type: f.type.value, tint: f.tint.value,
          dikte: f.dikte.value, klasse: f.klasse.value, formaat: f.formaat.value, lijn: f.lijn.value, water: f.water.checked, foto: fotoData } });
        cache.producten = null;
        melding = `${r.product.naam} is opgeslagen en staat op de website.`;
        location.hash = '#producten';
      } catch (err) {
        fo.textContent = err.message; fo.hidden = false; knop.disabled = false; knop.textContent = 'Opslaan en op de website zetten';
        window.scrollTo(0, 0);
      }
    });
  }

  /* ---------- Account ---------- */
  function toonAccount() {
    kader('', `<div class="kop"><h1>Wachtwoord wijzigen</h1></div>
      <form class="product-form smal" id="ww">
        <div class="pf-velden">
          <label>Huidig wachtwoord <input type="password" name="oud" autocomplete="current-password" required></label>
          <label>Nieuw wachtwoord <input type="password" name="nieuw" autocomplete="new-password" minlength="8" required></label>
          <p class="fout" role="alert" hidden></p>
          <div class="pf-acties"><button class="knop">Wachtwoord opslaan</button></div>
        </div></form>`);
    const f = document.getElementById('ww');
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      try { await api('wachtwoord', { method: 'POST', body: { oud: f.oud.value, nieuw: f.nieuw.value } }); melding = 'Wachtwoord gewijzigd.'; location.hash = '#bestellingen'; }
      catch (err) { const fo = f.querySelector('.fout'); fo.textContent = err.message; fo.hidden = false; }
    });
  }

  start();
})();
