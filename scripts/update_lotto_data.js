const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'lotto_data.json');
const BACKUP_PATH = path.join(__dirname, '..', 'data', 'lotto_data.backup.json');
const NAVER_SEARCH_URL = 'https://search.naver.com/search.naver?query=';
const EXECUTABLE_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROMIUM_PATH;

function buildSearchUrl(query) {
  return NAVER_SEARCH_URL + encodeURIComponent(query);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

  const uniqueNumbers = new Set(numbers);
  if (uniqueNumbers.size !== 6) return null;
  if (!Number.isInteger(bonus) || bonus < 1 || bonus > 45) return null;
  if (uniqueNumbers.has(bonus)) return null;

  return { round, date, numbers, bonus };
}

function validateDraws(draws) {
  if (!Array.isArray(draws) || draws.length === 0) {
    throw new Error('draw dataset is empty');
  }

  const sorted = [...draws].sort((a, b) => a.round - b.round);
  const seenRounds = new Set();

  for (let i = 0; i < sorted.length; i++) {
    const draw = normalizeDraw(sorted[i]);
    if (!draw) {
      throw new Error(`invalid draw at index ${i}`);
    }

    if (seenRounds.has(draw.round)) {
      throw new Error(`duplicate round ${draw.round}`);
    }
    seenRounds.add(draw.round);

    if (draw.round !== i + 1) {
      throw new Error(`missing or out-of-order round near ${i + 1}`);
    }

    sorted[i] = draw;
  }

  return sorted;
}

function readExistingData() {
  if (!fs.existsSync(OUTPUT_PATH)) {
    return [];
  }

  const payload = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
  return validateDraws(payload.draws);
}

function writeData(draws) {
  const validated = validateDraws(draws);
  const output = {
    lastUpdated: new Date().toISOString().split('T')[0],
    source: 'naver-search',
    totalRounds: validated.length,
    draws: validated,
  };

  if (fs.existsSync(OUTPUT_PATH)) {
    fs.copyFileSync(OUTPUT_PATH, BACKUP_PATH);
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');
  return output;
}

function mergeDraws(existingDraws, newDraws) {
  const map = new Map();
  for (const draw of existingDraws) map.set(draw.round, draw);
  for (const draw of newDraws) map.set(draw.round, draw);
  return Array.from(map.values()).sort((a, b) => a.round - b.round);
}

async function extractRoundData(page) {
  return page.evaluate(() => {
    const bodyText = document.body.innerText.replace(/\u200b/g, ' ');
    const compactText = bodyText.replace(/\s+/g, ' ').trim();

    const roundMatch = compactText.match(/(\d+)\s*회차/);
    const dateMatch = compactText.match(/(\d{4})\.\s*(\d{2})\.\s*(\d{2})\./);

    const numbers = Array.from(
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

    return {
      round: roundMatch ? parseInt(roundMatch[1], 10) : null,
      date: dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : '',
      numbers,
      bonus: bonusCandidates.length > 0 ? bonusCandidates[0] : null,
    };
  });
}

async function fetchLatestRound(page) {
  await page.goto(buildSearchUrl('로또 당첨번호'), {
    waitUntil: 'networkidle2',
    timeout: 30000,
  });

  const latest = normalizeDraw(await extractRoundData(page));
  if (!latest) {
    throw new Error('failed to parse latest round');
  }

  return latest;
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
    // The parser below also checks body text, so continue and validate.
  }

  const draw = normalizeDraw(await extractRoundData(page));
  if (!draw) {
    throw new Error(`failed to parse round ${round}`);
  }
  if (draw.round !== round) {
    throw new Error(`round mismatch: expected ${round}, got ${draw.round}`);
  }

  return draw;
}

async function fetchRoundWithRetry(page, round) {
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await fetchRound(page, round);
    } catch (error) {
      lastError = error;
      await page.goto('about:blank');
      await sleep(500 * attempt);
    }
  }

  throw lastError;
}

async function main() {
  const existingDraws = readExistingData();
  const currentLatestRound = existingDraws.at(-1).round;

  console.log(`Current data range: 1 ~ ${currentLatestRound}`);

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    const latest = await fetchLatestRound(page);
    console.log(`Latest available round: ${latest.round} (${latest.date})`);

    if (latest.round <= currentLatestRound) {
      console.log('No update needed. Local data is already current.');
      return;
    }

    const newDraws = [];
    for (let round = currentLatestRound + 1; round <= latest.round; round++) {
      const draw = await fetchRoundWithRetry(page, round);
      newDraws.push(draw);
      console.log(`Fetched ${draw.round}: ${draw.numbers.join(', ')} + ${draw.bonus}`);
      await sleep(200);
    }

    const merged = mergeDraws(existingDraws, newDraws);
    const output = writeData(merged);

    console.log(`Updated ${newDraws.length} new draw(s).`);
    console.log(`Saved ${output.totalRounds} total draw(s) to ${OUTPUT_PATH}`);
    console.log(`Backup written to ${BACKUP_PATH}`);
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(`Update failed: ${error.message}`);
  process.exitCode = 1;
});
