const { launch } = require('./cdp.cjs');
const { HIST_FN, classify } = require('./histogram.cjs');
const PALETTE = ['#141415','#F3F3F3','#2C2C2F','#FFFFFF',
                 '#CD1335','#C75000','#7634D2','#4EA9D0','#5FAB80','#FF6201'];
(async () => {
  for (const v of process.argv.slice(2)) {
    const b = await launch();
    await b.goto('file://' + process.cwd() + '/decks/' + v + '.html');
    const clip = await b.evaluate(`()=>{const r=document.querySelector('.stage').getBoundingClientRect();
      return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1};}`);
    const state = `()=>{const s=document.querySelector('.slide.is-active');
      return s.dataset.slide+'.'+s.querySelectorAll('[data-step].is-shown').length;}`;
    let seen = new Set(), guard = 0;
    while (guard++ < 30) {
      const st = await b.evaluate(state);
      if (!seen.has(st)) {
        seen.add(st);
        const shot = await b.send('Page.captureScreenshot', { format: 'png', clip });
        const h = await b.evaluate(HIST_FN(shot.data));
        const c = classify(h.hist, h.total, PALETTE);
        console.log(`${v.padEnd(18)} ${st.padEnd(5)} dom=${c.dominant}(${String(c.dominantPct).padStart(5)}%) ` +
          `token=${String(c.onTokenPct).padStart(6)}% ramp=${String(c.onRampPct).padStart(5)}% ` +
          `OFF=${String(c.offPct).padStart(6)}% distinct=${String(c.distinct).padStart(4)} ` +
          `worst=${c.worstOffender ? c.worstOffender.hex+'@'+c.worstOffender.pct+'%' : '-'}`);
      }
      await b.key('ArrowRight');
      if (await b.evaluate(state) === st) break;
    }
    await b.close(); console.log('');
  }
})().catch(e => { console.error(e); process.exit(1); });
