const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'lotto_data.json');
const NAVER_SEARCH_URL = 'https://search.naver.com/search.naver?query=';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildSearchUrl(query) {
  return NAVER_SEARCH_URL + encodeURIComponent(query);
}

function parseArgs(argv) {
  const options = {
    start: null,
    end: 1,
    latestOnly: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--start' && argv[i + 1]) {
      options.start = Number(argv[++i]);
    } else if (arg === '--end' && argv[i + 1]) {
      options.end = Number(argv[++i]);
    } else if (arg === '--latest-only') {
      options.latestOnly = true;
    }
  }

  return options;
}

function normalizeDraw(draw) {
  if (!draw) return null;

  const round = Number(draw.round);
  const date = String(draw.date || '').trim();
  const numbers = Array.isArray(draw.numbers)
    ? draw.numbers.map(Number).sort((a, b) => a - b)
    : [];
  const bonus = Number(draw.bonus);

  if (!Number.isInteger(round) || round < 1) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (numbers.length !== 6) return null;
  if (numbers.some(n => !Number.isInteger(n) || n < 1 || n > 45)) return null;

  const unique = new Set(numbers);
  if (unique.size !== 6) return null;
  if (!Number.isInteger(bonus) || bonus < 1 || bonus > 45) return null;
  if (unique.has(bonus)) return null;

  return { round, date, numbers, bonus };
}

async function extractRoundData(page) {
  return page.evaluate(() => {
    const bodyText = document.body.innerText.replace(/\u200b/g, ' ');
    const compactText = bodyText.replace(/\s+/g, ' ').trim();

    const roundMatch = compactText.match(/(\d+)\s*회차/);
    const dateMatch = compactText.match(/(\d{4})\.\s*(\d{2})\.\s*(\d{2})\./);

    const balls = Array.from(
      document.querySelectorAll('.winning_number .ball, .winning_number .num')
    )
      .map(el => parseInt(el.textContent.trim(), 10))
      .filter(n => Number.isInteger(n) && n >= 1 && n <= 45)
      .slice(0, 6);

    const bonusCandidates = Array.from(
      document.querySelectorAll('.bonus_number .ball, .bonus_number .num')
    )
      .map(el => parseInt(el.textContent.trim(), 10))
      .filter(n => Number.isInteger(n) && n >= 1 && n <= 45);

    const bonus = bonusCandidates.length > 0 ? bonusCandidates[0] : null;
    const round = roundMatch ? parseInt(roundMatch[1], 10) : null;
    const date = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : '';

    return { round, date, numbers: balls, bonus };
  });
}

async function fetchLatestRound(page) {
  await page.goto(buildSearchUrl('로또 당첨번호'), {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });

  const data = normalizeDraw(await extractRoundData(page));
  if (!data) {
    throw new Error('latest round parse failed');
  }

  return data;
}

async function fetchRound(page, round) {
  await page.goto(buildSearchUrl(`${round}회 로또 당첨번호`), {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });

  try {
    await page.waitForSelector('.winning_number .ball, .winning_number .num', {
      timeout: 5000,
    });
  } catch (error) {
    // Fall back to body-text parsing below.
  }

  const raw = await extractRoundData(page);
  const normalized = normalizeDraw(raw);

  if (!normalized) {
    throw new Error(`round ${round} parse failed`);
  }

  if (normalized.round !== round) {
    throw new Error(`round mismatch: expected ${round}, got ${normalized.round}`);
  }

  return normalized;
}

function buildOutput(draws) {
  return {
    lastUpdated: new Date().toISOString().split('T')[0],
    source: 'naver-search',
    totalRounds: draws.length,
    draws,
  };
}

function saveOutput(draws) {
  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(buildOutput(draws), null, 2), 'utf-8');
}

function mergeDraws(existingDraws, newDraws) {
  const map = new Map();

  for (const draw of existingDraws || []) {
    map.set(draw.round, draw);
  }

  for (const draw of newDraws || []) {
    map.set(draw.round, draw);
  }

  return Array.from(map.values()).sort((a, b) => a.round - b.round);
}

function loadExistingDraws() {
  if (!fs.existsSync(OUTPUT_PATH)) {
    return [];
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
    return Array.isArray(parsed.draws) ? parsed.draws : [];
  } catch (error) {
    return [];
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  console.log('Checking latest round from Naver search...\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    const latest = await fetchLatestRound(page);
    console.log(`Latest round: ${latest.round}`);
    console.log(`Latest numbers: ${latest.numbers.join(', ')} + ${latest.bonus}`);
    console.log(`Latest date: ${latest.date}\n`);

    if (options.latestOnly) {
      saveOutput([latest]);
      console.log(`Saved latest draw to ${OUTPUT_PATH}`);
      return;
    }

    const startRound = options.start || latest.round;
    const endRound = options.end || 1;

    if (!Number.isInteger(startRound) || !Number.isInteger(endRound)) {
      throw new Error('start/end must be integers');
    }
    if (startRound < endRound) {
      throw new Error('start must be greater than or equal to end');
    }

    const draws = [];
    let consecutiveFailures = 0;

    console.log(`Fetching rounds ${startRound} down to ${endRound}...\n`);

    for (let round = startRound; round >= endRound; round--) {
      try {
        let draw = null;

        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            draw = await fetchRound(page, round);
            break;
          } catch (error) {
            if (attempt === 3) {
              throw error;
            }

            await page.goto('about:blank');
            await sleep(400 * attempt);
          }
        }

        draws.push(draw);
        consecutiveFailures = 0;

        console.log(
          `  ${draw.round} -> ${draw.numbers.join(', ')} + ${draw.bonus} (${draw.date})`
        );

        if (round % 25 === 0 || round === endRound) {
          const merged = mergeDraws(loadExistingDraws(), draws);
          saveOutput(merged);
          console.log(`  checkpoint saved (${merged.length} draws)`);
        }

        await sleep(150);
      } catch (error) {
        consecutiveFailures++;
        console.log(`  failed round ${round}: ${error.message}`);

        if (consecutiveFailures >= 10) {
          throw new Error('too many consecutive failures while scraping Naver');
        }

        await page.goto('about:blank');
        await sleep(800);
      }
    }

    const merged = mergeDraws(loadExistingDraws(), draws);
    saveOutput(merged);

    console.log(`\nSaved ${merged.length} draws to ${OUTPUT_PATH}`);
    console.log(`Range: ${merged[0].round} ~ ${merged[merged.length - 1].round}`);
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error('\nScrape failed:', error.message);
  process.exitCode = 1;
});
