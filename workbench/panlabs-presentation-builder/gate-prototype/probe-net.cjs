const { launch } = require('./cdp.cjs');
(async () => {
  for (const v of process.argv.slice(2)) {
    const b = await launch();
    const off = [];
    await b.send('Network.enable');
    b.send('Runtime.enable');
    // subscribe permanently: the once() helper is one-shot, so use a raw hook
    const ws = b; // requests are surfaced through a persistent listener below
    await b.send('Network.setCacheDisabled', { cacheDisabled: true });
    b.onRequest = (u) => { if (!/^(file|data|blob|about):/.test(u)) off.push(u); };
    await b.gotoWatched('file://' + process.cwd() + '/decks/' + v + '.html', b.onRequest);
    console.log(v.padEnd(20), off.length ? 'OFF-MACHINE REQUESTS: ' + [...new Set(off)].map(u=>u.slice(0,72)).join(' | ') : '(no request left the machine)');
    await b.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
