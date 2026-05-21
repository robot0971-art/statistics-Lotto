# Contabo 배포 가이드

이 프로젝트는 Contabo Ubuntu 서버에서 다음 구조로 운영하는 것이 가장 단순합니다.

- `nginx`가 정적 사이트를 공개
- `npm run update:data`가 최신 로또 회차를 수집
- `cron`이 매주 자동 실행

## 1. 권장 서버 구조

- 프로젝트 경로: `/var/www/lotto`
- 공개 웹서버: `nginx`
- 자동 업데이트 로그: `/var/log/lotto-update.log`

## 2. 서버에 프로젝트 업로드

서버에서 사용할 프로젝트 최종 위치:

```bash
/var/www/lotto
```

예시:

```bash
sudo mkdir -p /var/www/lotto
sudo chown -R $USER:$USER /var/www/lotto
```

그 다음 현재 프로젝트 파일 전체를 서버의 `/var/www/lotto`로 업로드합니다.

## 3. 1회 설치

프로젝트를 업로드한 뒤 서버에서:

```bash
cd /var/www/lotto
sudo bash deploy/contabo/install-contabo.sh
```

이 스크립트는 다음을 처리합니다.

- `nginx` 설치
- `nodejs` 설치
- Puppeteer용 Chromium 의존성 설치
- `npm install`
- nginx 사이트 설정 적용
- 자동 업데이트용 cron 등록

## 4. 자동 업데이트 시점

기본 등록 스케줄:

- 토요일 22:00 1차 시도
- 일요일 09:00 보정 실행

파일:

```bash
deploy/contabo/lotto-update.cron
```

cron은 이 명령을 실행합니다.

```bash
cd /var/www/lotto && /bin/bash deploy/contabo/run-update.sh
```

## 5. 수동 업데이트

필요하면 언제든 직접 실행할 수 있습니다.

```bash
cd /var/www/lotto
npm run update:data
```

## 6. 로그 확인

```bash
tail -f /var/log/lotto-update.log
```

## 7. nginx 설정 파일

기본 설정 파일:

```bash
deploy/contabo/nginx-lotto.conf
```

도메인을 붙일 예정이면 `server_name _;`를 실제 도메인으로 바꾸면 됩니다.

예:

```nginx
server_name lotto.example.com;
```

설정 변경 후:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 8. SSL 적용

도메인이 연결된 뒤 HTTPS를 붙이려면 `certbot`을 사용하는 것이 일반적입니다.

예:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d lotto.example.com
```

## 9. Puppeteer 참고

서버 환경에서 Chromium 위치를 직접 지정해야 할 경우 환경변수로 줄 수 있습니다.

예:

```bash
export CHROMIUM_PATH=/usr/bin/chromium-browser
npm run update:data
```

또는

```bash
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
npm run update:data
```

## 10. 배포 후 점검 순서

1. `http://서버IP` 또는 도메인으로 접속되는지 확인
2. 화면에서 최신 회차가 보이는지 확인
3. `npm run update:data` 수동 실행이 성공하는지 확인
4. `/var/log/lotto-update.log`에 오류가 없는지 확인

## 11. 운영 팁

- `data/lotto_data.json`은 사이트가 바로 읽는 파일이라 업데이트 후 별도 재시작이 필요 없습니다.
- 네이버 검색 DOM이 바뀌면 수집이 실패할 수 있으니 로그 확인은 가끔 해주는 것이 좋습니다.
- 공개 운영 시에는 방화벽에서 `80`, `443` 포트를 열어둬야 합니다.
