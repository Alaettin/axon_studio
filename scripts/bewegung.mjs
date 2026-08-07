import { chromium } from '@playwright/test';

async function messe(reducedMotion, reducedTransparency) {
  const b = await chromium.launch();
  const ctx = await b.newContext({
    reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
    viewport: { width: 1280, height: 800 },
  });
  const p = await ctx.newPage();
  if (reducedTransparency) {
    await p.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
    await ctx.addInitScript(() => {
      const echt = window.matchMedia.bind(window);
      window.matchMedia = q => q.includes('prefers-reduced-transparency')
        ? { matches: true, media: q, addEventListener(){}, removeEventListener(){}, addListener(){}, removeListener(){}, onchange:null, dispatchEvent(){return false;} }
        : echt(q);
    });
  }
  // rAF zaehlen
  await p.addInitScript(() => {
    window.__raf = 0;
    const o = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = cb => { window.__raf++; return o(cb); };
  });
  await p.goto('http://localhost:5274/anmeldung');
  await p.waitForTimeout(1200);
  const a = await p.evaluate(() => window.__raf);
  await p.waitForTimeout(3000);
  const c = await p.evaluate(() => window.__raf);
  // Zeichnet der Canvas ueberhaupt etwas?
  const gemalt = await p.evaluate(() => {
    const cv = document.querySelector('canvas');
    if (!cv) return 'kein canvas';
    const d = cv.getContext('2d').getImageData(cv.width/2, cv.height/2, 1, 1).data;
    return `Mittelpunkt rgba(${d[0]},${d[1]},${d[2]},${d[3]})`;
  });
  await b.close();
  return { zuwachs: c - a, gemalt };
}

console.log('normal            :', JSON.stringify(await messe(false, false)));
console.log('reduced-motion    :', JSON.stringify(await messe(true, false)));
