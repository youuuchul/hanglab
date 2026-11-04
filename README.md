# HangLab (행랩)

클라이밍 보드 트레이닝 기록 앱. 보드 이미지에서 홀드를 골라 매달린 시간을 세트로 기록한다.

## MVP 범위

- 보드: Beastmaker 1000, 2000
- 보드 이미지에서 홀드 선택 → 매달린 시간(초) 기록 → 세트 기록
- 세트 진행: 행/휴식 카운트다운 또는 스톱워치

## 이후 범위

- 세션 자동 기록, 세트 수 관리
- 홀드별 볼륨·대표 지표, 주간 +/- 증감 시각화
- 체육관 캠퍼스보드 등 보드 추가

## 실행

- `npm install` 후 `npx expo start`
- iPhone: App Store에서 Expo Go 설치 → 터미널 QR을 카메라로 스캔. 맥과 같은 Wi-Fi 필요, 다른 네트워크면 `npx expo start --tunnel`
- 웹: `npx expo start --web`

## 검증

- `npx tsc --noEmit`, `npm run lint`
- `npm run e2e:web`: 웹 서버가 떠 있는 상태에서 시스템 Chrome으로 MVP 시나리오(보드 전환, 대칭 선택, 타이머 기록, 새로고침 후 유지)를 돌린다. 결과와 캡처는 `e2e-results/`

## 디렉토리

- `App.tsx`, `src/`: 앱 화면, 보드 SVG, 타이머, 기기 내 저장
- `data/boards/`: 보드별 홀드 데이터(JSON)
- `scripts/`: 검증 스크립트
- `docs/reference/app/`: 레퍼런스 앱 조사와 스크린샷
- `docs/reference/boards/`: 홀드 데이터 출처와 불확실 항목

## 이름

- 레포·패키지: `hanglab`
- 표시명: HangLab / 행랩
- 도메인 후보: hanglab.kr, 행랩.kr (2026-11-05 whois 기준 미등록, 구매 전)
