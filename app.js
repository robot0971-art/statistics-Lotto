/**
 * app.js - Lotto Master main application
 */

(function () {
    'use strict';

    // ============================
    // Data Layer
    // ============================

    const STORAGE_KEY = 'lotto_master_data';
    const DATA_FILE = 'data/lotto_data.json';

    let allDraws = [];
    let stats = null;
    let charts = null;
    let generator = null;
    let animation = null;

    // App state
    let selectedAlgorithm = 'balanced';
    let gameCount = 1;
    let includeNumbers = [];
    let excludeNumbers = [];
    let analyzerSelected = [];
    let currentRange = 'all';
    let lastGeneratedResults = [];

    // ============================
    // Data Fetching
    // ============================

    async function loadData() {
        updateLoadingStatus('데이터 파일 확인 중...');
        setLoadingProgress(10);

        try {
            updateLoadingStatus('로또 데이터 로드 중...');
            const res = await fetch(DATA_FILE, {
                cache: 'no-store',
                signal: AbortSignal.timeout(15000),
            });

            if (!res.ok) {
                throw new Error(`data file request failed (${res.status})`);
            }

            const data = await res.json();
            allDraws = validateDrawData(data);
            saveToLocalStorage();

            updateLoadingStatus(`데이터 로드 완료 (${allDraws.length}회차)`);
            setLoadingProgress(90);
        } catch (primaryError) {
            const cachedDraws = loadCachedData();
            if (cachedDraws.length > 0) {
                allDraws = cachedDraws;
                updateLoadingStatus(`캐시 데이터로 복구 완료 (${allDraws.length}회차)`);
                setLoadingProgress(90);
            } else {
                throw primaryError;
            }
        }

        setLoadingProgress(100);
        updateLoadingStatus('완료!');
    }

    function saveToLocalStorage() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                lastUpdated: new Date().toISOString(),
                draws: allDraws,
            }));
        } catch (e) {
            console.warn('localStorage save failed:', e);
        }
    }

    function loadCachedData() {
        try {
            const cached = localStorage.getItem(STORAGE_KEY);
            if (!cached) return [];

            const parsed = JSON.parse(cached);
            return validateDrawData(parsed);
        } catch (e) {
            return [];
        }
    }

    function validateDrawData(payload) {
        if (!payload || !Array.isArray(payload.draws) || payload.draws.length === 0) {
            throw new Error('draw dataset is empty');
        }

        const seenRounds = new Set();
        const draws = payload.draws.map((draw, index) => validateDraw(draw, index, seenRounds));

        for (let i = 0; i < draws.length; i++) {
            if (draws[i].round !== i + 1) {
                throw new Error(`missing or out-of-order round near ${i + 1}`);
            }
        }

        if (payload.totalRounds && payload.totalRounds !== draws.length) {
            throw new Error('totalRounds does not match draws length');
        }

        return draws;
    }

    function validateDraw(draw, index, seenRounds) {
        if (!draw || typeof draw !== 'object') {
            throw new Error(`invalid draw entry at index ${index}`);
        }

        const round = Number(draw.round);
        const date = String(draw.date || '').trim();
        const numbers = Array.isArray(draw.numbers)
            ? draw.numbers.map(Number).sort((a, b) => a - b)
            : [];
        const bonus = Number(draw.bonus);

        if (!Number.isInteger(round) || round < 1) {
            throw new Error(`invalid round at index ${index}`);
        }
        if (seenRounds.has(round)) {
            throw new Error(`duplicate round ${round}`);
        }
        seenRounds.add(round);

        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            throw new Error(`invalid date for round ${round}`);
        }
        if (numbers.length !== 6) {
            throw new Error(`invalid number count for round ${round}`);
        }

        const uniqueNumbers = new Set(numbers);
        if (uniqueNumbers.size !== 6) {
            throw new Error(`duplicate numbers in round ${round}`);
        }
        if (numbers.some(n => !Number.isInteger(n) || n < 1 || n > 45)) {
            throw new Error(`out-of-range numbers in round ${round}`);
        }
        if (!Number.isInteger(bonus) || bonus < 1 || bonus > 45 || uniqueNumbers.has(bonus)) {
            throw new Error(`invalid bonus number in round ${round}`);
        }

        return { round, date, numbers, bonus };
    }

    // ============================
    // UI Helpers
    // ============================

    function updateLoadingStatus(text) {
        const el = document.getElementById('loading-status');
        if (el) el.textContent = text;
    }

    function setLoadingProgress(pct) {
        const el = document.getElementById('loading-progress');
        if (el) el.style.width = pct + '%';
    }

    function showLoadingError(message) {
        const textEl = document.querySelector('.loading-text');
        if (textEl) textEl.textContent = '데이터를 불러오지 못했습니다.';

        updateLoadingStatus(message);
        setLoadingProgress(100);
    }

    function hideLoading() {
        const el = document.getElementById('loading-screen');
        if (el) el.classList.add('hidden');
    }

    function sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    function getBallClass(num) {
        if (num <= 10) return 'ball-1-10';
        if (num <= 20) return 'ball-11-20';
        if (num <= 30) return 'ball-21-30';
        if (num <= 40) return 'ball-31-40';
        return 'ball-41-45';
    }

    function createBallHTML(num, options = {}) {
        const { className = 'lotto-ball', bonus = false, delay = 0, matched = false } = options;
        const cls = `${className} ${getBallClass(num)} ${bonus ? 'bonus' : ''} ${matched ? 'matched' : ''}`;
        const style = delay > 0 ? `animation-delay:${delay}ms` : '';
        return `<div class="${cls.trim()}" style="${style}">${num}</div>`;
    }

    function formatGeneratedResults(results) {
        return results.map((nums, index) =>
            `게임 ${index + 1}: ${nums.map(n => String(n).padStart(2, '0')).join(', ')}`
        ).join('\n');
    }

    function setResultActionMessage(message) {
        const el = document.getElementById('result-action-message');
        if (!el) return;

        el.textContent = message;
        window.clearTimeout(setResultActionMessage.timer);
        setResultActionMessage.timer = window.setTimeout(() => {
            el.textContent = '';
        }, 2200);
    }

    async function copyText(text) {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return;
        }

        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }

    async function copyGeneratedResults() {
        if (lastGeneratedResults.length === 0) return;

        try {
            await copyText(formatGeneratedResults(lastGeneratedResults));
            setResultActionMessage('생성된 번호를 복사했습니다.');
        } catch (error) {
            setResultActionMessage('복사에 실패했습니다. 번호를 직접 선택해 주세요.');
        }
    }

    async function shareGeneratedResults() {
        if (lastGeneratedResults.length === 0) return;

        const text = formatGeneratedResults(lastGeneratedResults);
        if (navigator.share) {
            try {
                await navigator.share({
                    title: '로또 생성 번호',
                    text,
                });
                setResultActionMessage('공유를 열었습니다.');
                return;
            } catch (error) {
                if (error && error.name === 'AbortError') return;
            }
        }

        try {
            await copyText(text);
            setResultActionMessage('공유를 지원하지 않아 번호를 복사했습니다.');
        } catch (error) {
            setResultActionMessage('공유에 실패했습니다. 번호를 직접 선택해 주세요.');
        }
    }

    // ============================
    // Tab Navigation
    // ============================

    function initNavigation() {
        const navBtns = document.querySelectorAll('.nav-btn');
        const tabs = document.querySelectorAll('.tab-content');
        const mobileBtn = document.getElementById('mobile-menu-btn');
        const nav = document.getElementById('main-nav');
        const overlay = document.getElementById('mobile-nav-overlay');

        navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.tab;

                navBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                tabs.forEach(t => {
                    t.classList.remove('active');
                    if (t.id === 'tab-' + target) t.classList.add('active');
                });

                // Close mobile nav
                nav.classList.remove('mobile-open');
                overlay.classList.remove('active');

                // Render tab content if needed
                if (target === 'statistics') renderStatisticsTab();
                if (target === 'analyzer') initAnalyzerTab();

                // Scroll to top
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });

        // More buttons
        document.querySelectorAll('[data-goto]').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.goto;
                const navBtn = document.querySelector(`[data-tab="${target}"]`);
                if (navBtn) navBtn.click();
            });
        });

        // Mobile menu
        if (mobileBtn) {
            mobileBtn.addEventListener('click', () => {
                nav.classList.toggle('mobile-open');
                overlay.classList.toggle('active');
            });
        }

        if (overlay) {
            overlay.addEventListener('click', () => {
                nav.classList.remove('mobile-open');
                overlay.classList.remove('active');
            });
        }
    }


    // ============================
    // Dashboard Rendering
    // ============================

    function renderDashboard() {
        if (!stats || allDraws.length === 0) return;

        document.getElementById('hero-total-rounds').textContent = allDraws.length;

        const latest = allDraws[allDraws.length - 1];
        document.getElementById('latest-round-badge').textContent = `${latest.round}회`;
        document.getElementById('latest-date').textContent = formatDate(latest.date);

        const numbersEl = document.getElementById('latest-numbers');
        let html = latest.numbers.map((n, i) =>
            createBallHTML(n, { delay: i * 100 })
        ).join('');
        html += `<span class="ball-separator">+</span>`;
        html += createBallHTML(latest.bonus, { bonus: true, delay: 700 });
        numbersEl.innerHTML = html;

        const hotNums = stats.getHotNumbers(1);
        const coldNums = stats.getColdNumbers(1);
        const recentHot = stats.getHotNumbers(1, 10);
        const absent = stats.getLongestAbsent();

        if (hotNums[0]) {
            document.getElementById('stat-hottest').textContent = hotNums[0].number;
            document.getElementById('stat-hottest-count').textContent = `${hotNums[0].count}회 출현`;
        }
        if (coldNums[0]) {
            document.getElementById('stat-coldest').textContent = coldNums[0].number;
            document.getElementById('stat-coldest-count').textContent = `${coldNums[0].count}회 출현`;
        }
        if (recentHot[0]) {
            document.getElementById('stat-recent-hot').textContent = recentHot[0].number;
            document.getElementById('stat-recent-hot-count').textContent = `${recentHot[0].count}회 출현`;
        }
        if (absent[0]) {
            document.getElementById('stat-longest-absent').textContent = absent[0].number;
            document.getElementById('stat-longest-absent-count').textContent = `${absent[0].absence}회 연속 미출현`;
        }

        const freq = stats.getFrequency();
        charts.drawFrequencyChart('mini-frequency-chart', freq, { mini: true });
        renderHotColdNumbers();

        document.getElementById('footer-data-range').textContent =
            `${allDraws[0].round}회 ~ ${latest.round}회 (${allDraws.length}회차)`;
        document.getElementById('footer-last-update').textContent = formatDate(latest.date);

        document.getElementById('hero-generate-btn').addEventListener('click', () => {
            document.querySelector('[data-tab="generator"]').click();
        });
    }

    function renderHotColdNumbers() {
        const hotNums = stats.getHotNumbers(7, 20);
        const coldNums = stats.getColdNumbers(7, 20);

        const hotEl = document.getElementById('hot-numbers');
        const coldEl = document.getElementById('cold-numbers');

        hotEl.innerHTML = hotNums.map(({ number, count }) =>
            `<div class="hot-cold-item">
                ${createBallHTML(number, { className: 'hot-cold-ball' })}
                <span class="hot-cold-count">${count}</span>
            </div>`
        ).join('');

        coldEl.innerHTML = coldNums.map(({ number, count }) =>
            `<div class="hot-cold-item">
                ${createBallHTML(number, { className: 'hot-cold-ball' })}
                <span class="hot-cold-count">${count}</span>
            </div>`
        ).join('');
    }

    function formatDate(dateStr) {
        if (!dateStr) return '---- -- --';
        const parts = dateStr.split('-');
        return `${parts[0]}-${parts[1]}-${parts[2]}`;
    }

    // ============================
    // Generator Tab
    // ============================

    function initGeneratorTab() {
        document.querySelectorAll('.algo-card').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.algo-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                selectedAlgorithm = card.dataset.algo;
            });
        });

        document.querySelectorAll('.count-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                gameCount = parseInt(btn.dataset.count, 10);
            });
        });

        renderNumberSelectors();
        document.getElementById('generate-btn').addEventListener('click', handleGenerate);
    }


    function renderNumberSelectors() {
        const includeEl = document.getElementById('include-numbers');
        const excludeEl = document.getElementById('exclude-numbers');

        let includeHTML = '';
        let excludeHTML = '';

        for (let i = 1; i <= 45; i++) {
            includeHTML += `<button class="num-select-btn" data-num="${i}" data-type="include">${i}</button>`;
            excludeHTML += `<button class="num-select-btn" data-num="${i}" data-type="exclude">${i}</button>`;
        }

        includeEl.innerHTML = includeHTML;
        excludeEl.innerHTML = excludeHTML;

        // Event listeners
        includeEl.querySelectorAll('.num-select-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const num = parseInt(btn.dataset.num);
                if (excludeNumbers.includes(num)) return;

                if (includeNumbers.includes(num)) {
                    includeNumbers = includeNumbers.filter(n => n !== num);
                    btn.classList.remove('selected');
                } else {
                    if (includeNumbers.length >= 5) return; // Max 5
                    includeNumbers.push(num);
                    btn.classList.add('selected');
                }
            });
        });

        excludeEl.querySelectorAll('.num-select-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const num = parseInt(btn.dataset.num);
                if (includeNumbers.includes(num)) return;

                if (excludeNumbers.includes(num)) {
                    excludeNumbers = excludeNumbers.filter(n => n !== num);
                    btn.classList.remove('disabled-exclude');
                } else {
                    if (45 - excludeNumbers.length <= 6) return;
                    excludeNumbers.push(num);
                    btn.classList.add('disabled-exclude');
                }
            });
        });
    }

    async function handleGenerate() {
        const btn = document.getElementById('generate-btn');
        btn.disabled = true;

        const results = generator.generate(selectedAlgorithm, {
            includeNums: includeNumbers,
            excludeNums: excludeNumbers,
            gameCount: gameCount,
        });

        // Animate first result
        if (results.length > 0) {
            await animation.animateDraw(results[0], 'machine-balls', () => {
                renderGeneratedResults(results);
                btn.disabled = false;
            });
        } else {
            btn.disabled = false;
        }
    }

    function renderGeneratedResults(results) {
        const container = document.getElementById('generated-results');
        lastGeneratedResults = results.map(nums => [...nums]);
        const algoNames = {
            balanced: '균형 조합',
            hot: '고빈도 기반',
            cold: '저빈도 기반',
            trend: '최근 트렌드',
            random: '완전 랜덤'
        };

        container.innerHTML = `
            <div class="result-actions">
                <div class="result-actions-text">
                    <span class="result-actions-title">생성된 번호</span>
                    <span class="result-actions-subtitle">${results.length}게임 전체를 복사하거나 공유할 수 있습니다.</span>
                </div>
                <div class="result-actions-buttons">
                    <button class="result-action-btn" type="button" id="copy-results-btn">복사</button>
                    <button class="result-action-btn primary" type="button" id="share-results-btn">공유</button>
                </div>
            </div>
            <div class="result-action-message" id="result-action-message" aria-live="polite"></div>
            ${results.map((nums, i) =>
                `<div class="result-game" style="animation-delay:${i * 100}ms">
                <div class="result-game-header">
                    <span class="result-game-label">게임 ${i + 1}</span>
                    <span class="result-game-algo">${algoNames[selectedAlgorithm] || selectedAlgorithm}</span>
                </div>
                <div class="result-numbers">
                    ${nums.map(n => createBallHTML(n, { className: 'result-ball' })).join('')}
                </div>
            </div>`
            ).join('')}
        `;

        document.getElementById('copy-results-btn').addEventListener('click', copyGeneratedResults);
        document.getElementById('share-results-btn').addEventListener('click', shareGeneratedResults);

        container.style.display = 'block';
    }

    // ============================
    // Statistics Tab
    // ============================

    let statisticsRendered = false;

    function renderStatisticsTab() {
        if (!stats) return;

        // Range selector
        document.querySelectorAll('.range-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentRange = btn.dataset.range;
                renderAllCharts();
            });
        });

        if (!statisticsRendered) {
            renderAllCharts();
            statisticsRendered = true;
        }
    }

    function renderAllCharts() {
        // Frequency chart
        const freq = stats.getFrequency(currentRange);
        charts.drawFrequencyChart('full-frequency-chart', freq);

        // Odd/Even donut
        const oddEven = stats.getOddEvenDistribution(currentRange);
        const oeColors = charts.drawDonutChart('odd-even-chart', oddEven);
        renderLegend('odd-even-legend', oeColors);

        // High/Low donut
        const highLow = stats.getHighLowDistribution(currentRange);
        const hlColors = charts.drawDonutChart('high-low-chart', highLow);
        renderLegend('high-low-legend', hlColors);

        // Sum distribution
        const sumData = stats.getSumDistribution(currentRange);
        charts.drawHistogram('sum-chart', sumData.sums);
        document.getElementById('sum-stats').innerHTML = `
            <div class="sum-stat-item">
                <div class="sum-stat-value">${sumData.average}</div>
                <div>평균 합계</div>
            </div>
            <div class="sum-stat-item">
                <div class="sum-stat-value">${sumData.min}</div>
                <div>최소</div>
            </div>
            <div class="sum-stat-item">
                <div class="sum-stat-value">${sumData.max}</div>
                <div>최대</div>
            </div>
            <div class="sum-stat-item">
                <div class="sum-stat-value">${sumData.mostCommonRange}</div>
                <div>최빈 범위</div>
            </div>
        `;

        // Consecutive
        const consec = stats.getConsecutiveStats(currentRange);
        charts.drawHorizontalBarChart('consecutive-chart', consec, { labelWidth: 100 });

        // Ending digit
        const ending = stats.getEndingDigitDistribution(currentRange);
        charts.drawEndingDigitChart('ending-digit-chart', ending);

        // Pair frequency
        const pairs = stats.getPairFrequency(10, currentRange);
        renderPairTable(pairs);
    }

    function renderLegend(containerId, items) {
        const el = document.getElementById(containerId);
        if (!el || !items) return;

        el.innerHTML = items.map(item =>
            `<div class="legend-item">
                <div class="legend-dot" style="background:${item.color}"></div>
                <span>${item.label} (${item.count})</span>
            </div>`
        ).join('');
    }

    function renderPairTable(pairs) {
        const el = document.getElementById('pair-table');
        if (!el || pairs.length === 0) return;

        const maxCount = pairs[0].count;

        el.innerHTML = pairs.map((pair, i) =>
            `<div class="pair-row">
                <span class="pair-rank">#${i + 1}</span>
                <div class="pair-balls">
                    ${pair.numbers.map(n =>
                        `<div class="pair-ball ${getBallClass(n)}">${n}</div>`
                    ).join('')}
                </div>
                <div class="pair-bar-container">
                    <div class="pair-bar" style="width:${(pair.count / maxCount) * 100}%"></div>
                </div>
                <span class="pair-count">${pair.count}</span>
            </div>`
        ).join('');
    }

    // ============================
    // Analyzer Tab
    // ============================

    let analyzerInitialized = false;

    function initAnalyzerTab() {
        if (analyzerInitialized) return;
        analyzerInitialized = true;

        const grid = document.getElementById('analyzer-number-grid');
        let html = '';
        for (let i = 1; i <= 45; i++) {
            html += `<button class="analyzer-num-btn ${getBallClass(i)}" data-num="${i}" style="background:transparent">${i}</button>`;
        }
        grid.innerHTML = html;

        grid.querySelectorAll('.analyzer-num-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const num = parseInt(btn.dataset.num);

                if (analyzerSelected.includes(num)) {
                    analyzerSelected = analyzerSelected.filter(n => n !== num);
                    btn.classList.remove('selected');
                    btn.style.background = 'transparent';
                } else {
                    if (analyzerSelected.length >= 6) return;
                    analyzerSelected.push(num);
                    btn.classList.add('selected');
                    btn.style.background = animation.getBallBg(num);
                }

                updateAnalyzerSelection();
            });
        });

        document.getElementById('analyze-btn').addEventListener('click', handleAnalyze);
    }

    function updateAnalyzerSelection() {
        const ballsEl = document.getElementById('analyzer-selected-balls');
        const analyzeBtn = document.getElementById('analyze-btn');

        const sorted = [...analyzerSelected].sort((a, b) => a - b);
        ballsEl.innerHTML = sorted.map(n =>
            createBallHTML(n, { className: 'hot-cold-ball' })
        ).join('');

        analyzeBtn.disabled = analyzerSelected.length !== 6;
    }

    function handleAnalyze() {
        if (analyzerSelected.length !== 6) return;

        const result = stats.analyzeNumbers(analyzerSelected);
        const resultsEl = document.getElementById('analysis-results');
        resultsEl.style.display = 'block';

        // Analysis grid
        document.getElementById('analysis-grid').innerHTML = `
            <div class="analysis-item">
                <div class="analysis-item-label">홀짝 비율</div>
                <div class="analysis-item-value">${result.oddEven}</div>
                <div class="analysis-item-detail">최빈: ${result.topOddEvenRatio}</div>
            </div>
            <div class="analysis-item">
                <div class="analysis-item-label">고저 비율</div>
                <div class="analysis-item-value">${result.highLow}</div>
                <div class="analysis-item-detail">1~22 vs 23~45</div>
            </div>
            <div class="analysis-item">
                <div class="analysis-item-label">번호 합계</div>
                <div class="analysis-item-value">${result.sum}</div>
                <div class="analysis-item-detail">평균 ${result.sumAverage} ${result.sumInRange ? '적정 범위' : '범위 밖'}</div>
            </div>
            <div class="analysis-item">
                <div class="analysis-item-label">연속 번호</div>
                <div class="analysis-item-value">${result.consecutivePairs}</div>
            </div>
            <div class="analysis-item">
                <div class="analysis-item-label">끝자리 다양성</div>
                <div class="analysis-item-value">${result.uniqueEndings}/6</div>
            </div>
            <div class="analysis-item">
                <div class="analysis-item-label">과거 3개 이상 일치</div>
                <div class="analysis-item-value">${result.matchResults.length}</div>
            </div>
        `;

        // Match results
        const matchEl = document.getElementById('match-results');
        if (result.matchResults.length === 0) {
            matchEl.innerHTML = "<p>3개 이상 일치한 과거 회차가 없습니다.</p>";
        } else {
            matchEl.innerHTML = result.matchResults.slice(0, 50).map(match =>
                `<div class="match-row">
                    <span class="match-round">${match.round}회</span>
                    <span class="match-date">${match.date}</span>
                    <div class="match-balls">
                        ${match.numbers.map(n =>
                            createBallHTML(n, {
                                className: 'match-ball',
                                matched: match.matchedNumbers.includes(n)
                            })
                        ).join('')}
                    </div>
                    <span class="match-count match-${Math.min(match.matchCount, 6)}">${match.matchCount}개 일치</span>
                </div>`
            ).join('');
        }

        // Scroll to results
        resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ============================
    // Window Resize
    // ============================

    function handleResize() {
        // Re-render visible charts on resize
        const activeTab = document.querySelector('.tab-content.active');
        if (!activeTab) return;

        if (activeTab.id === 'tab-dashboard') {
            const freq = stats.getFrequency();
            charts.drawFrequencyChart('mini-frequency-chart', freq, { mini: true });
        } else if (activeTab.id === 'tab-statistics' && statisticsRendered) {
            renderAllCharts();
        }
    }

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(handleResize, 300);
    });

    // ============================
    // Initialize App
    // ============================

    async function init() {
        try {
            await loadData();

            stats = new LottoStatistics(allDraws);
            charts = new LottoCharts();
            generator = new LottoGenerator(stats);
            animation = new LottoAnimation();

            initNavigation();
            renderDashboard();
            initGeneratorTab();
            animation.createHeroBalls('hero-bg-balls');

            await sleep(300);
            hideLoading();
        } catch (error) {
            console.error('App initialization failed:', error);
            showLoadingError('유효한 로또 데이터 파일을 찾지 못했습니다.');
        }
    }

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
