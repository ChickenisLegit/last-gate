// Phase 6 interaction check against a running dev server (npm run dev). Drives the real controls
// where there is one (regulator switch, ring buttons, sound toggle) and the dev store for drags.
//   PUPPETEER=<path to puppeteer-core's esm entry, or package name> CHROME=<chrome.exe> BASE=http://127.0.0.1:4173 node scripts/recovery-interactions.mjs
// Don't edit source files while it runs: a hot reload resets Phase 6 to its entry stage.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const spec = process.env.PUPPETEER ?? 'puppeteer-core';
const { default: puppeteer } = await import(fs.existsSync(spec) ? pathToFileURL(spec).href : spec);
const BASE = process.env.BASE ?? 'http://127.0.0.1:4173';
const browser = await puppeteer.launch({ executablePath: process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const page = await browser.newPage(); await page.setViewport({ width: 1440, height: 810 });
const errors = [], checks = [];
page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const pause = ms => new Promise(r => setTimeout(r, ms));
const stage = () => page.evaluate(() => window.__lastGateP6.store.getState().stage);
const age = s => page.evaluate(s => window.__lastGateP6.store.setState({ since: performance.now() / 1000 - s }), s);
const jump = s => page.evaluate(s => window.__lastGateP6.go(s), s);
const waitStage = (s, timeout = 15000) => page.waitForFunction(s => window.__lastGateP6.store.getState().stage === s, { timeout }, s);
const panel = () => page.evaluate(() => document.querySelector('.p6-side')?.innerText ?? '');
const press = async label => {
  await page.waitForFunction(t => [...document.querySelectorAll('button')].some(x => !x.disabled && (x.getAttribute('aria-label') === t || x.textContent.includes(t))), { timeout: 15000 }, label);
  await page.evaluate(t => [...document.querySelectorAll('button')].find(x => !x.disabled && (x.getAttribute('aria-label') === t || x.textContent.includes(t))).click(), label);
};
try {
  await page.goto(`${BASE}/?phase6=wake`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.__lastGateP6 && document.querySelector('.p6-brand'), { timeout: 60000 }); await age(7);
  await press('Activate regulator'); await waitStage('limited'); checks.push('Wake: regulator switch animates and enters limited');

  const before = await page.evaluate(() => localStorage.getItem('lastgate.sfx.muted'));
  await press('Mute sound'); await pause(200);
  checks.push({ mute: await page.evaluate(() => document.querySelector('.lg-sound')?.textContent), stored: await page.evaluate(() => localStorage.getItem('lastgate.sfx.muted')), before });
  await press('Unmute sound');

  await jump('gate'); await pause(1000);
  for (const [label, n, dir] of [['OUTER', 29, 'Turn clockwise'], ['MIDDLE', 20, 'Turn clockwise'], ['INNER', 12, 'Turn anticlockwise']]) {
    await press(label); for (let i = 0; i < n; i++) { await page.click(`[aria-label="${dir}"]`); await pause(25); }
  }
  await waitStage('powered', 8000); checks.push('Gate: ring solved through UI controls');
  await pause(3000); const locked = await panel();
  if (!/Missing input\s*Unknown/i.test(locked)) throw new Error(`powered panel: ${locked}`);
  checks.push('Gate tries and stays locked: missing input unknown');

  await waitStage('choice', 10000); await age(2); await press('Switch off regulator'); await waitStage('flyin');
  const outOfRange = await page.evaluate(() => document.querySelector('[aria-label="Activate regulator"]')?.disabled);
  checks.push({ flyinRegulatorDisabled: outOfRange });
  await waitStage('faceoff', 12000); await age(2); await press('Activate regulator'); await waitStage('drop'); checks.push('Mid-air regulator press starts the drop');

  await waitStage('carry', 15000); await age(3); await pause(400);
  checks.push({ carryClue: await panel() });
  await age(6.5); await pause(400);
  if (!/Locked · his chip/.test(await panel())) throw new Error('carry: chip lock not shown');
  await page.evaluate(() => window.__lastGateP6.store.setState({ chip: 'out', pulledAt: performance.now() / 1000 })); await pause(4500);
  if (!/Play the capture/.test(await panel())) throw new Error('carry: capture step not shown');
  checks.push('Chip pulled: reader clear, capture step shown');
  await page.evaluate(() => { window.__lastGateP6.store.setState({ cart: 'slot' }); window.__lastGateP6.go('bloom'); });
  await waitStage('home', 25000); checks.push('Bloom crosses to home');
  await jump('seated'); await pause(800); await press('Close the bay'); await waitStage('boot');
  await waitStage('end', 25000); await pause(5500);
  checks.push({ end: await page.evaluate(() => document.querySelector('.lg-ending')?.innerText) });
} catch (e) { checks.push({ failure: String(e), stage: await stage().catch(() => null) }); }
finally {
  fs.mkdirSync('artifacts/claude-recovery', { recursive: true });
  fs.writeFileSync('artifacts/claude-recovery/interaction-results.json', JSON.stringify({ checks, errors }, null, 2));
  console.log(JSON.stringify({ checks, errors }, null, 2)); await browser.close();
}
