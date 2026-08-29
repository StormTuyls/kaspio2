// =============================================================================
// Kaspio , contrast meten op een echte, gerenderde pagina
// =============================================================================
// scripts/design/contrast.py controleert het palet. Dit controleert wat er
// werkelijk op het scherm staat, inclusief overerving, half-doorzichtige
// vlakken en klassen die op een donkere achtergrond terechtkwamen terwijl ze
// voor wit bedoeld waren. Dat laatste is precies wat een tokenmigratie stuk
// maakt en wat je met het oog niet betrapt.
//
// Gebruik: plak dit in de console van de pagina die je wil controleren.
//
// Twee dingen die deze versie goed doet en een naïeve versie niet:
//   1. kleuren worden door de browser omgerekend via een canvas. Zelf
//      oklch(0.165 0.014 250) parsen levert drie getallen op die als RGB
//      gelezen worden, en dan meet je onzin.
//   2. half-doorzichtige lagen (bg-white/10) worden gestapeld in plaats van
//      overgeslagen, want die maken de achtergrond echt lichter.
// =============================================================================
(() => {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  const naarRgb = (kleur, onder) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = onder || "#ffffff";
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = kleur;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  };
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = (r) => 0.2126 * lin(r[0]) + 0.7152 * lin(r[1]) + 0.0722 * lin(r[2]);
  const ratio = (a, b) => {
    const la = lum(a), lb = lum(b);
    const hi = Math.max(la, lb), lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  };
  const achtergrond = (el) => {
    const lagen = [];
    let n = el;
    while (n && n !== document.documentElement) {
      const bg = getComputedStyle(n).backgroundColor;
      const m = bg.match(/[\d.]+/g);
      const alpha = bg === "transparent" ? 0 : m && m.length > 3 ? Number(m[3]) : 1;
      if (alpha > 0) lagen.unshift(bg);
      if (alpha >= 0.99) break;
      n = n.parentElement;
    }
    let kleur = "#ffffff";
    for (const laag of lagen) {
      const r = naarRgb(laag, kleur);
      kleur = `rgb(${r[0]},${r[1]},${r[2]})`;
    }
    return naarRgb(kleur);
  };

  const zakkers = [];
  let bekeken = 0;
  for (const el of document.querySelectorAll("p,span,h1,h2,h3,h4,h5,li,a,button,td,th,label,dt,dd")) {
    if (el.children.length || !el.textContent.trim()) continue;
    const st = getComputedStyle(el);
    if (st.visibility === "hidden" || st.display === "none") continue;
    // Verborgen door een animerende voorouder (scroll-reveal): niet meten.
    let p = el, verborgen = false;
    while (p && p !== document.body) {
      if (Number(getComputedStyle(p).opacity) < 0.5) { verborgen = true; break; }
      p = p.parentElement;
    }
    if (verborgen) continue;

    bekeken++;
    const px = parseFloat(st.fontSize);
    const groot = px >= 24 || (px >= 18.66 && Number(st.fontWeight) >= 700);
    const eis = groot ? 3 : 4.5;
    const bg = achtergrond(el);
    const r = ratio(naarRgb(st.color, `rgb(${bg[0]},${bg[1]},${bg[2]})`), bg);
    if (r < eis) {
      zakkers.push({
        tekst: el.textContent.trim().slice(0, 40),
        ratio: +r.toFixed(2),
        eis,
        klassen: [...el.classList].filter((c) => /^(text|bg)-/.test(c)).join(" "),
        el,
      });
    }
  }

  console.log(`${bekeken} elementen gemeten, ${zakkers.length} zakken`);
  if (zakkers.length) console.table(zakkers.map(({ el, ...r }) => r));
  return zakkers;
})();
