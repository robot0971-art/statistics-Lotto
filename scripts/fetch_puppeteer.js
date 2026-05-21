const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'lotto_data.json');

async function fetchLottoData() {
  console.log('🚀 Puppeteer로 로또 데이터 수집 시작...\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  const draws = [];
  let round = 1;
  let consecutiveFailures = 0;

  while (consecutiveFailures < 5) {
    try {
      const url = `https://www.dhlottery.co.kr/gameResult.do?method=byWin&drwNo=${round}`;
      
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      
      // 당첨번호 추출
      const result = await page.evaluate(() => {
        const nums = [];
        const ballElements = document.querySelectorAll('.nums .ball_645');
        
        if (ballElements.length < 6) return null;
        
        for (let i = 0; i < 6; i++) {
          const num = parseInt(ballElements[i].textContent.trim());
          if (num > 0 && num <= 45) nums.push(num);
        }
        
        if (nums.length !== 6) return null;
        
        // 보너스 번호
        const bonusBall = document.querySelector('.bonus .ball_645');
        const bonus = bonusBall ? parseInt(bonusBall.textContent.trim()) : null;
        
        // 날짜
        const dateText = document.querySelector('.win_result_date')?.textContent?.trim() || '';
        const dateMatch = dateText.match(/(\d{4})\.\s*(\d{2})\.\s*(\d{2})/);
        const date = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : '';
        
        return { nums, bonus, date };
      });

      if (!result || !result.bonus) {
        consecutiveFailures++;
        console.log(`  ⚠️ ${round}회차 데이터 없음 (연속 실패: ${consecutiveFailures})`);
        round++;
        continue;
      }

      consecutiveFailures = 0;

      draws.push({
        round: round,
        date: result.date,
        numbers: result.nums.sort((a, b) => a - b),
        bonus: result.bonus
      });

      if (round % 50 === 0 || round <= 3) {
        console.log(`  ✅ ${round}회차: ${result.nums.join(', ')} + ${result.bonus} (${result.date})`);
      }

      round++;
    } catch (error) {
      consecutiveFailures++;
      console.log(`  ❌ ${round}회차 오류: ${error.message}`);
      round++;
    }
  }

  await browser.close();

  if (draws.length === 0) {
    console.log('\n❌ 데이터 수집 실패');
    return;
  }

  // 저장
  draws.sort((a, b) => a.round - b.round);
  
  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const output = {
    lastUpdated: new Date().toISOString().split('T')[0],
    totalRounds: draws.length,
    draws: draws
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');
  
  console.log(`\n🎉 총 ${draws.length}회차 데이터 수집 완료!`);
  console.log(`📁 저장: ${OUTPUT_PATH}`);
  console.log(`📅 범위: ${draws[0].round}회 ~ ${draws[draws.length-1].round}회`);
}

fetchLottoData().catch(console.error);