# Beastmaker 1000 / 2000 홀드 레퍼런스

조사일 2026-11-05. 데이터 원본은 `data/boards/beastmaker-1000.json`, `beastmaker-2000.json`.
row는 위에서 아래로, order는 좌에서 우로 센다. row 4는 정면 사진에 보이지 않는 슬로퍼 면이다.

## 공통 사항
- 보드 크기는 580 x 150mm, 두께 58mm(Up & Under, The Hangboard 인용).
- Beastmaker 공식 페이지는 접속 시 429로 읽지 못했다. 공식 수치는 리테일러·경쟁사 페이지가 인용한 값으로만 확인했다.
- 종류 구분: 4손가락 폭 홀드는 edge, 2·3손가락과 mono는 pocket으로 분류했다.
- `shape`(구멍 위치·크기)와 `layout`(보드 외곽)은 사용자 촬영 사진에서 잰 좌표를 mm로 환산하고 좌우 대칭으로 맞춘 도식용 값이다. 실측 치수가 아니다.
- confidence 의미: retailer는 리테일러 목록, community는 독립 측정과 목록에서의 추정 대응, photo-estimate는 사진 기준이다.

## Beastmaker 1000
- 정면 홀드 17개(4 / 7 / 6) + 슬로퍼 4개(35도 2, 20도 2) = 21개.
- 리테일러 구성: jug 2, 35도 슬로퍼 2, 20도 슬로퍼 2, very deep 4F 1, deep 4F/3F/2F 각 2, medium 4F/3F/2F 각 2, small 4F 2(10mm).
- 사용자 사진 행별 개수 4 / 7 / 6과 일치.
- row 1: 양끝 small 4F 2개, 중앙 jug 2개. 사진 근거(양끝 폭 77mm·얕은 바닥, 가운데 폭 62mm·깊은 음영)로 2026-11-05 재배치, 신뢰도 photo-estimate. row 2: 대칭 7개, 중앙 가장 넓은 very deep 4F. row 3: 대칭 6개, 상대적으로 얕은 medium 계열.
- 깊이는 종류별 대응을 추정한 값이다(OutdoorGearLab: 위 행 45mm대, 아래 행 20mm대).

#### row 1

| id           | 종류                | 깊이 | 손가락 | 신뢰도         |
|--------------|---------------------|------|--------|----------------|
| bm1000-r1-01 | small 4 finger edge | 10mm | 4      | photo-estimate |
| bm1000-r1-02 | jug                 | null | 4      | photo-estimate |
| bm1000-r1-03 | jug                 | null | 4      | photo-estimate |
| bm1000-r1-04 | small 4 finger edge | 10mm | 4      | photo-estimate |

#### row 2

| id           | 종류                    | 깊이 | 손가락 | 신뢰도    |
|--------------|-------------------------|------|--------|-----------|
| bm1000-r2-01 | deep 4 finger edge      | 45mm | 4      | community |
| bm1000-r2-02 | deep 2 finger pocket    | 50mm | 2      | community |
| bm1000-r2-03 | deep 3 finger pocket    | 45mm | 3      | community |
| bm1000-r2-04 | very deep 4 finger edge | 50mm | 4      | community |
| bm1000-r2-05 | deep 3 finger pocket    | 45mm | 3      | community |
| bm1000-r2-06 | deep 2 finger pocket    | 50mm | 2      | community |
| bm1000-r2-07 | deep 4 finger edge      | 45mm | 4      | community |

#### row 3

| id           | 종류                   | 깊이 | 손가락 | 신뢰도    |
|--------------|------------------------|------|--------|-----------|
| bm1000-r3-01 | medium 4 finger edge   | 20mm | 4      | community |
| bm1000-r3-02 | medium 2 finger pocket | 25mm | 2      | community |
| bm1000-r3-03 | medium 3 finger pocket | 20mm | 3      | community |
| bm1000-r3-04 | medium 3 finger pocket | 20mm | 3      | community |
| bm1000-r3-05 | medium 2 finger pocket | 25mm | 2      | community |
| bm1000-r3-06 | medium 4 finger edge   | 20mm | 4      | community |

#### row 4

| id           | 종류             | 깊이 | 손가락 | 신뢰도   |
|--------------|------------------|------|--------|----------|
| bm1000-r4-01 | 35 degree sloper | 35도 | -      | retailer |
| bm1000-r4-02 | 20 degree sloper | 20도 | -      | retailer |
| bm1000-r4-03 | 20 degree sloper | 20도 | -      | retailer |
| bm1000-r4-04 | 35 degree sloper | 35도 | -      | retailer |

## Beastmaker 2000
- 정면 홀드 20개(2 / 9 / 9) + 슬로퍼 6개(45/35/20도 각 2) = 26개.
- 리테일러 구성: 45/35/20도 슬로퍼, medium·smaller 3F socket, big/little/incut rungs, big/little/sloping 2F pockets, back 2 pockets, sloping·pad monos. 사진에는 back 2 pocket으로 구분되는 별도 구멍이 확인되지 않았다.
- row 1은 서로 깊이가 다른 3F pocket 2개(비대칭). row 2, 3은 좌우 대칭 9개이며 중앙이 4F edge, 바깥이 4F edge, 사이에 mono와 2F pocket이 있다.
- row 2의 3번과 7번 2F pocket에는 옆 구멍(1손가락)이 있다.
- 깊이는 종류별 후보값만 있고 행·위치 대응 자료가 없어 전부 null이다. 후보는 JSON note에 있다.

#### row 1

| id           | 종류            | 깊이 | 손가락 | 신뢰도         |
|--------------|-----------------|------|--------|----------------|
| bm2000-r1-01 | 3 finger pocket | null | 3      | photo-estimate |
| bm2000-r1-02 | 3 finger pocket | null | 3      | photo-estimate |

#### row 2

| id           | 종류            | 깊이 | 손가락 | 신뢰도         |
|--------------|-----------------|------|--------|----------------|
| bm2000-r2-01 | 4 finger edge   | null | 4      | photo-estimate |
| bm2000-r2-02 | mono            | null | 1      | photo-estimate |
| bm2000-r2-03 | 2 finger pocket | null | 2      | photo-estimate |
| bm2000-r2-04 | 2 finger pocket | null | 2      | photo-estimate |
| bm2000-r2-05 | 4 finger edge   | null | 4      | photo-estimate |
| bm2000-r2-06 | 2 finger pocket | null | 2      | photo-estimate |
| bm2000-r2-07 | 2 finger pocket | null | 2      | photo-estimate |
| bm2000-r2-08 | mono            | null | 1      | photo-estimate |
| bm2000-r2-09 | 4 finger edge   | null | 4      | photo-estimate |

#### row 3

| id           | 종류            | 깊이 | 손가락 | 신뢰도         |
|--------------|-----------------|------|--------|----------------|
| bm2000-r3-01 | 4 finger edge   | null | 4      | photo-estimate |
| bm2000-r3-02 | mono            | null | 1      | photo-estimate |
| bm2000-r3-03 | 2 finger pocket | null | 2      | photo-estimate |
| bm2000-r3-04 | 2 finger pocket | null | 2      | photo-estimate |
| bm2000-r3-05 | 4 finger edge   | null | 4      | photo-estimate |
| bm2000-r3-06 | 2 finger pocket | null | 2      | photo-estimate |
| bm2000-r3-07 | 2 finger pocket | null | 2      | photo-estimate |
| bm2000-r3-08 | mono            | null | 1      | photo-estimate |
| bm2000-r3-09 | 4 finger edge   | null | 4      | photo-estimate |

#### row 4

| id           | 종류             | 깊이 | 손가락 | 신뢰도   |
|--------------|------------------|------|--------|----------|
| bm2000-r4-01 | 45 degree sloper | 45도 | -      | retailer |
| bm2000-r4-02 | 35 degree sloper | 35도 | -      | retailer |
| bm2000-r4-03 | 20 degree sloper | 20도 | -      | retailer |
| bm2000-r4-04 | 20 degree sloper | 20도 | -      | retailer |
| bm2000-r4-05 | 35 degree sloper | 35도 | -      | retailer |
| bm2000-r4-06 | 45 degree sloper | 45도 | -      | retailer |

## 슬로퍼 각도
- 1000: 35도, 20도(리테일러 목록).
- 2000: 45도, 35도, 20도(리테일러). OutdoorGearLab 실측은 42도, 33도, 19도.

## 출처 링크
- https://upandunder.co.uk/beastmaker-beastmaker-1000-series
- https://upandunder.co.uk/beastmaker-beastmaker-2000-series
- https://climbfit.com.au/?p=1643
- https://thehangboard.com/pages/beastmaker-1000-vs-2000
- https://www.outdoorgearlab.com/reviews/climbing/hangboard/beastmaker-1000
- https://www.outdoorgearlab.com/reviews/climbing/hangboard/beastmaker-2000
- https://rockprodigytraining.proboards.com/thread/1075/beastmaker-1000-holds (본문 미열람, 검색 요약)
- https://rupertgatterbauer.com/beastmaker-1000/ (접속 실패, 검색 요약)
- Bananafingers, EpicTV, Rock+Run, Dicks Climbing, madrock, So iLL, beastmaker.co.uk: 403 또는 429로 읽지 못함

## 불확실 항목
### 값이 다른 항목
- 1000 small 4F: Beastmaker 표기 10mm, 독립 측정 14~15mm(OutdoorGearLab, Gatterbauer 검색 요약; Beastmaker가 14mm라고 답했다는 언급 있음).
- 1000 하단 바깥 4F: 포럼(2016) 18mm, 상단 14mm. 본문 미열람, 단일 측정.
- 2000 mono 개수: 사진 4개, OutdoorGearLab 3개 서술.
- 2000 jug 여부: 리테일러는 mouth jug를 나열, OutdoorGearLab은 jug 없음. 사진상 jug 형태 홀드는 없고 row 1은 3F pocket 2개로 보인다.
### 확정하지 못한 항목
- 1000 jug 깊이와 폭.
- 1000 row 2, 3의 개별 깊이(종류별 추정값 사용). The Hangboard 목록의 3F 30mm와 4F 45/50mm는 홀드 대응이 불확실.
- 2000 전체 깊이의 행·위치 대응. 외곽 4F(약 32mm, 약 13mm), 중앙 4F(약 50mm, 약 22mm), 3F(약 38mm, 약 19mm), 2F 4쌍, mono(55mm, 25mm 후보).
- 슬로퍼 면(row 4)의 좌우 배치와 물리적 위치. 사진에 보이지 않아 개수와 각도만 리테일러 목록을 따른다.
- The Hangboard는 경쟁 제품 판매처의 자료이며 측정 방법이 명시되지 않았다.

## 사진 교차검증
- 1000: 행별 4 / 7 / 6 일치. 사진 아래에 보이는 큰 홀드 2개는 보드가 아닌 벽 부착 jug이다.
- 2000: 행별 2 / 9 / 9. 리테일러 구성(모노 포함)과 모순 없음. 슬로퍼 면은 사진에 없음.
