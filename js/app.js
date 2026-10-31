(function () {
  const D = window.IDEAAL;
  const page = document.body.dataset.page;
  const R = document.body.dataset.root || ''; // pad naar de hoofdmap vanaf deze pagina
  const eur = (n) => '€ ' + n.toFixed(2).replace('.', ',');
  const m2 = (n) => n.toFixed(2).replace('.', ',') + ' m²';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const byId = (id) => D.laminaat.find((p) => p.id === id);
  const img = (p) => R + (p.foto || 'img/laminaat/' + p.id + '.jpg');
  const productUrl = (p) => R + 'laminaat/' + p.id + '.html';
  const snijverlies = (p) => (p.type === 'Visgraat' ? 0.10 : D.snijverlies);
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  // Leest "5,2", "5.2" of "1.250,5" als getal; ongeldig of niet eindig wordt NaN.
  const num = (v) => {
    let t = String(v == null ? '' : v).trim().replace(/\s/g, '');
    if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
    if (!/^-?\d*\.?\d+$/.test(t)) return NaN;
    return Number(t);
  };
  const MAX_PAKKEN = 999;

  /* ---------- Winkelwagen (alleen in deze browser) ---------- */
  const KEY = 'ideaal-bestelling';
  const cart = {
    // Alleen geldige regels: bekend product en een heel aantal pakken (1..MAX_PAKKEN).
    get() {
      let raw;
      try { raw = JSON.parse(localStorage.getItem(KEY)); } catch (e) { raw = null; }
      if (!Array.isArray(raw)) return [];
      const out = [];
      raw.forEach((i) => {
        if (!i || typeof i.id !== 'string' || !byId(i.id)) return;
        const n = Math.min(MAX_PAKKEN, Math.floor(Number(i.pakken)));
        if (!(n >= 1)) return;
        const hit = out.find((o) => o.id === i.id);
        if (hit) hit.pakken = Math.min(MAX_PAKKEN, hit.pakken + n); else out.push({ id: i.id, pakken: n });
      });
      return out;
    },
    set(items) {
      let ok = true;
      try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) { ok = false; }
      updateCount();
      return ok;
    },
    add(id, pakken) {
      const items = cart.get();
      const hit = items.find((i) => i.id === id);
      if (hit) hit.pakken = Math.min(MAX_PAKKEN, hit.pakken + pakken); else items.push({ id, pakken: Math.min(MAX_PAKKEN, pakken) });
      return cart.set(items) && cart.get().some((i) => i.id === id);
    }
  };
  function updateCount() {
    const n = cart.get().reduce((s, i) => s + i.pakken, 0);
    $$('.cart-count').forEach((el) => (el.textContent = n));
  }

  /* ---------- Header en footer ---------- */
  const solid = page !== 'home';
  const logo = `<img src="${R}img/logo-licht.svg" alt="">`;
  const headerLogo = solid ? `<img src="${R}img/logo.svg" alt="">` : logo;
  const navItems = [
    ['index.html#diensten', 'Diensten', 'diensten'],
    ['laminaat.html', 'Laminaat', 'laminaat'],
    ['kennisbank.html', 'Kennisbank', 'kennisbank'],
    ['index.html#over', 'Over ons', 'over'],
    ['index.html#contact', 'Contact', 'contact']
  ];
  $('#site-header').outerHTML = `
    <div class="topbar"><div class="wrap">
      <span>Vloeren · Meubels · Trapbekleding · Raamdecoratie</span>
      <span class="hide-sm">Bel ons: <a href="${D.telefoonLink}">${D.telefoon}</a></span>
    </div></div>
    <header class="header${solid ? ' solid' : ''}"><div class="wrap">
      <a class="brand" href="${R}index.html" aria-label="Ideaal Meubel &amp; Vloer, home">${headerLogo}
        <span class="brand-text"><strong>IDEAAL</strong><span>Meubel &amp; Vloer</span></span></a>
      <nav class="nav" id="nav">${navItems.map(([h, t, k]) => `<a href="${R}${h}"${k === page ? ' class="active"' : ''}>${t}</a>`).join('')}</nav>
      <div class="header-actions">
        <a class="cart-link" href="${R}bestellen.html">Bestelling <span class="cart-count">0</span></a>
        <a class="btn btn-brass" href="${R}index.html#contact">Afspraak maken</a>
        <button type="button" class="menu-toggle" aria-label="Menu" aria-controls="nav" aria-expanded="false"><span></span></button>
      </div>
    </div></header>`;

  $('#site-footer').outerHTML = `
    <footer class="footer"><div class="wrap">
      <div class="footer-grid">
        <div>
          <a class="brand" href="${R}index.html" aria-label="Ideaal Meubel &amp; Vloer, home">${logo}<span class="brand-text"><strong>IDEAAL</strong><span>Meubel &amp; Vloer</span></span></a>
          <p>Alles onder één dak. Al 20 jaar specialist in vloeren, meubels, trapbekleding en raamdecoratie.</p>
        </div>
        <div><h4>Collectie</h4><ul>
          <li><a href="${R}laminaat.html">Laminaat</a></li>
          <li><a href="${R}laminaat.html?type=Visgraat">Visgraat</a></li>
          <li><a href="${R}laminaat.html?water=1">Waterbestendig</a></li>
          <li><a href="${R}kennisbank.html">Kennisbank</a></li>
          <li><a href="${R}bestellen.html">Uw bestelling</a></li></ul></div>
        <div><h4>Diensten</h4><ul>
          <li><a href="${R}index.html#diensten">Vloeren leggen</a></li>
          <li><a href="${R}index.html#diensten">Trapbekleding</a></li>
          <li><a href="${R}index.html#diensten">Meubels</a></li>
          <li><a href="${R}index.html#diensten">Raamdecoratie</a></li></ul></div>
        <div><h4>Contact</h4><ul>
          <li>${esc(D.adres.straat)}<br>${esc(D.adres.postcode)} ${esc(D.adres.plaats)}</li>
          <li><a href="${D.telefoonLink}">${D.telefoon}</a></li>
          <li><a href="mailto:${D.email}">${D.email}</a></li>
          <li><a href="https://www.instagram.com/ideaalmeubel/" target="_blank" rel="noopener">Instagram</a></li></ul></div>
      </div>
      <div class="footer-bottom"><span>© ${new Date().getFullYear()} Ideaal Meubel &amp; Vloer</span><span>Alle prijzen zijn inclusief btw</span></div>
    </div></footer>`;

  $('.menu-toggle').addEventListener('click', (e) => { const open = $('#nav').classList.toggle('open'); e.currentTarget.setAttribute('aria-expanded', open); });
  $$('#nav a').forEach((a) => a.addEventListener('click', () => { $('#nav').classList.remove('open'); $('.menu-toggle').setAttribute('aria-expanded', 'false'); }));
  updateCount();
  // Bestelling in een ander tabblad aangepast: teller bijwerken.
  window.addEventListener('storage', (e) => { if (e.key === KEY || e.key === null) updateCount(); });

  /* ---------- Productkaart ---------- */
  const card = (p) => `
    <a class="card" href="${productUrl(p)}">
      <div class="card-img"><img src="${img(p)}" alt="${esc(p.naam)} laminaat" loading="lazy">
        ${p.water ? '<span class="card-tag">Waterbestendig</span>' : ''}</div>
      <div class="card-body">
        <div><h3>${esc(p.naam)}</h3><div class="card-meta">${esc(p.type)} · ${esc(p.dikte)} mm · ${esc(p.klasse)}</div></div>
        <div class="card-price"><strong>${eur(p.prijs)}</strong><span>per m²</span></div>
      </div>
    </a>`;

  /* ---------- Home: uitgelicht ---------- */
  if (page === 'home') {
    const pick = ['eiken-gerookt', 'visgraat-naturel', 'eiken-grijs-rustiek'].map(byId).filter(Boolean);
    D.laminaat.forEach((p) => { if (pick.length < 3 && !pick.includes(p)) pick.push(p); });
    $('#featured').innerHTML = pick.map(card).join('');
  }

  /* ---------- Collectie met filters ---------- */
  if (page === 'laminaat') {
    const qs = new URLSearchParams(location.search);
    const groups = { type: ['Plank', 'Visgraat', 'Tegeldessin'], tint: ['Licht', 'Naturel', 'Grijs', 'Donker'], dikte: [8, 10, 12] };
    const labels = { type: 'Type', tint: 'Kleur', dikte: 'Dikte' };
    $('#filters').innerHTML = Object.entries(groups).map(([k, opts]) => `
      <div class="filter-group"><h4>${labels[k]}</h4>
        ${opts.map((o) => `<label><input type="checkbox" name="${k}" value="${o}"${qs.getAll(k).includes(String(o)) ? ' checked' : ''}> ${o}${k === 'dikte' ? ' mm' : ''}</label>`).join('')}
      </div>`).join('') + `
      <div class="filter-group"><h4>Eigenschappen</h4>
        <label><input type="checkbox" name="water" value="1"${qs.get('water') === '1' ? ' checked' : ''}> Waterbestendig</label></div>`;

    const render = () => {
      const sel = (k) => $$(`#filters input[name=${k}]:checked`).map((i) => i.value);
      const t = sel('type'), c = sel('tint'), d = sel('dikte').map(Number), w = sel('water').length > 0;
      let list = D.laminaat.filter((p) =>
        (!t.length || t.includes(p.type)) && (!c.length || c.includes(p.tint)) &&
        (!d.length || d.includes(p.dikte)) && (!w || p.water));
      const s = $('#sort').value;
      if (s === 'laag') list.sort((a, b) => a.prijs - b.prijs);
      if (s === 'hoog') list.sort((a, b) => b.prijs - a.prijs);
      if (s === 'naam') list.sort((a, b) => a.naam.localeCompare(b.naam));
      $('#count').textContent = list.length + (list.length === 1 ? ' vloer' : ' vloeren');
      $('#products').innerHTML = list.length ? list.map(card).join('') :
        '<p class="empty">Geen vloeren gevonden met deze filters. Pas uw keuze aan of bel ons voor advies.</p>';
    };
    $('#filters').addEventListener('change', render);
    $('#sort').addEventListener('change', render);
    $('.filter-toggle').addEventListener('click', () => $('#filters').classList.toggle('open'));
    render();
  }

  /* ---------- Productpagina met m²-berekening ---------- */
  if (page === 'product') {
    const p = byId(document.body.dataset.product || new URLSearchParams(location.search).get('id'));
    if (!p) {
      document.title = 'Vloer niet gevonden | Ideaal Meubel & Vloer';
      $('.product').innerHTML = `<div class="done"><span class="kicker">Laminaat</span><h2>Deze vloer bestaat niet (meer)</h2>
        <p class="lead">Mogelijk is de link verouderd. Bekijk de actuele collectie of bel ons voor advies.</p>
        <a class="btn btn-dark" href="${R}laminaat.html">Bekijk de collectie <i class="arrow"></i></a></div>`;
      $('#crumb-name').textContent = 'Niet gevonden';
      $('#related').innerHTML = D.laminaat.slice(0, 3).map(card).join('');
      return;
    }
    if (!document.body.dataset.product) document.title = p.naam + ' laminaat | Ideaal Meubel & Vloer';
    $('#crumb-name').textContent = p.naam;
    $('#p-img').src = img(p); $('#p-img').alt = p.naam + ' laminaat';
    $('#p-lijn').textContent = 'Collectie ' + p.lijn;
    $('#p-naam').textContent = p.naam;
    $('#p-prijs').innerHTML = `${eur(p.prijs)} <small>per m² · ${eur(p.prijs * p.pak)} per pak</small>`;
    $('#p-tekst').textContent = p.tekst;
    $('#p-specs').innerHTML = [
      ['Type', p.type], ['Dikte', p.dikte + ' mm'], ['Slijtklasse', p.klasse], ['Formaat plank', p.formaat],
      ['Inhoud per pak', m2(p.pak)], ['Waterbestendig', p.water ? 'Ja' : 'Nee']
    ].map(([a, b]) => `<div><dt>${a}</dt><dd>${esc(b)}</dd></div>`).join('');

    const calc = () => {
      // Elke maat moet tussen 0 en 100 m liggen; anders geen berekening.
      const ok = (v) => v > 0 && v <= 100;
      const l = num($('#lengte').value), b = num($('#breedte').value);
      const opp = ok(l) && ok(b) ? l * b : 0;
      const pakken = opp > 0 ? Math.min(MAX_PAKKEN, Math.ceil((opp * (1 + snijverlies(p))) / p.pak - 1e-9)) : 0;
      $('#r-opp').textContent = m2(opp);
      $('#r-pakken').textContent = pakken + (pakken === 1 ? ' pak' : ' pakken');
      $('#r-prijs').textContent = eur(pakken * p.pak * p.prijs);
      $('#add').disabled = pakken === 0;
      return pakken;
    };
    if ($('#r-label')) $('#r-label').textContent = 'Benodigd incl. ' + Math.round(snijverlies(p) * 100) + '% snijverlies';
    const added = $('#added'), addedHTML = added.innerHTML;
    $$('#lengte, #breedte').forEach((i) => i.addEventListener('input', () => { calc(); added.classList.remove('show'); }));
    $('#add').addEventListener('click', () => {
      const n = calc(); if (!n) return;
      added.innerHTML = cart.add(p.id, n) ? addedHTML :
        `Toevoegen lukt niet: uw browser blokkeert opslag (bijv. privévenster). Bel ons op <a href="${D.telefoonLink}">${D.telefoon}</a> of mail naar <a href="mailto:${D.email}">${D.email}</a>.`;
      added.classList.add('show');
    });
    calc();
    $('#related').innerHTML = D.laminaat.filter((x) => x.id !== p.id && (x.type === p.type || x.tint === p.tint)).slice(0, 3).map(card).join('');
  }

  /* ---------- Bestellen (aanvraag, geen betaling) ---------- */
  if (page === 'bestellen') {
    $('#ondervloer').innerHTML = D.ondervloer.map((o) =>
      `<option value="${o.id}">${o.naam}${o.prijs ? ', ' + eur(o.prijs) + ' per m²' : ''}</option>`).join('');

    const totals = () => {
      const items = cart.get().filter((i) => byId(i.id));
      const opp = items.reduce((s, i) => s + i.pakken * byId(i.id).pak, 0);
      const vloer = items.reduce((s, i) => s + i.pakken * byId(i.id).pak * byId(i.id).prijs, 0);
      const ov = D.ondervloer.find((o) => o.id === $('#ondervloer').value) || D.ondervloer[0];
      const ondervloer = opp * ov.prijs;
      const pv = num($('#plinten').value);
      const plintM = pv > 0 ? Math.min(pv, 1000) : 0;
      const plinten = plintM * D.plintPrijs;
      return { items, opp, vloer, ov, ondervloer, plintM, plinten, totaal: vloer + ondervloer + plinten };
    };

    const render = () => {
      const t = totals();
      if (!t.items.length) {
        $('#order-wrap').innerHTML = `<div class="done"><span class="kicker">Uw bestelling</span><h2>Nog geen vloer gekozen</h2>
          <p class="lead">Kies een laminaat uit de collectie, vul de afmetingen van uw ruimte in en wij rekenen het aantal pakken voor u uit.</p>
          <a class="btn btn-dark" href="${R}laminaat.html">Bekijk de collectie <i class="arrow"></i></a></div>`;
        return;
      }
      const meta = (p, i) => `${p.dikte} mm · ${m2(p.pak)} per pak · ${m2(i.pakken * p.pak)} totaal`;
      const shown = $$('.cart-line').map((l) => l.dataset.id).join('|');
      if (shown === t.items.map((i) => i.id).join('|')) {
        // Zelfde regels: alleen teksten bijwerken, zodat focus en knoppen blijven staan.
        t.items.forEach((i, n) => {
          const p = byId(i.id), line = $$('.cart-line')[n], inp = $('.qty input', line);
          if (document.activeElement !== inp || Number(inp.value) !== i.pakken) inp.value = i.pakken;
          $('.meta', line).textContent = meta(p, i);
          $('.line-total', line).textContent = eur(i.pakken * p.pak * p.prijs);
        });
      } else $('#lines').innerHTML = t.items.map((i) => {
        const p = byId(i.id);
        return `<div class="cart-line" data-id="${p.id}">
          <img src="${img(p)}" alt="">
          <div><h3>${esc(p.naam)}</h3><div class="meta">${meta(p, i)}</div>
            <div class="qty"><button type="button" data-d="-1" aria-label="Minder">−</button><input type="number" min="1" max="${MAX_PAKKEN}" step="1" value="${i.pakken}" aria-label="Aantal pakken"><button type="button" data-d="1" aria-label="Meer">+</button></div>
            <button type="button" class="remove">Verwijderen</button></div>
          <div class="line-total">${eur(i.pakken * p.pak * p.prijs)}</div></div>`;
      }).join('');
      $('#sum').innerHTML = `
        <div class="sum-row"><span>Laminaat (${m2(t.opp)})</span><span>${eur(t.vloer)}</span></div>
        <div class="sum-row"><span>${t.ov.naam}</span><span>${eur(t.ondervloer)}</span></div>
        <div class="sum-row"><span>Plinten (${String(t.plintM).replace('.', ',')} m)</span><span>${eur(t.plinten)}</span></div>
        <div class="sum-row"><span>Leggen</span><span>${$('input[name=leggen]:checked').value === 'ja' ? 'Op offerte' : 'Zelf leggen'}</span></div>
        <div class="sum-row total"><span>Totaal indicatie</span><span>${eur(t.totaal)}</span></div>`;
    };

    // Na een re-render de focus terugzetten op hetzelfde element in dezelfde regel (toetsenbord).
    const rerender = (focusId) => {
      const had = focusId && document.activeElement && document.activeElement.closest('.cart-line');
      render();
      // Regel verwijderd: focus naar de eerste overgebleven regel of het naamveld.
      if (had && !document.activeElement.closest('.cart-line') && $('#lines')) ($('.cart-line .qty input') || $('#naam')).focus();
    };
    const setQty = (input) => {
      const items = cart.get(); const id = input.closest('.cart-line').dataset.id;
      const it = items.find((i) => i.id === id); if (!it) return;
      const v = Math.floor(Number(input.value));
      it.pakken = Math.min(MAX_PAKKEN, v >= 1 ? v : it.pakken);
      cart.set(items);
    };
    $('#order-wrap').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-d], .remove'); if (!btn) return;
      const line = btn.closest('.cart-line'); if (!line) return;
      const items = cart.get(); const it = items.find((i) => i.id === line.dataset.id);
      if (it && btn.matches('[data-d]')) it.pakken = Math.min(MAX_PAKKEN, Math.max(1, it.pakken + Number(btn.dataset.d)));
      if (it && btn.matches('.remove')) items.splice(items.indexOf(it), 1);
      cart.set(items);
      rerender(line.dataset.id);
    });
    $('#order-wrap').addEventListener('change', (e) => {
      if (e.target.matches('.qty input')) { setQty(e.target); render(); return; }
      if (e.target.closest('#sum, #lines') || e.target.matches('#ondervloer, input[name=leggen]')) render();
    });
    // Enter in een aantal-veld: aantal vastleggen i.p.v. het formulier te versturen.
    $('#order-wrap').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches('.qty input')) {
        e.preventDefault(); setQty(e.target);
        render();
      }
    });
    $('#plinten').addEventListener('input', render);
    // Bestelling gewijzigd in een ander tabblad.
    window.addEventListener('storage', (e) => { if ($('#lines') && (e.key === KEY || e.key === null)) render(); });

    $('#order-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      // Nog niet vastgelegde aantallen (getypt zonder blur) eerst opslaan.
      $$('.cart-line .qty input').forEach(setQty);
      const f = new FormData(e.target); const t = totals();
      if (!t.items.length) { render(); return; }
      const regels = t.items.map((i) => { const p = byId(i.id); return `- ${p.naam}: ${i.pakken} pakken (${m2(i.pakken * p.pak)}) = ${eur(i.pakken * p.pak * p.prijs)}`; });
      const tekst = [
        'BESTELAANVRAAG LAMINAAT', '', ...regels, '',
        `Ondervloer: ${t.ov.naam} (${eur(t.ondervloer)})`, `Plinten: ${t.plintM} m (${eur(t.plinten)})`,
        `Leggen door Ideaal: ${f.get('leggen') === 'ja' ? 'ja, graag een offerte' : 'nee, zelf leggen'}`,
        `Levering: ${f.get('levering') === 'bezorgen' ? 'bezorgen' : 'ophalen in de winkel'}`,
        `Totaal indicatie: ${eur(t.totaal)}`, '',
        `Naam: ${f.get('naam')}`, `Telefoon: ${f.get('telefoon')}`, `E-mail: ${f.get('email')}`,
        `Adres: ${f.get('adres')}, ${f.get('postcode')} ${f.get('plaats')}`, '', `Opmerking: ${f.get('opmerking') || '-'}`
      ].join('\n');
      const btn = $('#send'); btn.disabled = true; btn.textContent = 'Versturen…';
      let ok = false;
      try {
        const ctrl = new AbortController(); setTimeout(() => ctrl.abort(), 15000);
        const r = await fetch('/api/bestelling', { signal: ctrl.signal, method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            naam: f.get('naam'), email: f.get('email'), telefoon: f.get('telefoon'),
            adres: `${f.get('adres')}, ${f.get('postcode')} ${f.get('plaats')}`,
            regels: t.items.map((i) => ({ id: i.id, pakken: i.pakken })),
            totaal: Math.round(t.totaal * 100) / 100, tekst
          }) });
        ok = r.ok && (await r.json()).ok === true;
      } catch (err) { ok = false; }
      const mailto = `mailto:${D.email}?subject=${encodeURIComponent('Bestelaanvraag laminaat - ' + f.get('naam'))}&body=${encodeURIComponent(tekst)}`;
      if (!ok) location.href = mailto;
      cart.set([]);
      const voornaam = esc(String(f.get('naam')).trim().split(/\s+/)[0]);
      $('#order-wrap').innerHTML = `<div class="done"><span class="kicker">${ok ? 'Aanvraag ontvangen' : 'Bijna klaar'}</span><h2>Bedankt, ${voornaam}</h2>
        <p class="lead">${ok ? 'Wij hebben uw bestelaanvraag ontvangen.' : 'Uw e-mailprogramma opent met de bestelling. Verstuur die mail om de aanvraag af te ronden.'}
        Binnen één werkdag nemen wij contact met u op om de bestelling, levering en betaling te bevestigen.</p>
        ${ok ? '' : `<p>Opent er geen e-mail? <a href="${esc(mailto)}">Open de e-mail opnieuw</a> of bel ons op <a href="${D.telefoonLink}">${D.telefoon}</a>.</p>`}
        <a class="btn btn-dark" href="${R}index.html">Terug naar home <i class="arrow"></i></a></div>`;
      window.scrollTo(0, 0);
    });
    render();
  }
})();
