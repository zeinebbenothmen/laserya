/**
 * mobile-shot.js — Captures mobiles (iPhone 390×844) de pages clés.
 * Usage : node backend/mobile-shot.js [page1 page2 ...]  (chemins relatifs, défaut : contact)
 */
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE = 'http://localhost:3001';
const OUT = path.join(__dirname, '_mobile-shots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);

const pages = process.argv.slice(2).length ? process.argv.slice(2) : ['/pages/contact.html'];

(async () => {
  const userDataDir = path.join(require('os').tmpdir(), 'edge-mob-' + Date.now());
  const PORT = 9223;
  const edgeProc = spawn(EDGE, [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDataDir}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--disable-dev-shm-usage',
  ], { detached: false, stdio: 'ignore' });

  let ws = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 500));
    try { const v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); ws = v.webSocketDebuggerUrl; if (ws) break; } catch {}
  }
  if (!ws) { try { edgeProc.kill(); } catch {} throw new Error('Edge debug indisponible'); }

  const browser = await puppeteer.connect({ browserWSEndpoint: ws, defaultViewport: { width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 } });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

  for (const p of pages) {
    const url = BASE + p;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1200));
    if (process.env.MM_OPEN) { await page.click('#mm-burger').catch(() => {}); await new Promise(r => setTimeout(r, 500)); }
    const name = p.replace(/[\/]/g, '_').replace(/^_+/, '') || 'page';
    const file = path.join(OUT, name + '.png');
    try { await page.screenshot({ path: file, fullPage: true }); console.log('📱 ' + file); }
    catch (e) { console.log('⚠️  fullPage ignoré (' + e.message.slice(0, 40) + ')'); }
    // Gros plan sur l'en-tête (haut de l'écran)
    const head = path.join(OUT, name + '__header.png');
    await page.screenshot({ path: head, clip: { x: 0, y: 0, width: 390, height: Number(process.env.CLIP_H) || 80 } });
    console.log('📱 ' + head);
    if (process.env.MM_OPEN) {
      const menu = path.join(OUT, name + '__menu.png');
      await page.screenshot({ path: menu, fullPage: false }); // viewport seul (montre le menu déroulé)
      console.log('📱 ' + menu);
    }
  }

  await browser.disconnect();
  try { edgeProc.kill(); } catch {}
})();
