import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => readFileSync(join(root, name), 'utf8');
const htmlSource = read('index.html');
const batterySource = read('battery-game-v18.js');
const css = read('styles.css');

function browserBinary() {
  for (const name of ['google-chrome', 'chromium', 'chromium-browser']) {
    if (spawnSync('which', [name], { encoding: 'utf8' }).status === 0) return name;
  }
  throw new Error('Actual Chromium browser is required for the clickable hit-test');
}

function installFakeApi() {
  window.StarryBatteryCharge = {mount: () => null, flash: () => true};
  window.fetch = async url => {
    if (String(url).includes('/api/starry-game/battery')) {
      return {ok: true, status: 200, json: async () => ({balance: 12.50})};
    }
    throw Error('Unexpected network request: ' + url);
  };
}

function smoke() {
  setTimeout(() => {
    const result = document.createElement('output');
    result.id = 'battery-click-results';
    document.body.appendChild(result);
    try {
      const badge = document.getElementById('starryBatteryCenter');
      const menu = document.getElementById('starryBatteryAccountMenu');
      if (!badge || !menu) throw Error('battery row or menu not mounted');
      if (badge.dataset.accountReady !== '1') throw Error('authenticated balance not loaded');
      if (getComputedStyle(badge).pointerEvents !== 'auto') throw Error('battery row cannot receive pointer events');
      const points = [
        ['icon', badge.querySelector('.battery-icon')],
        ['title', badge.querySelector('.battery-title')],
        ['balance', badge.querySelector('.battery-value')]
      ];
      for (const [name, element] of points) {
        if (!element) throw Error(name + ' is missing');
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width/2, rect.top + rect.height/2);
        if (!hit?.closest?.('#starryBatteryCenter')) {
          throw Error(name + ' intercepted by ' + (hit?.tagName || 'none'));
        }
        hit.dispatchEvent(new MouseEvent('click', {bubbles:true,cancelable:true,view:window}));
        if (menu.hidden) throw Error(name + ' click did not open the menu');
        const labels = Array.from(menu.querySelectorAll('button')).map(x => x.textContent.trim());
        if (labels.join('|') !== '登出|切換使用身分|取消') throw Error('menu options changed');
        const menuRect = menu.getBoundingClientRect();
        if (menuRect.left < -1 || menuRect.right > innerWidth + 1) throw Error('menu clipped');
        menu.querySelector('[data-account-action="cancel"]').click();
        if (!menu.hidden) throw Error('cancel did not close menu');
      }
      if (badge.querySelector('.battery-value').textContent !== '12.50 顆') {
        throw Error('balance changed');
      }
      result.dataset.status = 'pass';
      result.textContent = 'real browser hit test and click on icon/title/balance succeeded';
    } catch (error) {
      result.dataset.status = 'fail';
      result.textContent = String(error?.message || error);
    }
  }, 250);
}

function htmlFixture() {
  const raw = htmlSource.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  const withCss = raw.replace(/<link\b[^>]*href=["'](?:\.\/)?styles\.css["'][^>]*>/i,
    '<style>' + css + '</style>');
  assert.notEqual(withCss, raw, 'real page stylesheet must be embedded');
  assert.match(withCss, /\.brand-mark\{[^}]*pointer-events:none!important/);
  assert.match(css, /\.hero\s*\{[^}]*pointer-events:none/);
  assert.match(batterySource, /#starryBatteryCenter\[data-account-ready="1"\]\{[^}]*pointer-events:auto!important/);
  assert.match(withCss, /<\/body>/i);
  const scripts = '<script>(' + installFakeApi.toString() + ')();</script>' +
    '<script>' + batterySource.replaceAll('</script>', '<\\/script>') + '</script>' +
    '<script>(' + smoke.toString() + ')();</script>';
  return withCss.replace(/<\/body>/i, scripts + '</body>');
}

for (const viewport of [{name:'desktop',width:1280,height:900},{name:'mobile',width:390,height:844}]) {
  test('actual browser hit-tests battery icon/title/balance (' + viewport.name + ')', () => {
    const folder = mkdtempSync(join(tmpdir(), 'starry-battery-click-'));
    try {
      const htmlPath = join(folder,'index.html');
      writeFileSync(htmlPath,htmlFixture());
      const stdout = execFileSync(browserBinary(), [
        '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
        '--no-first-run','--disable-background-networking','--no-default-browser-check',
        '--user-data-dir=' + join(folder,'chrome-profile'),
        '--window-size=' + viewport.width + ',' + viewport.height,
        '--virtual-time-budget=2200','--dump-dom','file://' + htmlPath
      ], {encoding:'utf8',timeout:25000,stdio:['ignore','pipe','pipe']});
      const match = stdout.match(/<output\b[^>]*id="battery-click-results"[^>]*>([^<]*)<\/output>/i);
      assert.ok(match,'Chromium did not return click test result');
      assert.match(match[0],/data-status="pass"/,'browser click failure: '+match[1]);
    } finally {
      rmSync(folder,{recursive:true,force:true});
    }
  });
}
