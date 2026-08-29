#!/usr/bin/env node
// The bleed family, measured on PIXELS. The box is not the ink: a container with
// trailing padding, or an <svg> whose viewBox letterboxes, sticks past the edge
// drawing nothing. Release the stage clip, render the band beyond each edge, and
// count what is actually painted there.
const path = require('path');
const { launch, findChrome } = require('./cdp.cjs');
const BAND = 300;
(async () => {
  const file = process.argv[2];
  if (!findChrome()) { console.log('SKIP: no chromium -- the bleed family is not measured'); process.exit(0); }
  const b = await launch({ width: 1600, height: 900 + BAND * 2 });
  await b.goto('file://' + path.resolve(file));
  const ids = await b.evaluate(`()=>[...document.querySelectorAll('.slide')].map(e=>e.id)`);
  let fail = 0;
  for (const id of ids) {
    await b.evaluate(`()=>{location.hash='${id}'; return 1}`);
    await new Promise(r => setTimeout(r, 200));
    await b.evaluate(`()=>{document.querySelectorAll('.slide').forEach(s=>s.style.overflow='visible'); return 1}`);
    const geo = await b.evaluate(`()=>{const s=[...document.querySelectorAll('.slide')].find(e=>getComputedStyle(e).display!=='none');
      const R=s.getBoundingClientRect(); return {x:R.x,y:R.y,w:R.width,h:R.height,
        page:getComputedStyle(document.body).backgroundColor};}`);
    for (const [edge, clip] of [['bottom', { x: geo.x, y: geo.y + geo.h + 1, width: geo.w, height: BAND, scale: 1 }],
                                ['right',  { x: geo.x + geo.w + 1, y: geo.y, width: BAND, height: geo.h, scale: 1 }]]) {
      const shot = await b.send('Page.captureScreenshot', { format: 'png', clip });
      const pct = await b.evaluate(`async()=>{const i=new Image();i.src='data:image/png;base64,${shot.data}';await i.decode();
        const c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;
        const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(i,0,0);
        const d=x.getImageData(0,0,c.width,c.height).data; let n=0;
        for(let k=0;k<d.length;k+=4) if(d[k]>24||d[k+1]>24||d[k+2]>24) n++;
        return +(100*n/(c.width*c.height)).toFixed(3);}`);
      if (pct > 0.2) {
        console.log(`slide #${id}: ${pct}% of the band past the ${edge} edge is painted -- content is being cut off by the screen, `
          + `not fitted to it. Shrink the block or move it to the next slide.`);
        fail = 1;
      }
    }
    await b.evaluate(`()=>{document.querySelectorAll('.slide').forEach(s=>s.style.overflow='hidden'); return 1}`);
  }
  await b.close();
  process.exit(fail);
})().catch(e => { console.error(e.message); process.exit(2); });
