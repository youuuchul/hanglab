// HangLab MVP 웹 시나리오 검증. 사용: npm run e2e:web (웹 서버 실행 중, 시스템 Chrome 사용)
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const [out = 'e2e-results', url = 'http://localhost:8081'] = process.argv.slice(2);
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
fs.mkdirSync(out, { recursive: true });
const board = (id) => JSON.parse(fs.readFileSync(path.join(repo, 'data/boards', `${id}.json`), 'utf8'));
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` | ${detail}` : ''}`);
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

async function tapHold(b, holdId) {
  const el = page.locator(`[aria-label="${b.name}"]`);
  const box = await el.boundingBox();
  const vb = (await el.locator('svg').getAttribute('viewBox')).split(' ').map(Number);
  const h = b.holds.find((x) => x.id === holdId).shape;
  const x = box.x + ((h.x + h.w / 2 - vb[0]) / vb[2]) * box.width;
  const y = box.y + ((h.y + h.h / 2 - vb[1]) / vb[3]) * box.height;
  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(150);
}
const text = async () => page.locator('body').innerText();
const shot = (name) => page.screenshot({ path: path.join(out, name) });

await page.goto(url);
await page.evaluate(() => localStorage.clear());
await page.reload();
const b1 = board('beastmaker-1000');
const b2 = board('beastmaker-2000');
await page.locator(`[aria-label="${b1.name}"]`).waitFor();
await shot('01-initial-1000.png');

// S1 보드 표시: 구멍 수 = 정면 홀드 수 (rect 중 구멍 그룹 수로 확인)
const startDisabled = await page.getByText('시작', { exact: true }).evaluate((n) => n.closest('[aria-disabled]')?.getAttribute('aria-disabled'));
check('S1 초기: 홀드 미선택 시 시작 비활성', startDisabled === 'true', `aria-disabled=${startDisabled}`);

// S2 대칭 쌍 선택
await tapHold(b1, 'bm1000-r2-03');
let t = await text();
check('S2 양손: 라벨', t.includes('가운데줄 · 3손가락 포켓 · 45mm'));
const onCount = await page.locator(`[aria-label="${b1.name}"] rect[fill="url(#holeOn)"]`).count();
check('S2 양손: 대칭 쌍 2개 강조', onCount === 2, `강조 ${onCount}개`);
await shot('02-select-both.png');

await page.getByText('한 손', { exact: true }).click();
t = await text();
const onOne = await page.locator(`[aria-label="${b1.name}"] rect[fill="url(#holeOn)"]`).count();
check('S2 한 손: 좌우 표기 + 1개 강조', t.includes('가운데줄 · 왼쪽 · 3손가락 포켓 · 45mm') && onOne === 1, `강조 ${onOne}개`);
await page.getByText('양손', { exact: true }).click();

// 빈 곳 탭은 선택 유지
const vb = await page.locator(`[aria-label="${b1.name}"]`).boundingBox();
await page.touchscreen.tap(vb.x + vb.width / 2, vb.y + 4);
t = await text();
check('S2 빈 곳 탭: 선택 유지', t.includes('가운데줄 · 3손가락 포켓 · 45mm'));

// S3 타이머 → 세트 기록
await page.getByText('시작', { exact: true }).click();
await page.waitForTimeout(300);
t = await text();
check('S3 준비 카운트다운', t.includes('준비') && /\n3\n/.test(t));
await page.waitForTimeout(3000);
t = await text();
check('S3 매달리기 전환', t.includes('매달리기'));
await shot('03-hang.png');
await page.waitForTimeout(2000);
await page.getByText('정지', { exact: true }).click();
await page.waitForTimeout(300);
t = await text();
const m = t.match(/(\d+\.\d)초\n/);
const sec = m ? Number(m[1]) : NaN;
check('S3 세트 기록: 1세트, 약 2초', t.includes('1세트') && sec >= 1.8 && sec <= 2.6, `기록 ${sec}초`);
check('S3 휴식 전환', t.includes('휴식') && /\n0:0\d\n/.test(t));
await shot('04-after-set.png');

// 연속 동작: 정지 두 번 연타해도 1세트
await page.getByText('시작', { exact: true }).click();
await page.waitForTimeout(3400);
const stopBtn = page.getByText('정지', { exact: true });
await stopBtn.dispatchEvent('click');
await stopBtn.dispatchEvent('click').catch(() => {});
await page.waitForTimeout(300);
t = await text();
check('S3 정지 연타: 2세트(중복 없음)', t.includes('2세트') && !t.includes('3세트'));

// S4 재실행 후 유지
await page.reload();
await page.locator(`[aria-label="${b1.name}"]`).waitFor();
await page.waitForTimeout(500);
t = await text();
check('S4 새로고침 후 기록 유지', t.includes('2세트') && t.includes('가운데줄 · 3손가락 포켓 · 45mm'));

// S1 2000 전환 + 모노/슬로퍼
await page.getByText('Beastmaker 2000', { exact: true }).click();
await page.locator(`[aria-label="${b2.name}"]`).waitFor();
t = await text();
check('S1 2000 전환 시 선택 초기화', t.includes('홀드 선택'));
await shot('05-board-2000.png');
await tapHold(b2, 'bm2000-r2-02');
t = await text();
check('S2 2000 모노 탭', t.includes('가운데줄 · 모노'));
await tapHold(b2, 'bm2000-r4-01');
t = await text();
check('S2 2000 슬로퍼 탭', t.includes('윗면 · 슬로퍼 45°'));
await tapHold(b2, 'bm2000-r1-01');
t = await text();
check('S2 2000 짝 없는 홀드 단독 선택', t.includes('윗줄 · 3손가락 포켓'));
await shot('06-2000-select.png');

check('콘솔 에러 없음', errors.length === 0, errors.slice(0, 3).join(' / '));
fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
await browser.close();
console.log(`${results.filter((r) => r.ok).length}/${results.length} passed`);
