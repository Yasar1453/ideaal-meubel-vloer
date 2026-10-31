(function () {
  const D = window.IDEAAL;
  const page = document.body.dataset.page;
  const eur = (n) => '€ ' + n.toFixed(2).replace('.', ',');
  const m2 = (n) => n.toFixed(2).replace('.', ',') + ' m²';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const byId = (id) => D.laminaat.find((p) => p.id === id);
  const img = (p) => 'img/laminaat/' + p.id + '.jpg';

  /* ---------- Winkelwagen (alleen in deze browser) ---------- */
  const KEY = 'ideaal-bestelling';
  const cart = {
    get() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } },
    set(items) { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {} updateCount(); },
    add(id, pakken) {
      const items = cart.get();
      const hit = items.find((i) => i.id === id);
      if (hit) hit.pakken += pakken; else items.push({ id, pakken });
      cart.set(items);
    }
  };
  function updateCount() {
    const n = cart.get().reduce((s, i) => s + i.pakken, 0);
    $$('.cart-count').forEach((el) => (el.textContent = n));
  }

  /* ---------- Header en footer ---------- */
  const solid = page !== 'home';
  const logo = '<img src="img/logo-licht.svg" alt="">';
  const headerLogo = solid ? '<img src="img/logo.svg" alt="">' : logo;
  const navItems = [
    ['index.html#diensten', 'Diensten', 'diensten'],
    ['laminaat.html', 'Laminaat', 'laminaat'],
    ['index.html#werkwijze', 'Werkwijze', 'werkwijze'],
    ['index.html#over', 'Over ons', 'over'],
    ['index.html#contact', 'Contact', 'contact']
  ];
  $('#site-header').outerHTML = `
    <div class="topbar"><div class="wrap">
      <span>Vloeren · Meubels · Trapbekleding · Raamdecoratie</span>
      <span class="hide-sm">Bel ons: <a href="${D.telefoonLink}">${D.telefoon}</a></span>
    </div></div>
    <header class="header${solid ? ' solid' : ''}"><div class="wrap">
      <a class="brand" href="index.html" aria-label="Ideaal Meubel &amp; Vloer, home">${headerLogo}
        <span class="brand-text"><strong>IDEAAL</strong><span>Meubel &amp; Vloer</span></span></a>
      <nav class="nav" id="nav">${navItems.map(([h, t, k]) => `<a href="${h}"${k === page ? ' class="active"' : ''}>${t}</a>`).join('')}</nav>
      <div class="header-actions">
        <a class="cart-link" href="bestellen.html">Bestelling <span class="cart-count">0</span></a>
        <a class="btn btn-brass" href="index.html#contact">Afspraak maken</a>
        <button class="menu-toggle" aria-label="Menu" aria-controls="nav"><span></span></button>
      </div>
    </div></header>`;

  $('#site-footer').outerHTML = `
    <footer class="footer"><div class="wrap">
      <div class="footer-grid">
        <div>
          <a class="brand" href="index.html">${logo}<span class="brand-text"><strong>IDEAAL</strong><span>Meubel &amp; Vloer</span></span></a>
          <p>Alles onder één dak. Al 20 jaar specialist in vloeren, meubels, trapbekleding en raamdecoratie.</p>
        </div>
        <div><h4>Collectie</h4><ul>
          <li><a href="laminaat.html">Laminaat</a></li>
          <li><a href="laminaat.html?type=Visgraat">Visgraat</a></li>
          <li><a href="laminaat.html?water=1">Waterbestendig</a></li>
          <li><a href="bestellen.html">Uw bestelling</a></li></ul></div>
        <div><h4>Diensten</h4><ul>
          <li><a href="index.html#diensten">Vloeren leggen</a></li>
          <li><a href="index.html#diensten">Trapbekleding</a></li>
          <li><a href="index.html#diensten">Meubels</a></li>
          <li><a href="index.html#diensten">Raamdecoratie</a></li></ul></div>
        <div><h4>Contact</h4><ul>
          <li><a href="${D.telefoonLink}">${D.telefoon}</a></li>
          <li><a href="mailto:${D.email}">${D.email}</a></li>
          <li><a href="https://www.instagram.com/ideaalmeubel/" target="_blank" rel="noopener">Instagram</a></li></ul></div>
      </div>
      <div class="footer-bottom"><span>© ${new Date().getFullYear()} Ideaal Meubel &amp; Vloer</span><span>Alle prijzen zijn inclusief btw</span></div>
    </div></footer>`;

  $('.menu-toggle').addEventListener('click', () => $('#nav').classList.toggle('open'));
  $$('#nav a').forEach((a) => a.addEventListener('click', () => $('#nav').classList.remove('open')));
  updateCount();

  /* ---------- Productkaart ---------- */
  const card = (p) => `
    <a class="card" href="product.html?id=${p.id}">
      <div class="card-img"><img src="${img(p)}" alt="${p.naam} laminaat" loading="lazy">
        ${p.water ? '<span class="card-tag">Waterbestendig</span>' : ''}</div>
      <div class="card-body">
        <div><h3>${p.naam}</h3><div class="card-meta">${p.type} · ${p.dikte} mm · ${p.klasse}</div></div>
        <div class="card-price"><strong>${eur(p.prijs)}</strong><span>per m²</span></div>
      </div>
    </a>`;

  /* ---------- Home: uitgelicht ---------- */
  if (page === 'home') {
    const pick = ['eiken-gerookt', 'visgraat-naturel', 'eiken-grijs-rustiek'].map(byId);
    $('#featured').innerHTML = pick.map(card).join('');
  }

  /* ---------- Collectie met filters ---------- */
  if (page === 'laminaat') {
    const qs = new URLSearchParams(location.search);
    const groups = { type: ['Plank', 'Visgraat', 'Tegeldessin'], tint: ['Licht', 'Naturel', 'Grijs', 'Donker'], dikte: [8, 10, 12] };
    const labels = { type: 'Type', tint: 'Kleur', dikte: 'Dikte' };
    $('#filters').innerHTML = Object.entries(groups).map(([k, opts]) => `
      <div class="filter-group"><h4>${labels[k]}</h4>
        ${opts.map((o) => `<label><input type="checkbox" name="${k}" value="${o}"${qs.get(k) === String(o) ? ' checked' : ''}> ${o}${k === 'dikte' ? ' mm' : ''}</label>`).join('')}
      </div>`).join('') + `
      <div class="filter-group"><h4>Eigenschappen</h4>
        <label><input type="checkbox" name="water" value="1"${qs.get('water') ? ' checked' : ''}> Waterbestendig</label></div>`;

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
    const p = byId(new URLSearchParams(location.search).get('id')) || D.laminaat[0];
    document.title = p.naam + ' laminaat | Ideaal Meubel & Vloer';
    $('#crumb-name').textContent = p.naam;
    $('#p-img').src = img(p); $('#p-img').alt = p.naam + ' laminaat';
    $('#p-lijn').textContent = 'Collectie ' + p.lijn;
    $('#p-naam').textContent = p.naam;
    $('#p-prijs').innerHTML = `${eur(p.prijs)} <small>per m² · ${eur(p.prijs * p.pak)} per pak</small>`;
    $('#p-tekst').textContent = p.tekst;
    $('#p-specs').innerHTML = [
      ['Type', p.type], ['Dikte', p.dikte + ' mm'], ['Slijtklasse', p.klasse], ['Formaat plank', p.formaat],
      ['Inhoud per pak', m2(p.pak)], ['Waterbestendig', p.water ? 'Ja' : 'Nee'], ['Vloerverwarming', 'Geschikt']
    ].map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('');

    const calc = () => {
      const l = parseFloat($('#lengte').value.replace(',', '.')) || 0;
      const b = parseFloat($('#breedte').value.replace(',', '.')) || 0;
      const opp = l * b;
      const pakken = opp > 0 ? Math.ceil((opp * (1 + D.snijverlies)) / p.pak) : 0;
      $('#r-opp').textContent = m2(opp);
      $('#r-pakken').textContent = pakken + (pakken === 1 ? ' pak' : ' pakken');
      $('#r-prijs').textContent = eur(pakken * p.pak * p.prijs);
      $('#add').disabled = pakken === 0;
      return pakken;
    };
    $$('#lengte, #breedte').forEach((i) => i.addEventListener('input', calc));
    $('#add').addEventListener('click', () => {
      const n = calc(); if (!n) return;
      cart.add(p.id, n);
      $('#added').classList.add('show');
    });
    calc();
    $('#related').innerHTML = D.laminaat.filter((x) => x.id !== p.id && (x.type === p.type || x.tint === p.tint)).slice(0, 3).map(card).join('');
  }

  /* ---------- Bestellen (aanvraag, geen betaling) ---------- */
  if (page === 'bestellen') {
    $('#ondervloer').innerHTML = D.ondervloer.map((o) =>
      `<option value="${o.id}">${o.naam}${o.prijs ? ' — ' + eur(o.prijs) + ' per m²' : ''}</option>`).join('');

    const totals = () => {
      const items = cart.get().filter((i) => byId(i.id));
      const opp = items.reduce((s, i) => s + i.pakken * byId(i.id).pak, 0);
      const vloer = items.reduce((s, i) => s + i.pakken * byId(i.id).pak * byId(i.id).prijs, 0);
      const ov = D.ondervloer.find((o) => o.id === $('#ondervloer').value) || D.ondervloer[0];
      const ondervloer = opp * ov.prijs;
      const plintM = parseFloat(($('#plinten').value || '0').replace(',', '.')) || 0;
      const plinten = plintM * D.plintPrijs;
      return { items, opp, vloer, ov, ondervloer, plintM, plinten, totaal: vloer + ondervloer + plinten };
    };

    const render = () => {
      const t = totals();
      if (!t.items.length) {
        $('#order-wrap').innerHTML = `<div class="done"><span class="kicker">Uw bestelling</span><h2>Nog geen vloer gekozen</h2>
          <p class="lead">Kies een laminaat uit de collectie, vul de afmetingen van uw ruimte in en wij rekenen het aantal pakken voor u uit.</p>
          <a class="btn btn-dark" href="laminaat.html">Bekijk de collectie <i class="arrow"></i></a></div>`;
        return;
      }
      $('#lines').innerHTML = t.items.map((i) => {
        const p = byId(i.id);
        return `<div class="cart-line" data-id="${p.id}">
          <img src="${img(p)}" alt="">
          <div><h3>${p.naam}</h3><div class="meta">${p.dikte} mm · ${m2(p.pak)} per pak · ${m2(i.pakken * p.pak)} totaal</div>
            <div class="qty"><button type="button" data-d="-1" aria-label="Minder">−</button><input type="number" min="1" value="${i.pakken}" aria-label="Aantal pakken"><button type="button" data-d="1" aria-label="Meer">+</button></div>
            <button type="button" class="remove">Verwijderen</button></div>
          <div class="line-total">${eur(i.pakken * p.pak * p.prijs)}</div></div>`;
      }).join('');
      $('#sum').innerHTML = `
        <div class="sum-row"><span>Laminaat (${m2(t.opp)})</span><span>${eur(t.vloer)}</span></div>
        <div class="sum-row"><span>${t.ov.naam}</span><span>${eur(t.ondervloer)}</span></div>
        <div class="sum-row"><span>Plinten (${t.plintM} m)</span><span>${eur(t.plinten)}</span></div>
        <div class="sum-row"><span>Leggen</span><span>${$('input[name=leggen]:checked').value === 'ja' ? 'Op offerte' : 'Zelf leggen'}</span></div>
        <div class="sum-row total"><span>Totaal indicatie</span><span>${eur(t.totaal)}</span></div>`;
    };

    $('#order-wrap').addEventListener('click', (e) => {
      const line = e.target.closest('.cart-line'); if (!line) return;
      const items = cart.get(); const it = items.find((i) => i.id === line.dataset.id);
      if (e.target.matches('[data-d]')) it.pakken = Math.max(1, it.pakken + Number(e.target.dataset.d));
      if (e.target.matches('.remove')) items.splice(items.indexOf(it), 1);
      cart.set(items); render();
    });
    $('#order-wrap').addEventListener('change', (e) => {
      if (e.target.matches('.qty input')) {
        const items = cart.get(); const it = items.find((i) => i.id === e.target.closest('.cart-line').dataset.id);
        it.pakken = Math.max(1, parseInt(e.target.value, 10) || 1); cart.set(items);
      }
      render();
    });
    $('#plinten').addEventListener('input', render);

    $('#order-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target); const t = totals();
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
        const r = await fetch('bestelling.php', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ naam: f.get('naam'), email: f.get('email'), tekst }) });
        ok = r.ok && (await r.json()).ok;
      } catch (err) { ok = false; }
      if (!ok) location.href = `mailto:${D.email}?subject=${encodeURIComponent('Bestelaanvraag laminaat - ' + f.get('naam'))}&body=${encodeURIComponent(tekst)}`;
      cart.set([]);
      $('#order-wrap').innerHTML = `<div class="done"><span class="kicker">Aanvraag ontvangen</span><h2>Bedankt, ${String(f.get('naam')).split(' ')[0].replace(/[<>&"]/g, '')}</h2>
        <p class="lead">${ok ? 'Wij hebben uw bestelaanvraag ontvangen.' : 'Uw e-mailprogramma opent met de bestelling. Verstuur die mail om de aanvraag af te ronden.'}
        Binnen één werkdag nemen wij contact met u op om de bestelling, levering en betaling te bevestigen.</p>
        <a class="btn btn-dark" href="index.html">Terug naar home <i class="arrow"></i></a></div>`;
      window.scrollTo(0, 0);
    });
    render();
  }
})();
