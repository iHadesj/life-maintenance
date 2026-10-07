// End-to-end smoke test on the production build.
//   npm run build && npm run smoke [-- --browser=webkit] [-- --keep]
// Emulates an iPhone 11, walks the real flows, checks offline + reduced
// motion, fails on any console error, and writes screenshots to .smoke/.
import { createServer } from 'node:http';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium, webkit } from 'playwright';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]));
const BROWSER = args.browser === 'webkit' ? webkit : chromium;
const PORT = 4317;
const BASE = `http://127.0.0.1:${PORT}/`;
const OUT = resolve('.smoke');
const IPHONE_11 = { viewport: { width: 414, height: 896 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

const errors = [];
const log = (...m) => console.log('·', ...m);

// ── seed data: a realistic, aging system ───────────────────────────────────
function seedBackup() {
  const now = Date.now();
  const DAY = 86_400_000;
  const at = (daysAgo) => new Date(now - daysAgo * DAY).toISOString();
  const cats = [
    ['digital', 'Digital', 'digital', 'violet'],
    ['house', 'House', 'house', 'sky'],
    ['car', 'Car', 'car', 'peach'],
    ['documents', 'Documents', 'documents', 'sand'],
    ['finance', 'Finance', 'finance', 'mint'],
    ['personal', 'Personal', 'personal', 'rose'],
    ['equipment', 'Equipment', 'equipment', 'lilac'],
    ['other', 'Other', 'other', 'ash'],
  ].map(([id, name, symbol, color], order) => ({ id, name, symbol, color, order, builtIn: true, createdAt: at(500), updatedAt: at(500) }));

  const rows = [
    ['Full backup', 'digital', 27, 30, 'high', 30, 'External SSD + cloud mirror'],
    ['Password review', 'digital', 150, 180, 'high', 30],
    ['Storage cleanup', 'digital', 40, 60, 'low', 20],
    ['Laptop internal cleaning', 'equipment', 190, 180, 'medium', 45, 'Fans and thermal paste'],
    ['Air filter replacement', 'house', 70, 90, 'medium', 15, 'MERV 11, 20x25x1'],
    ['Smoke detector test', 'house', 20, 180, 'critical', 5],
    ['Gutter cleaning', 'house', 420, 365, 'medium', 90],
    ['Tire pressure', 'car', 34, 30, 'high', 10],
    ['Oil change', 'car', 100, 180, 'high', 60],
    ['Passport validity', 'documents', 200, 365, 'high', 10],
    ['Subscription audit', 'finance', 95, 90, 'medium', 30],
    ['Insurance review', 'finance', 120, 365, 'medium', 45],
    ['Dentist checkup', 'personal', 150, 180, 'high', 60],
    ['Running shoes check', 'personal', 50, 120, 'low', 5],
    ['Coffee machine descale', 'equipment', 75, 60, 'low', 20],
    ['Warranty folder review', 'documents', 10, 365, 'low', 20],
  ];
  const items = rows.map(([title, categoryId, daysAgo, interval, criticality, duration, notes], i) => ({
    id: `seed-${i}`,
    title,
    categoryId,
    lastMaintenanceAt: at(daysAgo),
    recommendedIntervalDays: interval,
    criticality,
    estimatedDurationMinutes: duration,
    ...(notes ? { notes } : {}),
    createdAt: at(700),
    updatedAt: at(daysAgo),
  }));

  const logs = [];
  rows.forEach(([title, categoryId, daysAgo, interval], i) => {
    let cursor = daysAgo;
    const services = 2 + (i % 3);
    for (let k = 0; k < services && cursor < 680; k++) {
      const drift = ((i * 7 + k * 5) % 9) - 3;
      const length = Math.max(1, interval + drift);
      logs.push({
        id: `${(0x1a2b3c4d + i * 977 + k * 131).toString(16)}-log-${i}-${k}`,
        maintenanceItemId: `seed-${i}`,
        completedAt: at(cursor),
        previousCycleDuration: length,
        itemTitle: title,
        categoryId,
        intervalDays: interval,
        ...(k === 0 && i % 4 === 0 ? { note: ['swapped the drive', 'took longer than usual', 'all good', 'replaced part'][i % 4] } : {}),
      });
      cursor += length;
    }
  });

  return {
    format: 'life-maintenance/backup',
    version: 1,
    app: 'Life Maintenance smoke',
    exportedAt: new Date().toISOString(),
    counts: { categories: cats.length, maintenanceItems: items.length, maintenanceLogs: logs.length },
    data: { categories: cats, maintenanceItems: items, maintenanceLogs: logs, settings: {} },
  };
}

// ── harness ──────────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

/**
 * Serves dist/ like a plain static host. (Not `vite preview`: dev tooling such
 * as editor extensions can hook the Vite server and inject scripts.)
 */
function serveDist() {
  const root = resolve('dist');
  const server = createServer(async (req, res) => {
    try {
      const { pathname } = new URL(req.url ?? '/', 'http://localhost');
      let file = normalize(join(root, decodeURIComponent(pathname)));
      if (!file.startsWith(root)) {
        res.writeHead(403).end();
        return;
      }
      const info = await stat(file).catch(() => null);
      if (!info || info.isDirectory()) file = join(root, 'index.html');
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
      res.end(body);
    } catch {
      res.writeHead(500).end();
    }
  });
  return new Promise((ready) => server.listen(PORT, '127.0.0.1', () => ready(server)));
}

function watch(page, label) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`[${label}] console: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`[${label}] pageerror: ${err.message}`));
}

const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  const seedPath = `${OUT}/seed-backup.json`;
  await writeFile(seedPath, JSON.stringify(seedBackup(), null, 2));

  const server = await serveDist();
  const browser = await BROWSER.launch();
  try {
    // ── 1. first run on an iPhone 11 ─────────────────────────────────────────
    const context = await browser.newContext({ ...IPHONE_11, serviceWorkers: 'allow' });
    const page = await context.newPage();
    watch(page, 'iphone');
    await page.goto(BASE);
    await pause(700);
    await shot(page, '00-boot');
    await pause(2200);
    await shot(page, '01-first-run');

    // ── 2. register the first system through the editor ─────────────────────
    await page.getByRole('button', { name: /register your first system/i }).click();
    await pause(700);
    await shot(page, '02-editor-first');
    await page.getByPlaceholder('e.g. Full backup').fill('Backup completo');
    await page.getByRole('radio', { name: '1m ago' }).click();
    await page.getByRole('radio', { name: 'high' }).click();
    await pause(500);
    await shot(page, '03-editor-filled');
    await page.getByRole('button', { name: /register system/i }).click();
    await pause(1600);
    await shot(page, '04-home-one-system');

    // ── 3. import a realistic backup through settings ───────────────────────
    await page.goto(`${BASE}#/settings`);
    await pause(1200);
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'import json' }).click();
    await (await chooser).setFiles(seedPath);
    await pause(900);
    await shot(page, '05-import-sheet');
    await page.getByRole('button', { name: 'merge backup' }).click();
    await pause(1200);
    await shot(page, '06-settings');

    // ── 4. the system, populated ─────────────────────────────────────────────
    await page.getByRole('link', { name: 'System health' }).click();
    await pause(2200);
    await shot(page, '07-home');
    await page.evaluate(() => document.querySelector('[role="region"]')?.scrollTo(0, 720));
    await pause(900);
    await shot(page, '08-home-scrolled');
    await page.evaluate(() => document.querySelector('[role="region"]')?.scrollTo(0, 1500));
    await pause(900);
    await shot(page, '09-home-subsystems');
    await page.evaluate(() => document.querySelector('[role="region"]')?.scrollTo(0, 0));
    await pause(400);

    // dive into an area through its orbit satellite (it drifts, so skip the stability wait)
    await page.getByRole('button', { name: /^House:/ }).first().click({ force: true });
    await pause(250);
    await shot(page, '10-dive-mid');
    await pause(1300);
    await shot(page, '11-category-house');

    // open a system's detail
    await page.getByRole('button', { name: /Gutter cleaning/ }).first().click();
    await pause(1000);
    await shot(page, '12-detail');
    await page.getByRole('button', { name: 'mark serviced' }).click();
    await pause(500);
    await shot(page, '13-service-reset');
    await pause(1500);
    await page.keyboard.press('Escape');
    await pause(700);

    // ── 5. queue, log, terminal ──────────────────────────────────────────────
    await page.getByRole('link', { name: 'Maintenance queue' }).click();
    await pause(260);
    await shot(page, '14-scan-mid');
    await pause(1100);
    await shot(page, '15-queue');
    await page.getByRole('link', { name: 'Maintenance log' }).click();
    await pause(1400);
    await shot(page, '16-log');
    await page.getByRole('button', { name: /Full backup serviced/ }).first().click();
    await pause(1100);
    await shot(page, '17-log-trace');

    await page.getByRole('button', { name: 'Open command terminal', exact: true }).click();
    await pause(500);
    await page.keyboard.type('comp tir');
    await pause(400);
    await shot(page, '18-terminal');
    await page.keyboard.press('Enter');
    await pause(1200);
    await shot(page, '19-after-terminal');

    // ── 5b. gestures and data flows ─────────────────────────────────────────
    await page.goto(`${BASE}#/queue`);
    await pause(1500);
    const firstNode = page.locator('li[data-status]').filter({ has: page.locator('button[aria-label$="Open system."]') }).first();
    const nb = await firstNode.boundingBox();
    const ny = nb.y + 40;
    await page.mouse.move(nb.x + 70, ny);
    await page.mouse.down();
    for (let i = 1; i <= 14; i++) {
      await page.mouse.move(nb.x + 70 + i * 14, ny);
      await pause(16);
    }
    await shot(page, 'g1-swipe-armed');
    await page.mouse.up();
    await pause(700);
    if (!(await page.getByText('SERVICE COMPLETE', { exact: true }).first().isVisible())) errors.push('swipe right did not log a service');
    await shot(page, 'g2-swipe-serviced');
    await pause(1600);

    const holdNode = page.locator('li[data-status]').filter({ has: page.locator('button[aria-label$="Open system."]') }).nth(1);
    const hb = await holdNode.boundingBox();
    await page.mouse.move(hb.x + 150, hb.y + 34);
    await page.mouse.down();
    await pause(750);
    const hudVisible = await page.locator('[role="status"]').filter({ hasText: 'CYCLE' }).isVisible();
    await shot(page, 'g3-hold-hud');
    await page.mouse.up();
    if (!hudVisible) errors.push('long press did not show the readout');
    await pause(500);

    await page.goto(`${BASE}#/settings`);
    await pause(1100);
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'export json' }).click();
    const download = await downloading;
    const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
    log('export:', download.suggestedFilename(), `${exported.data.maintenanceItems.length} systems`, `${exported.data.maintenanceLogs.length} logs`);
    if (exported.format !== 'life-maintenance/backup' || exported.data.maintenanceItems.length < 10) errors.push('export: unexpected file content');
    await pause(600);
    await shot(page, 'g4-settings-after-export');

    await page.goto(`${BASE}#/`);
    await pause(1600);
    const pulled = await page.evaluate(async () => {
      const region = document.querySelector('[role="region"]');
      if (!region || typeof Touch !== 'function') return false;
      try {
        new Touch({ identifier: 0, target: region, clientX: 0, clientY: 0 });
      } catch {
        return false; // engine does not allow synthetic touches (WebKit)
      }
      const fire = (type, y) => {
        const touch = new Touch({ identifier: 7, target: region, clientX: 200, clientY: y });
        region.dispatchEvent(
          new TouchEvent(type, { touches: type === 'touchend' ? [] : [touch], changedTouches: [touch], bubbles: true, cancelable: true }),
        );
      };
      fire('touchstart', 220);
      for (let y = 232; y <= 470; y += 14) {
        fire('touchmove', y);
        await new Promise((r) => setTimeout(r, 16));
      }
      fire('touchend', 470);
      return true;
    });
    if (!pulled) log('pull-to-check skipped: synthetic touches unsupported in this engine');
    await pause(350);
    await shot(page, 'g5-system-check');
    await pause(1300);
    if (pulled && !(await page.getByText('SYSTEM CHECK COMPLETE', { exact: true }).isVisible())) {
      errors.push('pull down did not run SYSTEM CHECK');
    }

    await page.goto(`${BASE}#/queue`);
    await pause(1300);
    await page.getByRole('button', { name: /^Storage cleanup/ }).first().click();
    await pause(1000);
    const remove = page.getByRole('button', { name: /remove — press and hold/ });
    const rb = await remove.boundingBox();
    await page.mouse.move(rb.x + rb.width / 2, rb.y + rb.height / 2);
    await page.mouse.down();
    await pause(1450);
    await page.mouse.up();
    await pause(1400);
    if ((await page.getByRole('button', { name: /^Storage cleanup/ }).count()) !== 0) errors.push('hold to remove did not remove the system');
    await shot(page, 'g6-removed');

    // custom area
    await page.goto(`${BASE}#/settings`);
    await pause(1100);
    await page.getByRole('button', { name: '+ new area' }).click();
    await pause(800);
    await page.getByPlaceholder('e.g. Garden').fill('Garden');
    await page.getByRole('radio', { name: 'leaf' }).click();
    await page.getByRole('radio', { name: 'mint' }).click();
    await pause(300);
    await shot(page, 'g7-new-area');
    await page.getByRole('button', { name: 'create area' }).click();
    await pause(1000);
    if (!(await page.getByRole('button', { name: /^GARDEN/ }).isVisible())) errors.push('custom area was not created');

    // edit a system: its cycle changes and persists
    await page.goto(`${BASE}#/queue`);
    await pause(1300);
    await page.getByRole('button', { name: /^Oil change/ }).first().click();
    await pause(900);
    await page.getByRole('button', { name: 'edit system' }).click();
    await pause(900);
    await page.getByRole('radio', { name: '1 year' }).click();
    await pause(600);
    await shot(page, 'g8-edit-interval');
    await page.getByRole('button', { name: 'commit changes' }).click();
    await pause(1100);
    if (!(await page.getByText('365d · 1 year').isVisible())) errors.push('editing the cycle did not persist');
    await page.keyboard.press('Escape');
    await pause(700);

    // ── 6. offline: reload with the network gone ────────────────────────────
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return Boolean(reg.active);
    });
    await page.reload();
    await pause(1500);
    const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
    log('service worker controls the page:', controlled);
    if (!controlled) errors.push('offline: no service worker controls the page');

    // A real document reload with the network gone: everything must come from the SW cache.
    // (Playwright's Windows WebKit cannot combine service workers with offline emulation.)
    if (BROWSER === chromium) {
      await context.setOffline(true);
      await page.reload();
      await pause(2600);
      const shellOk = await page.getByRole('link', { name: 'Maintenance queue' }).isVisible();
      await page.getByRole('link', { name: 'Maintenance queue' }).click();
      await pause(1400);
      const queueOk = await page.getByText('MAINTENANCE', { exact: true }).first().isVisible();
      await shot(page, '20-offline-queue');
      log('offline reload renders:', shellOk && queueOk);
      if (!shellOk || !queueOk) errors.push('offline: app did not render without network');
      await context.setOffline(false);
    } else {
      log('offline reload skipped: unsupported by this engine build');
    }
    await context.close();

    // ── 7. widths + desktop ──────────────────────────────────────────────────
    for (const width of [375, 390, 430]) {
      const ctx = await browser.newContext({ ...IPHONE_11, viewport: { width, height: 844 } });
      const p = await ctx.newPage();
      watch(p, `w${width}`);
      await p.goto(BASE);
      await pause(1200);
      const chooser2 = p.waitForEvent('filechooser');
      await p.goto(`${BASE}#/settings`);
      await pause(900);
      await p.getByRole('button', { name: 'import json' }).click();
      await (await chooser2).setFiles(seedPath);
      await pause(700);
      await p.getByRole('button', { name: 'merge backup' }).click();
      await pause(700);
      await p.goto(`${BASE}#/`);
      await pause(2400);
      await shot(p, `21-home-${width}`);
      const overflow = await p.evaluate(() => {
        const region = document.querySelector('[role="region"]');
        return region ? region.scrollWidth - region.clientWidth : 0;
      });
      if (overflow > 1) errors.push(`w${width}: horizontal overflow of ${overflow}px`);
      await ctx.close();
    }

    const tablet = await browser.newContext({ viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2, hasTouch: true });
    const tp = await tablet.newPage();
    watch(tp, 'tablet');
    await tp.goto(BASE);
    await pause(1200);
    const chooserT = tp.waitForEvent('filechooser');
    await tp.goto(`${BASE}#/settings`);
    await pause(900);
    await tp.getByRole('button', { name: 'import json' }).click();
    await (await chooserT).setFiles(seedPath);
    await pause(700);
    await tp.getByRole('button', { name: 'merge backup' }).click();
    await pause(700);
    await tp.goto(`${BASE}#/`);
    await pause(2400);
    await shot(tp, '21-home-768');
    await tablet.close();

    const desk = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const dp = await desk.newPage();
    watch(dp, 'desktop');
    await dp.goto(BASE);
    await pause(1200);
    const chooser3 = dp.waitForEvent('filechooser');
    await dp.goto(`${BASE}#/settings`);
    await pause(900);
    await dp.getByRole('button', { name: 'import json' }).click();
    await (await chooser3).setFiles(seedPath);
    await pause(700);
    await dp.getByRole('button', { name: 'merge backup' }).click();
    await pause(700);
    await dp.goto(`${BASE}#/`);
    await pause(2600);
    await shot(dp, '22-desktop-home');
    await dp.keyboard.press('Control+k');
    await pause(500);
    await shot(dp, '23-desktop-terminal');
    await desk.close();

    // ── 8. reduced motion ────────────────────────────────────────────────────
    const calm = await browser.newContext({ ...IPHONE_11, reducedMotion: 'reduce' });
    const cp = await calm.newPage();
    watch(cp, 'reduced');
    await cp.goto(BASE);
    await pause(400);
    await shot(cp, '24-reduced-first-paint');
    const bootGone = await cp.evaluate(() => !document.querySelector('[class*="boot"]'));
    if (!bootGone) errors.push('reduced motion: boot overlay still present');
    await calm.close();
  } finally {
    await browser.close();
    server.close();
  }

  if (errors.length) {
    console.error(`\n✗ ${errors.length} problem(s):`);
    for (const e of errors) console.error('  ', e);
    process.exitCode = 1;
  } else {
    console.log(`\n✓ smoke passed — screenshots in ${OUT}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
