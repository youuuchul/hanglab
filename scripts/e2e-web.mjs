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

// S3 타이머 → 세트 기록. 기록 = 시작 탭 3초 뒤부터 정지 탭까지. 클릭 전후 시각으로 허용 구간을 잡는다
const tStart = Date.now();
await page.getByText('시작', { exact: true }).click();
const tStarted = Date.now();
await page.waitForTimeout(300);
t = await text();
check('S3 준비 카운트다운', t.includes('준비') && /\n3\n/.test(t));
await page.waitForTimeout(3000);
t = await text();
check('S3 매달리기 전환', t.includes('매달리기'));
await shot('03-hang.png');
await page.waitForTimeout(2000);
const tStop = Date.now();
await page.getByText('정지', { exact: true }).click();
const tStopped = Date.now();
await page.waitForTimeout(300);
t = await text();
const m = t.match(/(\d+\.\d)초\n/);
const sec = m ? Number(m[1]) : NaN;
const lo = (tStop - tStarted - 3000) / 1000 - 0.05;
const hi = (tStopped - tStart - 3000) / 1000 + 0.05;
check('S3 세트 기록: 1세트, 실제 매달린 시간', t.includes('1세트') && sec >= lo && sec <= hi, `기록 ${sec}초, 허용 ${lo.toFixed(2)}~${hi.toFixed(2)}`);
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

// S13 마지막 선택 복원: 새로 열면 보드·손 모드·홀드가 골라진 채로 바로 시작 가능
await tapHold(b2, 'bm2000-r2-02');
await page.getByText('한 손', { exact: true }).click();
const oneLabel = (await text()).match(/가운데줄 · (왼쪽|오른쪽) · 모노[^\n]*/)?.[0];
await page.reload();
await page.locator(`[aria-label="${b2.name}"]`).waitFor();
await page.waitForTimeout(500);
t = await text();
const restoredStart = await page.getByText('시작', { exact: true }).evaluate((n) => n.closest('[aria-disabled]')?.getAttribute('aria-disabled'));
check('S13 새로고침 후 2000·한 손·홀드 복원, 시작 활성', !!oneLabel && t.includes(oneLabel) && restoredStart !== 'true', `${oneLabel} / aria-disabled=${restoredStart}`);
await page.getByText('양손', { exact: true }).click();
await page.getByText('Beastmaker 1000', { exact: true }).click();

// S7~S10 지표·기록 시트·세트 삭제. 이번 주 월요일 0시 기준 fixture
// A(가운데줄 3손가락 포켓 양손): 3주 전 20s / 지난주 5s, 10s(일요일 23:59) / 이번 주 7s(월요일 0시), 12s(쌍 순서 반대)
// B(가운데줄 왼쪽 엣지 한 손): 이번 주 3s
// 기대: A 이번 주 19.0초 +4.0초 · 최장 20.0초 / B 3.0초 +3.0초 / 전체 이번 주 22.0초 +7.0초 3세트, 지난주 15.0초
const KEY = 'hanglab.sets.v1';
const fx = await page.evaluate((key) => {
  const now = Date.now();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const day = (n) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + n);
    return d.getTime();
  };
  const hour = 3600e3;
  const mk = (holdIds, mode, sec, endedAt) => ({ id: `fx${endedAt}`, boardId: 'beastmaker-1000', holdIds, mode, durationMs: sec * 1000, endedAt });
  const A = ['bm1000-r2-03', 'bm1000-r2-05'];
  const sets = [
    mk(A, 'both', 20, day(-21) + hour),
    mk(A, 'both', 5, day(-4) + hour),
    mk(A, 'both', 10, day(0) - 60e3),
    mk(A, 'both', 7, day(0)),
    mk([...A].reverse(), 'both', 12, Math.min(now, day(0) + hour)),
    mk(['bm1000-r2-01'], 'one', 3, Math.min(now, day(0) + 2 * hour)),
  ].sort((a, b) => a.endedAt - b.endedAt);
  localStorage.setItem(key, JSON.stringify(sets));
  const today = new Date(now).setHours(0, 0, 0, 0);
  const w3 = new Date(day(-21));
  return { count: sets.length, todayCount: sets.filter((s) => s.endedAt >= today).length, label3: `${w3.getMonth() + 1}/${w3.getDate()}` };
}, KEY);
await page.reload();
await page.locator(`[aria-label="${b1.name}"]`).waitFor();
await page.waitForTimeout(500);
const todayCount = async () => Number((await text()).match(/오늘\n(\d+)세트/)?.[1]);

const A_STAT = '이번 주 19.0초 +4.0초 · 최장 20.0초';
await tapHold(b1, 'bm1000-r2-03');
t = await text();
check('S7 선택 홀드 지표(일요일 23:59=지난주, 월요일 0시=이번 주)', t.includes(A_STAT));
await shot('07-hold-stat.png');
await tapHold(b1, 'bm1000-r2-03');
await tapHold(b1, 'bm1000-r2-05');
t = await text();
check('S7 반대쪽 탭해도 같은 지표', t.includes(A_STAT));
await tapHold(b1, 'bm1000-r3-01');
t = await text();
check('S7 기록 없는 홀드', t.includes('기록 없음') && !t.includes('이번 주 '));
await tapHold(b1, 'bm1000-r2-01');
t = await text();
const bothEmpty = t.includes('기록 없음');
await page.getByText('한 손', { exact: true }).click();
t = await text();
check('S7 양손/한 손 지표 분리', bothEmpty && t.includes('이번 주 3.0초 +3.0초 · 최장 3.0초'));
await page.getByText('양손', { exact: true }).click();

await page.getByText('기록', { exact: true }).click();
const dialog = page.locator('[role="dialog"]');
await dialog.getByText('홀드별', { exact: true }).waitFor();
await page.waitForTimeout(400);
let d = await dialog.innerText();
check('S8 이번 주 합계·증감·세트 수', d.includes('22.0초') && d.includes('+7.0초') && d.includes('3세트 · 지난주 15.0초'));
const curBar = await dialog.locator('[aria-label="이번 주 22.0초"]').count();
const oldBar = await dialog.locator(`[aria-label="${fx.label3} 20.0초"]`).count();
check('S8 8주 막대: 이번 주, 3주 전(전체+홀드 카드)', curBar === 1 && oldBar === 2, `이번 주 ${curBar}, ${fx.label3} ${oldBar}`);
const iA = d.indexOf('가운데줄 · 3손가락 포켓 · 45mm');
const iB = d.indexOf('가운데줄 · 왼쪽');
check('S8 홀드 카드 볼륨 순(A 19.0초 > B 3.0초)', iA >= 0 && iB > iA && d.includes('최장 20.0초'), `A@${iA} B@${iB}`);
await shot('08-stats.png');
await dialog.getByText('닫기', { exact: true }).click();
await page.waitForTimeout(600);
check('S8 닫기', (await dialog.count()) === 0);

await tapHold(b1, 'bm1000-r2-03');
const before = await todayCount();
await page.getByText('시작', { exact: true }).click();
await page.waitForTimeout(4000);
await page.getByText('정지', { exact: true }).click();
await page.waitForTimeout(300);
const afterRecord = await todayCount();
await page.getByText(/^\d+\.\d초$/).first().click();
await page.getByText('삭제', { exact: true }).waitFor();
await shot('09-delete.png');
await page.getByText('삭제', { exact: true }).click();
await page.waitForTimeout(300);
t = await text();
check('S9 세트 삭제: 개수·지표 복원', before === fx.todayCount && afterRecord === before + 1 && (await todayCount()) === before && t.includes(A_STAT), `${before}→${afterRecord}→${await todayCount()}`);
await page.reload();
await page.locator(`[aria-label="${b1.name}"]`).waitFor();
await page.waitForTimeout(500);
const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).length, KEY);
check('S9 삭제 후 새로고침 유지', (await todayCount()) === before && stored === fx.count, `저장 ${stored}개`);

await page.evaluate(() => localStorage.clear());
await page.reload();
await page.locator(`[aria-label="${b1.name}"]`).waitFor();
await page.waitForTimeout(500);
await page.getByText('기록', { exact: true }).click();
await dialog.getByText('홀드별', { exact: true }).waitFor();
d = await dialog.innerText();
check('S10 기록 없음 시트', d.includes('기록 없음') && d.includes('0세트 · 지난주 0.0초') && d.includes('+0.0초'));
await shot('10-stats-empty.png');
await dialog.getByText('닫기', { exact: true }).click();
await page.waitForTimeout(600);

// S11 카운트다운: 홀드 없이도 조절, 시계 두 번 탭 입력(하한·상한·잘못된 입력), 0초 자동 기록, 다이얼, 홀드별 목표·마지막 목표·모드 저장, 매달리기 중 잠금, 중간 정지
const dial = page.locator('[aria-label="목표 시간"]');
const input = page.locator('[aria-label="목표 시간 입력"]');
const clockOf = async () => (await text()).match(/(?:대기|휴식[^\n]*|매달리기|준비)\n([^\n]+)\n/)?.[1];
const editTarget = async (value, capture) => {
  await page.getByText(await clockOf(), { exact: true }).first().dblclick();
  await input.fill(value);
  if (capture) await shot(capture);
  await page.getByText('완료', { exact: true }).click();
  await page.waitForTimeout(150);
};
const dragDial = async (dx) => {
  const box = await dial.boundingBox();
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + dx, y, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(300);
};
// 카운트다운 휴식 중에는 큰 숫자가 다음 목표, 작은 글씨가 휴식 경과
const nextTarget = async () => Number(await clockOf());

await page.getByText('카운트다운', { exact: true }).click();
t = await text();
check('S11 기본 목표 10초, 숫자는 시계에만', (await clockOf()) === '10.0' && !/\n10초\n/.test(t) && (await dial.count()) === 1);
await editTarget('7');
const noHoldTyped = await clockOf();
await dragDial(-29);
const noHoldDragged = await clockOf();
check('S11 홀드 선택 없이 입력·다이얼 조절', noHoldTyped === '7.0' && noHoldDragged === '9.0', `${noHoldTyped} / ${noHoldDragged}`);
await tapHold(b1, 'bm1000-r2-03');
check('S11 저장 안 된 홀드는 마지막 목표로 시작', (await clockOf()) === '9.0');
await editTarget('0', '11-edit.png');
const atMin = await clockOf();
await editTarget('999');
const atMax = await clockOf();
await editTarget('abc');
const afterBad = await clockOf();
check('S11 키보드 입력: 0→1초, 999→10분, 문자 무시', atMin === '1.0' && atMax === '10:00' && afterBad === '10:00', `${atMin} / ${atMax} / ${afterBad}`);
await editTarget('2');
check('S11 키보드 입력 2초', (await clockOf()) === '2.0');

await page.getByText('시작', { exact: true }).click();
await page.waitForTimeout(3500);
const remaining = Number(await clockOf());
check('S11 남은 시간 감소', remaining > 0 && remaining < 2, `남은 ${remaining}`);
await shot('11-countdown.png');
await page.waitForTimeout(2500);
const autoRows = await page.getByText(/^\d+\.\d초$/).allInnerTexts();
t = await text();
check('S11 0초에 자동 기록(정지 안 누름)', (await todayCount()) === 1 && autoRows[0] === '2.0초', `세트 ${autoRows.join(',')}`);
check('S11 휴식 중: 큰 숫자 = 다음 목표, 작은 글씨 = 휴식 경과', (await nextTarget()) === 2 && /휴식 · 0:0\d\n/.test(t) && !t.includes('다음'), t.match(/휴식[^\n]*\n[^\n]+/)?.[0]);
await page.waitForTimeout(1000);
check('S11 자동 기록 중복 없음', (await todayCount()) === 1);

await dragDial(-101);
const dragged = await nextTarget();
await dragDial(400);
const dragMin = await nextTarget();
await dragDial(-113);
await dragDial(-29);
const dragged12 = await nextTarget();
check('S11 다이얼: 왼쪽 8칸 +8초, 끝까지 1초, 12초 설정', dragged === 10 && dragMin === 1 && dragged12 === 12, `${dragged} / ${dragMin} / ${dragged12}`);
await shot('12-dial.png');

await tapHold(b1, 'bm1000-r3-01');
const inherited = await nextTarget();
await editTarget('5');
const otherSet = await nextTarget();
await tapHold(b1, 'bm1000-r2-03');
const backToA = await nextTarget();
await tapHold(b1, 'bm1000-r3-02');
const fresh = await nextTarget();
check('S11 홀드별 목표: B는 마지막 12초로 시작→5초, A는 12초 유지, 새 홀드는 5초', inherited === 12 && otherSet === 5 && backToA === 12 && fresh === 5, `${inherited} / ${otherSet} / ${backToA} / ${fresh}`);
await page.reload();
await page.locator(`[aria-label="${b1.name}"]`).waitFor();
await page.waitForTimeout(500);
await tapHold(b1, 'bm1000-r2-05');
const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem('hanglab.timer.v1')));
check('S11 새로고침 후 모드·목표 유지(반대쪽 탭)', (await dial.count()) === 1 && (await clockOf()) === '12.0' && prefs.countdown === true && prefs.targetsS['beastmaker-1000|both|bm1000-r2-03,bm1000-r2-05'] === 12, JSON.stringify(prefs));

const cStart = Date.now();
await page.getByText('시작', { exact: true }).click();
const cStarted = Date.now();
await page.waitForTimeout(3300);
await dragDial(-101);
await page.waitForTimeout(400);
const cStop = Date.now();
await page.getByText('정지', { exact: true }).click();
const cStopped = Date.now();
await page.waitForTimeout(300);
check('S11 매달리기 중 다이얼 잠금', (await nextTarget()) === 12, `다음 ${await nextTarget()}초`);
const early = Number((await page.getByText(/^\d+\.\d초$/).first().innerText()).replace('초', ''));
const elo = (cStop - cStarted - 3000) / 1000 - 0.05;
const ehi = (cStopped - cStart - 3000) / 1000 + 0.05;
check('S11 목표 12초 중간 정지: 실제 시간 기록', (await todayCount()) === 2 && early >= elo && early <= ehi, `기록 ${early}초, 허용 ${elo.toFixed(2)}~${ehi.toFixed(2)}`);

await page.getByText('스톱워치', { exact: true }).click();
check('S11 스톱워치 복귀 시 다이얼 숨김', (await dial.count()) === 0);
await page.reload();
await page.locator(`[aria-label="${b1.name}"]`).waitFor();
await page.waitForTimeout(500);
check('S11 새로고침 후 스톱워치 모드 유지', (await dial.count()) === 0 && (await page.getByText('스톱워치', { exact: true }).count()) === 1);

// S12 긴 시간: 브라우저 시계를 앞으로 돌려 11분 스톱워치, 10분 카운트다운 자동 기록, 1분 이상 표시, 다이얼 구간별 간격
await ctx.clock.install();
await page.reload();
await page.locator(`[aria-label="${b1.name}"]`).waitFor();
await page.waitForTimeout(500);
await tapHold(b1, 'bm1000-r2-03');
await page.getByText('시작', { exact: true }).click();
await page.waitForTimeout(3500);
await page.clock.fastForward('11:00');
await page.waitForTimeout(300);
const longClock = await clockOf();
await page.getByText('정지', { exact: true }).click();
await page.waitForTimeout(300);
const longRow = await page.getByText(/^\d+분 \d+초$/).first().innerText();
check('S12 스톱워치 11분: 분:초 표시, 기록', /^11:0\d$/.test(longClock) && /^11분 \d초$/.test(longRow), `${longClock} / ${longRow}`);

await page.getByText('카운트다운', { exact: true }).click();
await editTarget('600');
const maxLabel = (await clockOf()) === '10:00';
await page.getByText('시작', { exact: true }).click();
await page.waitForTimeout(3500);
const maxRunning = await clockOf();
await page.clock.fastForward('10:00');
await page.waitForTimeout(300);
const maxRows = await page.getByText(/^\d+분 \d+초$/).allInnerTexts();
t = await text();
check('S12 카운트다운 10분: 휴식 중 입력 → 10:00 시작 → 자동 기록', maxLabel && /^(9:5\d|10:00)$/.test(maxRunning) && maxRows[0] === '10분 0초' && (await clockOf()) === '10:00' && /휴식 · 0:0\d/.test(t), `${maxLabel} / ${maxRunning} / ${maxRows[0]}`);

await editTarget('60');
await dragDial(-13);
t = await text();
const at65 = await clockOf();
await editTarget('180');
await dragDial(-13);
t = await text();
const at195 = await clockOf();
check('S12 다이얼 간격: 60→65초, 180→195초', at65 === '1:05' && at195 === '3:15', `${at65} / ${at195}`);
await shot('13-long.png');

check('콘솔 에러 없음', errors.length === 0, errors.slice(0, 3).join(' / '));
fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
await browser.close();
console.log(`${results.filter((r) => r.ok).length}/${results.length} passed`);
