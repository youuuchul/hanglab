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

// S3 타이머 → 세트 기록. 기록 = 시작 탭부터 정지 탭까지(준비 카운트다운 없음). 클릭 전후 시각으로 허용 구간을 잡는다
const tStart = Date.now();
await page.getByText('시작', { exact: true }).click();
const tStarted = Date.now();
await page.waitForTimeout(300);
t = await text();
check('S3 시작 즉시 매달리기(3-2-1 없음)', t.includes('매달리기') && !t.includes('준비') && /\n0\.\d\n/.test(t));
await shot('03-hang.png');
await page.waitForTimeout(2000);
const tStop = Date.now();
await page.getByText('정지', { exact: true }).click();
const tStopped = Date.now();
await page.waitForTimeout(300);
t = await text();
const m = t.match(/(\d+\.\d)초\n/);
const sec = m ? Number(m[1]) : NaN;
const lo = (tStop - tStarted) / 1000 - 0.05;
const hi = (tStopped - tStart) / 1000 + 0.05;
check('S3 세트 기록: 1세트, 실제 매달린 시간', t.includes('1세트') && sec >= lo && sec <= hi, `기록 ${sec}초, 허용 ${lo.toFixed(2)}~${hi.toFixed(2)}`);
check('S3 휴식 전환', t.includes('휴식') && /\n0:0\d\n/.test(t));
await shot('04-after-set.png');

// 연속 동작: 정지 두 번 연타해도 1세트
await page.getByText('시작', { exact: true }).click();
await page.waitForTimeout(400);
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
await page.waitForTimeout(1000);
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
const clockOf = async () => (await text()).match(/(?:대기|휴식[^\n]*|매달리기|준비|운동)\n([^\n]+)\n/)?.[1];
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

await page.getByText('타이머', { exact: true }).click();
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
await page.waitForTimeout(500);
const remaining = Number(await clockOf());
check('S11 시작 즉시 남은 시간 감소(3-2-1 없음)', remaining > 0 && remaining < 2 && !(await text()).includes('준비'), `남은 ${remaining}`);
await shot('11-countdown.png');
await page.waitForTimeout(2000);
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
check('S11 새로고침 후 모드·목표 유지(반대쪽 탭)', (await dial.count()) === 1 && (await clockOf()) === '12.0' && prefs.tab === 'timer' && prefs.targetsS['beastmaker-1000|both|bm1000-r2-03,bm1000-r2-05'] === 12, JSON.stringify(prefs));

const cStart = Date.now();
await page.getByText('시작', { exact: true }).click();
const cStarted = Date.now();
await page.waitForTimeout(300);
await dragDial(-101);
await page.waitForTimeout(400);
const cStop = Date.now();
await page.getByText('정지', { exact: true }).click();
const cStopped = Date.now();
await page.waitForTimeout(300);
check('S11 매달리기 중 다이얼 잠금', (await nextTarget()) === 12, `다음 ${await nextTarget()}초`);
const early = Number((await page.getByText(/^\d+\.\d초$/).first().innerText()).replace('초', ''));
const elo = (cStop - cStarted) / 1000 - 0.05;
const ehi = (cStopped - cStart) / 1000 + 0.05;
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
await page.waitForTimeout(300);
await page.clock.fastForward('11:00');
await page.waitForTimeout(300);
const longClock = await clockOf();
await page.getByText('정지', { exact: true }).click();
await page.waitForTimeout(300);
const longRow = await page.getByText(/^\d+분 \d+초$/).first().innerText();
check('S12 스톱워치 11분: 분:초 표시, 기록', /^11:0\d$/.test(longClock) && /^11분 \d초$/.test(longRow), `${longClock} / ${longRow}`);

await page.getByText('타이머', { exact: true }).click();
await editTarget('600');
const maxLabel = (await clockOf()) === '10:00';
await page.getByText('시작', { exact: true }).click();
await page.waitForTimeout(300);
const maxRunning = await clockOf();
await page.clock.fastForward('10:00');
await page.waitForTimeout(300);
const maxRows = await page.getByText(/^\d+분 \d+초$/).allInnerTexts();
t = await text();
check('S12 타이머 10분: 휴식 중 입력 → 10:00 시작 → 자동 기록', maxLabel && /^(9:5\d|10:00)$/.test(maxRunning) && maxRows[0] === '10분 0초' && (await clockOf()) === '10:00' && /휴식 · 0:0\d/.test(t), `${maxLabel} / ${maxRunning} / ${maxRows[0]}`);

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

// S14 인터벌: 세로 다이얼 설정·저장(숫자만), 처음에만 3-2-1, 운동/휴식 번갈아 감소·색 구분, 왼쪽 위 단계·오른쪽 위 세트 n/n, 운동마다 기록, 중간 정지, 백그라운드 복귀
const ACCENT = 'rgb(255, 106, 31)';
const REST = 'rgb(61, 155, 255)';
const valueOf = async (label) => page.locator(`[aria-label="${label}"]`).getAttribute('aria-valuetext');
const dragV = async (label, dy) => {
  const box = await page.locator(`[aria-label="${label}"]`).boundingBox();
  const x = box.x + box.width / 2;
  await page.mouse.move(x, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, box.y + box.height / 2 + dy, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(300);
};
// 진행 화면 텍스트 순서: 단계\n세트 n/n\n큰 숫자
const ivClock = async () => (await text()).match(/세트 \d+\/\d+\n([^\n]+)\n/)?.[1];
const ivSet = async () => (await text()).match(/세트 \d+\/\d+/)?.[0];
const clockColor = async () => page.getByText(await ivClock(), { exact: true }).first().evaluate((n) => getComputedStyle(n).color);
// 단계는 큰 숫자 왼쪽 위, 세트는 오른쪽 위, 위쪽 가운데 제목 없음
const cornerLayout = async (phase) => {
  const p = await page.getByText(phase, { exact: true }).first().boundingBox();
  const s = await page.getByText(/^세트 \d+\/\d+$/).boundingBox();
  const c = await page.getByText(await ivClock(), { exact: true }).first().boundingBox();
  const card = await page.getByText('정지', { exact: true }).boundingBox();
  return p.x + p.width < c.x && s.x > c.x + c.width && p.y + p.height <= c.y && s.y + s.height <= c.y && p.x < card.x + 40 && s.x + s.width > card.x + card.width - 40;
};
const phaseColor = async (label) => page.getByText(label, { exact: true }).first().evaluate((n) => getComputedStyle(n).color);

await page.getByText('인터벌', { exact: true }).click();
t = await text();
const defaults = [await valueOf('운동'), await valueOf('휴식'), await valueOf('세트')];
// 단위는 다이얼과 따로 고정: 끌어도 자리가 그대로이고 숫자보다 작다. 숫자는 얇은 굵기
const unitBox = async (unit, n) => page.getByText(unit, { exact: true }).nth(n).boundingBox();
const styleOf = async (loc) => loc.evaluate((n) => ({ size: parseFloat(getComputedStyle(n).fontSize), weight: getComputedStyle(n).fontWeight }));
// 운동·휴식은 타이머 목표 시간 다이얼과 같은 눈금(눈금 색 line/textDim, 선택 위치 고정 주황 선 1개), 세트는 눈금 없이 숫자만
const tickInfo = async (label) =>
  page.locator(`[aria-label="${label}"]`).evaluate((root) => {
    const nodes = [...root.querySelectorAll('*')];
    const bg = (n) => getComputedStyle(n).backgroundColor;
    const center = nodes.find((n) => bg(n) === 'rgb(255, 106, 31)');
    return {
      accent: nodes.filter((n) => bg(n) === 'rgb(255, 106, 31)').length,
      ticks: nodes.filter((n) => ['rgb(42, 46, 52)', 'rgb(139, 144, 153)'].includes(bg(n))).length,
      centerY: center ? Math.round(center.getBoundingClientRect().y) : null,
    };
  });
const ticksBefore = [await tickInfo('운동'), await tickInfo('휴식'), await tickInfo('세트')];
check('S14 눈금: 운동·휴식은 눈금+주황 선택 선, 세트는 숫자만', ticksBefore[0].accent === 1 && ticksBefore[0].ticks >= 5 && ticksBefore[1].accent === 1 && ticksBefore[1].ticks >= 5 && ticksBefore[2].accent === 0 && ticksBefore[2].ticks === 0, JSON.stringify(ticksBefore));
const unitBefore = await unitBox('s', 0);
const unitStyle = await styleOf(page.getByText('s', { exact: true }).first());
const numberStyle = await styleOf(page.locator('[aria-label="운동"]').getByText('7', { exact: true }));
check('S14 인터벌 탭: 세로 다이얼 3개, 기본 7s·3s·6회, 큰 시계 없음', defaults.join('/') === '7s/3s/6회' && !t.includes('대기'), defaults.join('/'));
check('S14 단위 s·회는 숫자보다 작고, 숫자는 얇은 굵기', (await page.getByText('s', { exact: true }).count()) === 2 && (await page.getByText('회', { exact: true }).count()) === 1 && unitStyle.size < numberStyle.size && Number(numberStyle.weight) <= 400, `${JSON.stringify(unitStyle)} / ${JSON.stringify(numberStyle)}`);
await dragV('운동', 60);
await dragV('휴식', -31);
const restUp = await valueOf('휴식');
await dragV('휴식', 31);
await dragV('세트', 600);
const setsMin = await valueOf('세트');
await dragV('세트', -31);
const chosen = [await valueOf('운동'), await valueOf('휴식'), await valueOf('세트')];
const ivPrefs = await page.evaluate(() => JSON.parse(localStorage.getItem('hanglab.timer.v1')).interval);
check('S14 세로 다이얼: 아래로 끌면 감소·위로 끌면 증가·끝에서 멈춤, 저장', chosen.join('/') === '5s/3s/2회' && restUp === '4s' && setsMin === '1회' && JSON.stringify(ivPrefs) === '{"workS":5,"restS":3,"sets":2}', `${chosen.join('/')} 휴식↑${restUp} 세트최소${setsMin} ${JSON.stringify(ivPrefs)}`);
const unitAfter = await unitBox('s', 0);
const centerAfter = (await tickInfo('운동')).centerY;
check('S14 단위·주황 선택 선은 다이얼과 같이 돌지 않음(끈 뒤에도 같은 자리)', unitBefore.x === unitAfter.x && unitBefore.y === unitAfter.y && centerAfter === ticksBefore[0].centerY, `단위 ${unitBefore.y} → ${unitAfter.y}, 선 ${ticksBefore[0].centerY} → ${centerAfter}`);
await page.locator('[aria-label="운동"]').scrollIntoViewIfNeeded();
await shot('14-interval-setup.png');
await page.locator('[aria-label="운동"]').screenshot({ path: path.join(out, '14b-interval-dial.png') });

// 시계를 멈추고 정해진 만큼만 흘려 단계 경계를 확인한다. T=시작 시각, 운동 5초·휴식 3초·2세트 → 끝 T+3+13초
const advance = async (ms) => {
  await page.clock.runFor(ms);
  await page.waitForTimeout(150);
};
await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
const ivBefore = await todayCount();
await page.getByText('시작', { exact: true }).click();
await advance(100);
t = await text();
check('S14 시작: 3-2-1 준비, 탭·다이얼 숨김, 세트 1/2', (await ivClock()) === '3' && t.includes('준비') && (await ivSet()) === '세트 1/2' && !t.includes('남은') && !t.includes('스톱워치') && (await page.locator('[aria-label="운동"]').count()) === 0, await ivSet());
await advance(3000 + 2400);
t = await text();
const work1 = [await ivClock(), await clockColor(), await phaseColor('운동'), await ivSet()];
const layout1 = await cornerLayout('운동');
check('S14 운동 1(T+5.5초): 운동 시간 감소(숫자만), 주황, 세트 1/2', work1[0] === '2.5' && work1[1] === ACCENT && work1[2] === ACCENT && work1[3] === '세트 1/2', work1.join(' / '));
check('S14 진행 화면 배치: 왼쪽 위 운동/휴식, 오른쪽 위 세트, 가운데 제목 없음', layout1 && !/남은 \d+세트/.test(t));
await shot('15-interval-work.png');
await advance(4000);
t = await text();
const rest1 = [await ivClock(), await clockColor(), await phaseColor('휴식'), await ivSet()];
check('S14 휴식(T+9.5초): 휴식 시간 감소, 파랑, 세트 1/2 유지, 운동 1회 기록', rest1[0] === '1.5' && rest1[1] === REST && rest1[2] === REST && rest1[3] === '세트 1/2' && (await cornerLayout('휴식')) && (await todayCount()) === ivBefore + 1, rest1.join(' / '));
await shot('16-interval-rest.png');
await advance(2500);
t = await text();
check('S14 운동 2(T+12초): 준비 없이 바로 운동, 세트 2/2', (await ivClock()) === '4.0' && t.includes('운동') && !t.includes('준비') && (await ivSet()) === '세트 2/2', `${await ivClock()} ${await ivSet()}`);
await advance(4200);
t = await text();
const ivRows = (await page.getByText(/^\d+\.\d초$/).allInnerTexts()).slice(0, 2);
check('S14 마지막 운동 뒤(T+16.2초) 휴식 없이 종료, 운동 2회 각 5.0초 기록', (await todayCount()) === ivBefore + 2 && ivRows.join(',') === '5.0초,5.0초' && t.includes('스톱워치') && !/세트 \d+\/\d+/.test(t), `${ivRows.join(',')} / 세트 ${await todayCount()}`);

await page.getByText('시작', { exact: true }).click();
await advance(3000 + 1200);
await page.getByText('정지', { exact: true }).click();
await advance(100);
t = await text();
const ivStop = await page.getByText(/^\d+\.\d초$/).first().innerText();
check('S14 운동 중 정지: 실제 시간 기록 후 종료', (await todayCount()) === ivBefore + 3 && ivStop === '1.2초' && t.includes('인터벌'), ivStop);

await page.getByText('시작', { exact: true }).click();
await advance(3000 + 2000);
await page.clock.fastForward(20000);
await advance(200);
t = await text();
check('S14 멈췄다 돌아와도 끝난 운동 모두 기록', (await todayCount()) === ivBefore + 5 && t.includes('스톱워치'), `세트 ${await todayCount()}`);
await page.clock.resume();

// S15 이전 형식(카운트다운 여부만 저장) 설정은 타이머 탭으로 옮긴다
await page.evaluate(() => localStorage.setItem('hanglab.timer.v1', JSON.stringify({ countdown: true, lastTargetS: 12, targetsS: {} })));
await page.reload();
await page.locator(`[aria-label="${b1.name}"]`).waitFor();
await page.waitForTimeout(500);
check('S15 이전 설정: 카운트다운 → 타이머 탭, 목표 유지, 인터벌 기본값', (await dial.count()) === 1 && (await clockOf()) === '12.0' && !(await text()).includes('카운트다운'));

check('콘솔 에러 없음', errors.length === 0, errors.slice(0, 3).join(' / '));
fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
await browser.close();
console.log(`${results.filter((r) => r.ok).length}/${results.length} passed`);
