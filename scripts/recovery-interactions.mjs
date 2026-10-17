// Phase 6 interaction check against a running dev server (npm run dev). Drives the real controls:
// regulator switch, ring buttons, sound toggle, and the three drags with the mouse (including a
// failed attempt at each, which must put the piece back). The dev store only skips waiting.
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
// The drag hints are placed over the 3D each frame; wait for one to show, then read where it is.
const hintAt = async cls => {
  await page.waitForFunction(c => document.querySelector(c)?.style.opacity === '1', { timeout: 20000 }, cls);
  return page.$eval(cls, e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top }; });
};
const dragMouse = async (from, to) => {
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  for (let i = 1; i <= 20; i++) { await page.mouse.move(from.x + (to.x - from.x) * i / 20, from.y + (to.y - from.y) * i / 20); await pause(25); }
  await page.mouse.up(); await pause(300);
};
const p6 = () => page.evaluate(() => { const s = window.__lastGateP6.store.getState(); return { stage: s.stage, chip: s.chip, cart: s.cart, care: s.care }; });
const press = async label => {
  await page.waitForFunction(t => [...document.querySelectorAll('button')].some(x => !x.disabled && (x.getAttribute('aria-label') === t || x.textContent.includes(t))), { timeout: 15000 }, label);
  await page.evaluate(t => [...document.querySelectorAll('button')].find(x => !x.disabled && (x.getAttribute('aria-label') === t || x.textContent.includes(t))).click(), label);
};
try {
  await page.goto(`${BASE}/?phase6=wake`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.__lastGateP6 && document.querySelector('.p6') && !document.querySelector('.p6-loading'), { timeout: 60000 }); await age(7);
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
  // The chip: a short tug that doesn't clear the dock puts it back; a proper pull takes it out.
  let at = await hintAt('.p6-hint-grab');
  await dragMouse(at, { x: at.x + 30, y: at.y - 40 }); await pause(600);
  if ((await p6()).chip !== 'bay') throw new Error(`short chip tug should return it: ${JSON.stringify(await p6())}`);
  at = await hintAt('.p6-hint-grab');
  await dragMouse(at, { x: at.x + 60, y: at.y - 220 });
  if ((await p6()).chip !== 'out') throw new Error(`chip pull failed: ${JSON.stringify(await p6())}`);
  checks.push('Chip: short tug returns it, full pull takes it out (mouse)');
  await pause(4500);
  if (!/Play the capture/.test(await panel())) throw new Error('carry: capture step not shown');
  // The cartridge: dropped short of the reader it goes back to Hiro's hand; on the reader it seats.
  at = await hintAt('.p6-hint-grab');
  await dragMouse(at, { x: at.x - 300, y: at.y - 200 }); await pause(800);
  if ((await p6()).cart !== 'hand') throw new Error(`missed cartridge should return: ${JSON.stringify(await p6())}`);
  at = await hintAt('.p6-hint-grab');
  await page.mouse.move(at.x, at.y); await page.mouse.down(); await page.mouse.move(at.x + 20, at.y - 20); await pause(300);
  const reader = await hintAt('.p6-hint-drop');
  for (let i = 1; i <= 20; i++) { await page.mouse.move(at.x + (reader.x - at.x) * i / 20, at.y + (reader.y - at.y) * i / 20); await pause(25); }
  await page.mouse.up(); await pause(400);
  if ((await p6()).stage !== 'bloom') throw new Error(`cartridge did not seat: ${JSON.stringify(await p6())}`);
  checks.push('Cartridge: miss returns it, reader seats it and the gate opens (mouse)');
  await waitStage('home', 30000); checks.push('Hauled through the gate to home');
  // The healthcare chip: same rule, into his chest.
  at = await hintAt('.p6-hint-grab');
  await dragMouse(at, { x: at.x + 250, y: at.y + 120 }); await pause(800);
  if ((await p6()).care !== 'ground') throw new Error(`missed healthcare chip should return: ${JSON.stringify(await p6())}`);
  at = await hintAt('.p6-hint-grab');
  await page.mouse.move(at.x, at.y); await page.mouse.down(); await page.mouse.move(at.x + 10, at.y - 20); await pause(300);
  const chest = await hintAt('.p6-hint-drop');
  for (let i = 1; i <= 20; i++) { await page.mouse.move(at.x + (chest.x - at.x) * i / 20, at.y + (chest.y - at.y) * i / 20); await pause(25); }
  await page.mouse.up(); await pause(400);
  await waitStage('seated', 5000); checks.push('Healthcare chip: miss returns it, chest seats it (mouse)');
  await pause(800); await press('Close the bay'); await waitStage('boot');
  await waitStage('end', 25000); await pause(5500);
  checks.push({ end: await page.evaluate(() => document.querySelector('.lg-ending')?.innerText) });
  await Promise.all([page.waitForNavigation({ timeout: 30000 }), press('Return to the opening')]);
  checks.push({ afterReturn: await page.evaluate(() => location.search) });
} catch (e) { checks.push({ failure: String(e), stage: await stage().catch(() => null) }); }
finally {
  fs.mkdirSync('artifacts/claude-recovery', { recursive: true });
  fs.writeFileSync('artifacts/claude-recovery/interaction-results.json', JSON.stringify({ checks, errors }, null, 2));
  console.log(JSON.stringify({ checks, errors }, null, 2)); await browser.close();
}
