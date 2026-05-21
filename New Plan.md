# 로또 마스터 프로젝트 개선 계획

## 프로젝트 개요

**로또 마스터** - 통계 기반 로또 6/45 번호 생성 및 분석 웹 애플리케이션

### 기술 스택
- 프론트엔드: HTML, CSS, JavaScript (Vanilla)
- 외부 의존성 없음 (순수 JS)

### 주요 기능
1. **대시보드** - 최신 당첨번호, 핵심 통계, 출현 빈도 차트
2. **번호 생성기** - 5가지 알고리즘 (균형조합, 고빈도, 저빈도, 트렌드, 랜덤)
3. **상세 통계** - 번호별 빈도, 홀짝/고저 분포, 합계 분포, 연속번호 등
4. **번호 분석기** - 특정 조합의 과거 매칭 결과 확인

---

## 개선 사항 분석

### 1. 데이터 문제

| 문제 | 해결방안 |
|------|----------|
| `lotto_data.json` 비어있음 | Node.js 스크립트 실행하여 실제 데이터 수집 |
| 샘플 데이터가 랜덤 생성 (1218회 중 대부분 가짜) | 실제 API 데이터 또는 정적 JSON 파일 사용 |
| CORS 프록시 의존 (`corsproxy.io`) | 백엔드 프록시 서버 구축 또는 서버사이드 데이터 수집 |

### 2. 성능/아키텍처

| 문제 | 해결방안 |
|------|----------|
| `app.js` 852줄 (단일 파일 과대) | 기능별 분리 (data-loader.js, ui-manager.js 등) |
| Canvas 차트 직접 구현 (389줄) | Chart.js CDN 도입 → 유지보수 용이, 기능 확장 쉬움 |
| localStorage 용량 제한 (~5MB) | IndexedDB 도입 또는 데이터 분할 저장 |

### 3. 안정성

| 문제 | 해결방안 |
|------|----------|
| API 호출 실패시 fallback이 랜덤 데이터 | 실제 역대 데이터를 정적 파일로 번들 |
| `AbortSignal.timeout(8000)` - 실패시 8초 대기 | 타임아웃 단축 + 재시도 로직 개선 |
| `generator.js` 최대 1000회 시도시 무한루프 가능성 | 시도 횟수 제한 + 명시적 에러 처리 |

### 4. 기능 확장

| 추가 가능 | 설명 |
|-----------|------|
| PWA 지원 | manifest.json, Service Worker → 오프라인 사용 |
| 번호 저장/관리 | 생성된 번호 localStorage에 저장, 이력 확인 |
| QR 코드 생성 | 로또 QR 코드로 실제 구매 가능 |
| 모바일 앱 | React Native 또는 Flutter 포팅 |

### 5. 코드 퀄리티

| 문제 | 해결방안 |
|------|----------|
| ES5 클래스 패턴 | ES6+ 모듈 시스템 (import/export) 도입 |
| 전역 변수 (`window.LottoStatistics`) | 모듈 번들러 (Vite/Webpack) 사용 |
| 에러 처리 미흡 | try-catch + 사용자 알림 UI 개선 |

---

## 파일 구조

```
Project/
├── index.html          # 메인 HTML
├── index.css           # 스일시트 (31,913 bytes)
├── app.js              # 메인 앱 로직 (32,962 bytes, 852 lines)
├── js/
│   ├── statistics.js   # 통계 계산 로직 (293 lines)
│   ├── charts.js       # 차트 렌더링 (389 lines)
│   ├── generator.js    # 번호 생성 알고리즘 (206 lines)
│   └── animation.js    # 로또볼 애니메이션 (164 lines)
├── scripts/
│   └── fetch_data.js   # 동행복권 API 데이터 수집 스크립트 (150 lines)
└── data/
    └── lotto_data.json # 당첨번호 데이터 (현재 비어있음)
```

---

## 작업 계획

### 즉시 (Immediate)

1. **실제 로또 데이터 수집**
   - `node scripts/fetch_data.js` 실행
   - 동행복권 API에서 역대 당첨번호 수집
   - `data/lotto_data.json`에 저장

### 단기 (Short-term)

2. **코드 분리 및 모듈화**
   - `app.js`를 기능별로 분리:
     - `data-loader.js` - 데이터 로딩/캐싱
     - `ui-manager.js` - UI 상태 관리
     - `event-handler.js` - 이벤트 처리
   - ES6 모듈 시스템 (import/export) 도입

3. **Chart.js 도입**
   - CDN 또는 npm 설치
   - `charts.js` 리팩토링
   - 유지보수성 및 확장성 향상

4. **에러 처리 개선**
   - 모든 API 호출에 try-catch 추가
   - 사용자 알림 UI (toast/snackbar)
   - 네트워크 오류시 명확한 메시지

### 중기 (Mid-term)

5. **백엔드 프록시 서버**
   - Express.js 또는 Fastify로 간단한 서버 구축
   - `/api/lotto` 엔드포인트
   - 정기적 데이터 업데이트 (cron job)

6. **PWA 지원**
   - `manifest.json` 생성
   - Service Worker로 오프라인 지원
   - 앱 설치 가능

7. **모듈 번들러 도입**
   - Vite 또는 Webpack 설정
   - 개발 환경 구축 (HMR, dev server)
   - 빌드 프로세스 자동화

### 장기 (Long-term)

8. **모바일 앱**
   - React Native 또는 Flutter 포팅
   - 앱스토어 배포

9. **추가 기능**
   - QR 코드 생성 (실제 로또 구매)
   - 번호 저장/관리 (이력 확인)
   - 당첨 확인 (구매 번호 vs 당첨 번호)

---

## 우선순위

| 순위 | 작업 | 예상 소요시간 | 중요도 |
|------|------|---------------|--------|
| 1 | 데이터 수집 | 10분 | ★★★★★ |
| 2 | 코드 분리 | 1-2시간 | ★★★★☆ |
| 3 | Chart.js 도입 | 30분 | ★★★☆☆ |
| 4 | 에러 처리 | 1시간 | ★★★★☆ |
| 5 | 백엔드 서버 | 2-3시간 | ★★★☆☆ |
| 6 | PWA 지원 | 1시간 | ★★☆☆☆ |
| 7 | 모듈 번들러 | 2시간 | ★★★☆☆ |

---

## 참고 자료

- 동행복권 API: `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=`
- Chart.js: `https://www.chartjs.org/`
- Vite: `https://vitejs.dev/`
- PWA Manifest: `https://developer.mozilla.org/en-US/docs/Web/Manifest`