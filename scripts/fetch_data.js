/**
 * 동행복권 로또 6/45 역대 당첨번호 수집 스크립트
 * 사용법: node scripts/fetch_data.js
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const API_URL = 'https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=';
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'lotto_data.json');
const DELAY_MS = 200;

function fetchUrl(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      return reject(new Error('Too many redirects'));
    }

    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://www.dhlottery.co.kr/',
      }
    };

    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, options, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (redirectUrl.startsWith('/')) {
          const urlObj = new URL(url);
          redirectUrl = `${urlObj.protocol}//${urlObj.host}${redirectUrl}`;
        }
        console.log(`  ↪ Redirect to: ${redirectUrl}`);
        return fetchUrl(redirectUrl, maxRedirects - 1).then(resolve).catch(reject);
      }

      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', (e) => {
      reject(new Error(`Fetch error: ${e.message}`));
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🎰 로또 6/45 역대 당첨번호 수집 시작...\n');

  // 먼저 1회차를 테스트
  try {
    const url = API_URL + '1';
    console.log(`🔗 테스트 URL: ${url}`);
    const rawData = await fetchUrl(url);
    console.log(`📄 응답 길이: ${rawData.length}`);
    console.log(`📄 응답 앞부분: ${rawData.substring(0, 200)}`);
    
    const test = JSON.parse(rawData);
    if (test.returnValue === 'success') {
      console.log(`\n✅ API 연결 성공! 1회차: ${test.drwtNo1}, ${test.drwtNo2}, ${test.drwtNo3}, ${test.drwtNo4}, ${test.drwtNo5}, ${test.drwtNo6}\n`);
    } else {
      console.log('❌ API 실패 응답:', JSON.stringify(test));
      return;
    }
  } catch (e) {
    console.error('❌ API 연결 실패:', e.message);
    console.log('\n💡 동행복권 API가 차단 중일 수 있습니다. 수동 데이터를 사용합니다.');
    return;
  }

  await sleep(DELAY_MS);

  const draws = [];
  let consecutiveFailures = 0;

  for (let round = 1; consecutiveFailures < 3; round++) {
    try {
      const rawData = await fetchUrl(API_URL + round);
      const result = JSON.parse(rawData);

      if (result.returnValue === 'fail') {
        consecutiveFailures++;
        if (consecutiveFailures >= 3) {
          break;
        }
        await sleep(DELAY_MS);
        continue;
      }

      consecutiveFailures = 0;

      draws.push({
        round: result.drwNo,
        date: result.drwNoDate,
        numbers: [
          result.drwtNo1,
          result.drwtNo2,
          result.drwtNo3,
          result.drwtNo4,
          result.drwtNo5,
          result.drwtNo6,
        ],
        bonus: result.bnusNo,
      });

      if (round % 100 === 0 || round <= 3) {
        console.log(`  📊 ${round}회차 수집 완료 (${result.drwNoDate})`);
      }

      await sleep(DELAY_MS);
    } catch (error) {
      console.error(`  ⚠️ ${round}회차 오류: ${error.message}`);
      consecutiveFailures++;
      await sleep(DELAY_MS * 3);
    }
  }

  if (draws.length === 0) {
    console.log('❌ 데이터를 수집하지 못했습니다.');
    return;
  }

  // 데이터 저장
  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const output = {
    lastUpdated: new Date().toISOString().split('T')[0],
    totalRounds: draws.length,
    draws: draws,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`\n🎉 총 ${draws.length}회차 데이터 수집 완료!`);
  console.log(`📁 저장 위치: ${OUTPUT_PATH}`);
}

main().catch(console.error);
