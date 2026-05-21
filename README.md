# statistics-Lotto

통계 기반 로또 번호 생성기입니다.  
최신 로또 회차 데이터를 바탕으로 번호 통계, 핫 넘버, 콜드 넘버를 분석하고 추천 번호를 생성할 수 있습니다.

## 주요 기능

- 최신 로또 회차 데이터 표시
- 번호별 출현 빈도 통계
- 핫 넘버 / 콜드 넘버 분석
- 통계 기반 추천 번호 생성
- `data/lotto_data.json` 기반 로컬 실행
- Naver 검색 기반 최신 회차 자동 수집 스크립트 제공
- Contabo 서버 배포용 설정 파일 포함

## 프로젝트 구조

```text
statistics-Lotto/
├─ app.js
├─ index.html
├─ index.css
├─ data/
│  └─ lotto_data.json
├─ js/
├─ scripts/
│  ├─ serve.js
│  └─ update_lotto_data.js
├─ deploy/
│  └─ contabo/
└─ DEPLOY_CONTABO.md
```

## 실행 방법

### 1. 의존성 설치

```bash
npm install
```

### 2. 로컬 실행

```bash
npm start
```

또는 Windows에서는 아래 파일을 더블클릭해서 실행할 수 있습니다.

```text
start-lotto-master.bat
```

브라우저에서 `http://localhost:4173/`로 열리며, `index.html`을 직접 더블클릭하는 방식보다 이 방법을 권장합니다.

## 데이터 업데이트

최신 로또 회차 데이터를 수동으로 갱신하려면:

```bash
npm run update:data
```

이 스크립트는 다음 작업을 수행합니다.

- 현재 `data/lotto_data.json` 확인
- Naver 검색 결과 기준 최신 회차 확인
- 부족한 회차만 추가 수집
- 데이터 무결성 검증
- 갱신 시 백업 파일 생성

## 자동 업데이트 방식

이 프로젝트는 기준 데이터 파일인 `data/lotto_data.json`만 최신 상태로 유지되면,
핫 넘버, 콜드 넘버, 출현 빈도, 최근 미출현 통계 등이 자동으로 다시 계산됩니다.

즉, 별도의 통계 캐시를 따로 수정할 필요는 없습니다.

## 모바일 대응

현재 UI는 반응형 구조로 작성되어 있어 모바일 화면에서도 자동으로 레이아웃이 조정됩니다.

- `viewport` 메타 태그 적용
- `@media` 기반 반응형 CSS 적용
- 모바일 메뉴 전환 지원

## Contabo 서버 배포

Contabo Ubuntu 서버 기준 배포 문서는 아래 파일에 정리되어 있습니다.

[DEPLOY_CONTABO.md](./DEPLOY_CONTABO.md)

배포 구조는 다음과 같습니다.

```text
nginx
→ 정적 사이트 서비스

cron
→ 주간 자동 데이터 업데이트

update_lotto_data.js
→ 최신 회차 수집 및 JSON 갱신
```

## 권장 운영 흐름

1. 사이트는 `nginx`로 공개
2. 매주 토요일 밤 또는 일요일 오전에 `npm run update:data` 실행
3. `data/lotto_data.json` 갱신
4. 사용자는 새로고침만으로 최신 회차와 최신 통계를 확인

## 사용 기술

- HTML
- CSS
- JavaScript
- Node.js
- Puppeteer
- Nginx
- Cron

## 참고 사항

- 데이터 수집은 Naver 검색 결과 DOM 구조에 의존하므로, 구조가 바뀌면 업데이트 스크립트 수정이 필요할 수 있습니다.
- 서버 환경에서는 Chromium 실행 경로를 `CHROMIUM_PATH` 또는 `PUPPETEER_EXECUTABLE_PATH`로 지정할 수 있습니다.
- 로컬 파일(`file://`) 방식으로 열면 JSON 로딩이 차단될 수 있으므로 반드시 로컬 서버 방식으로 실행하는 것이 좋습니다.
