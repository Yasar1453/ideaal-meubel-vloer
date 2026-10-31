// Bevestigen voor verwijderen.
document.querySelectorAll('form[data-bevestig]').forEach((f) => {
  f.addEventListener('submit', (e) => { if (!confirm(f.dataset.bevestig)) e.preventDefault(); });
});

// Foto: voorbeeld tonen en grote telefoonfoto's eerst verkleinen, zodat het uploaden altijd lukt.
const foto = document.getElementById('foto');
if (foto) {
  foto.addEventListener('change', async () => {
    const bestand = foto.files[0];
    if (!bestand) return;
    const vb = document.getElementById('foto-voorbeeld');
    vb.src = URL.createObjectURL(bestand); vb.hidden = false;
    if (vb.nextElementSibling) vb.nextElementSibling.hidden = true;
    if (bestand.size < 1.5e6 || !window.createImageBitmap || !window.DataTransfer) return;
    try {
      const bm = await createImageBitmap(bestand);
      const schaal = Math.min(1, 1600 / Math.min(bm.width, bm.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bm.width * schaal); c.height = Math.round(bm.height * schaal);
      c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.88));
      if (!blob) return;
      const dt = new DataTransfer();
      dt.items.add(new File([blob], 'foto.jpg', { type: 'image/jpeg' }));
      foto.files = dt.files;
    } catch (e) { /* origineel bestand blijft gekozen */ }
  });
}
