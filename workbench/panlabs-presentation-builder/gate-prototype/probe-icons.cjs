const { launch } = require('./cdp.cjs');
const path = require('path');
(async () => {
  const b = await launch({ width: 1600, height: 900 });
  await b.goto('file://' + path.resolve(process.argv[2]));
  await b.evaluate(`()=>{location.hash='s2'; return 1}`);
  await new Promise(r => setTimeout(r, 200));
  const r = await b.evaluate(`()=>{
    const out = [];
    for (const svg of document.querySelectorAll('${process.env.SLOT} svg')) {
      const p = svg.querySelector('path,circle,rect,line,polyline');
      if (!p) continue;
      const cs = getComputedStyle(p);
      const solidFill = cs.fill !== 'none' && !/rgba\\(0, 0, 0, 0\\)/.test(cs.fill);
      const noStroke = cs.stroke === 'none' || /rgba\\(0, 0, 0, 0\\)/.test(cs.stroke);
      out.push({ fill: cs.fill, stroke: cs.stroke, solidFill, noStroke });
    }
    return out;
  }`);
  const bad = r.filter(x => x.solidFill && x.noStroke);
  console.log('  icons found: ' + r.length + ' | contract fill:none + stroke:<colour> violated by: ' + bad.length
    + (bad.length ? '  e.g. fill=' + bad[0].fill + ' stroke=' + bad[0].stroke : ''));
  // ink coverage of the icon box, from the pixels
  const clip = await b.evaluate(`()=>{const e=document.querySelector('.chip');const r=e.getBoundingClientRect();
    return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1};}`);
  const shot = await b.send('Page.captureScreenshot', { format: 'png', clip });
  const ink = await b.evaluate(`async () => {
    const img = new Image(); img.src = "data:image/png;base64,${shot.data}"; await img.decode();
    const c = document.createElement('canvas'); c.width=img.naturalWidth; c.height=img.naturalHeight;
    const x = c.getContext('2d',{willReadFrequently:true}); x.drawImage(img,0,0);
    const d = x.getImageData(0,0,c.width,c.height).data;
    let white = 0, n = c.width*c.height;
    for (let i=0;i<d.length;i+=4) if (d[i]>200 && d[i+1]>200 && d[i+2]>200) white++;
    return +(100*white/n).toFixed(1);
  }`);
  console.log('  ink coverage of the chip box: ' + ink + '%');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
