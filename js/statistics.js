/**
 * statistics.js - 로또 통계 분석 엔진
 */

class LottoStatistics {
    constructor(draws) {
        this.draws = draws || [];
    }

    setDraws(draws) {
        this.draws = draws;
    }

    /**  번호별 출현 빈도 (1~45) */
    getFrequency(range = 'all') {
        const data = this._getRange(range);
        const freq = {};
        for (let i = 1; i <= 45; i++) freq[i] = 0;
        
        data.forEach(draw => {
            draw.numbers.forEach(n => freq[n]++);
        });
        return freq;
    }

    /** 보너스 포함 출현 빈도 */
    getFrequencyWithBonus(range = 'all') {
        const data = this._getRange(range);
        const freq = {};
        for (let i = 1; i <= 45; i++) freq[i] = 0;
        
        data.forEach(draw => {
            draw.numbers.forEach(n => freq[n]++);
            if (draw.bonus) freq[draw.bonus]++;
        });
        return freq;
    }

    /** 핫 넘버 (출현 빈도 높은 번호) */
    getHotNumbers(count = 7, range = 'all') {
        const freq = this.getFrequency(range);
        return Object.entries(freq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, count)
            .map(([num, cnt]) => ({ number: parseInt(num), count: cnt }));
    }

    /** 콜드 넘버 (출현 빈도 낮은 번호) */
    getColdNumbers(count = 7, range = 'all') {
        const freq = this.getFrequency(range);
        return Object.entries(freq)
            .sort((a, b) => a[1] - b[1])
            .slice(0, count)
            .map(([num, cnt]) => ({ number: parseInt(num), count: cnt }));
    }

    /** 가장 오래 안 나온 번호 */
    getLongestAbsent() {
        const lastAppear = {};
        for (let i = 1; i <= 45; i++) lastAppear[i] = 0;

        this.draws.forEach(draw => {
            draw.numbers.forEach(n => {
                lastAppear[n] = Math.max(lastAppear[n], draw.round);
            });
        });

        const latestRound = this.draws.length > 0 ? 
            Math.max(...this.draws.map(d => d.round)) : 0;

        const absences = Object.entries(lastAppear)
            .map(([num, lastRound]) => ({
                number: parseInt(num),
                absence: latestRound - lastRound
            }))
            .sort((a, b) => b.absence - a.absence);

        return absences;
    }

    /** 홀짝 비율 분포 */
    getOddEvenDistribution(range = 'all') {
        const data = this._getRange(range);
        const dist = {};
        
        data.forEach(draw => {
            const oddCount = draw.numbers.filter(n => n % 2 !== 0).length;
            const evenCount = 6 - oddCount;
            const key = `${oddCount}:${evenCount}`;
            dist[key] = (dist[key] || 0) + 1;
        });

        return Object.entries(dist)
            .map(([ratio, count]) => ({ ratio, count }))
            .sort((a, b) => b.count - a.count);
    }

    /** 고저 번호 분포 (1~22 vs 23~45) */
    getHighLowDistribution(range = 'all') {
        const data = this._getRange(range);
        const dist = {};
        
        data.forEach(draw => {
            const lowCount = draw.numbers.filter(n => n <= 22).length;
            const highCount = 6 - lowCount;
            const key = `${lowCount}:${highCount}`;
            dist[key] = (dist[key] || 0) + 1;
        });

        return Object.entries(dist)
            .map(([ratio, count]) => ({ ratio, count }))
            .sort((a, b) => b.count - a.count);
    }

    /** 번호 합계 분포 */
    getSumDistribution(range = 'all') {
        const data = this._getRange(range);
        const sums = data.map(draw => ({
            round: draw.round,
            sum: draw.numbers.reduce((a, b) => a + b, 0)
        }));

        const sumCounts = {};
        sums.forEach(({ sum }) => {
            // 10 단위 그룹
            const group = Math.floor(sum / 10) * 10;
            const key = `${group}-${group + 9}`;
            sumCounts[key] = (sumCounts[key] || 0) + 1;
        });

        const allSums = sums.map(s => s.sum);
        const avg = allSums.reduce((a, b) => a + b, 0) / allSums.length;
        const min = Math.min(...allSums);
        const max = Math.max(...allSums);

        // 최빈 범위
        const sorted = Object.entries(sumCounts).sort((a, b) => b[1] - a[1]);

        return {
            distribution: sumCounts,
            average: Math.round(avg),
            min,
            max,
            mostCommonRange: sorted[0] ? sorted[0][0] : 'N/A',
            sums: allSums
        };
    }

    /** 연속 번호 출현 빈도 */
    getConsecutiveStats(range = 'all') {
        const data = this._getRange(range);
        const stats = { 0: 0, 1: 0, 2: 0, 3: 0 };
        
        data.forEach(draw => {
            const sorted = [...draw.numbers].sort((a, b) => a - b);
            let maxConsecutive = 0;
            let currentConsecutive = 0;
            
            for (let i = 1; i < sorted.length; i++) {
                if (sorted[i] - sorted[i - 1] === 1) {
                    currentConsecutive++;
                    maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
                } else {
                    currentConsecutive = 0;
                }
            }

            const key = Math.min(maxConsecutive, 3);
            stats[key]++;
        });

        return [
            { label: '연속 없음', count: stats[0] },
            { label: '2연속 있음', count: stats[1] },
            { label: '3연속 있음', count: stats[2] },
            { label: '4연속 이상', count: stats[3] },
        ];
    }

    /** 끝자리 분포 */
    getEndingDigitDistribution(range = 'all') {
        const data = this._getRange(range);
        const dist = {};
        for (let i = 0; i <= 9; i++) dist[i] = 0;
        
        data.forEach(draw => {
            draw.numbers.forEach(n => {
                dist[n % 10]++;
            });
        });

        return dist;
    }

    /** 동반 출현 번호 쌍 */
    getPairFrequency(topN = 10, range = 'all') {
        const data = this._getRange(range);
        const pairs = {};

        data.forEach(draw => {
            const nums = draw.numbers;
            for (let i = 0; i < nums.length; i++) {
                for (let j = i + 1; j < nums.length; j++) {
                    const key = `${Math.min(nums[i], nums[j])}-${Math.max(nums[i], nums[j])}`;
                    pairs[key] = (pairs[key] || 0) + 1;
                }
            }
        });

        return Object.entries(pairs)
            .sort((a, b) => b[1] - a[1])
            .slice(0, topN)
            .map(([pair, count]) => {
                const [a, b] = pair.split('-').map(Number);
                return { numbers: [a, b], count };
            });
    }

    /** 특정 번호 조합 분석 */
    analyzeNumbers(selectedNumbers) {
        const sorted = [...selectedNumbers].sort((a, b) => a - b);
        const oddCount = sorted.filter(n => n % 2 !== 0).length;
        const evenCount = 6 - oddCount;
        const lowCount = sorted.filter(n => n <= 22).length;
        const highCount = 6 - lowCount;
        const sum = sorted.reduce((a, b) => a + b, 0);

        // 연속 번호 체크
        let consecutivePairs = 0;
        for (let i = 1; i < sorted.length; i++) {
            if (sorted[i] - sorted[i - 1] === 1) consecutivePairs++;
        }

        // 끝자리 겹침
        const endings = sorted.map(n => n % 10);
        const endingSet = new Set(endings);
        const uniqueEndings = endingSet.size;

        // 통계적 기대값과 비교
        const sumStats = this.getSumDistribution();
        const oddEvenStats = this.getOddEvenDistribution();
        const topOddEven = oddEvenStats[0];

        // 과거 매칭
        const matchResults = this._findMatches(sorted);

        return {
            numbers: sorted,
            oddEven: `${oddCount}:${evenCount}`,
            highLow: `${lowCount}:${highCount}`,
            sum,
            sumAverage: sumStats.average,
            consecutivePairs,
            uniqueEndings,
            topOddEvenRatio: topOddEven ? topOddEven.ratio : 'N/A',
            sumInRange: sum >= sumStats.average - 30 && sum <= sumStats.average + 30,
            matchResults
        };
    }

    /** 과거 당첨 번호와 매칭 */
    _findMatches(selectedNumbers) {
        const matches = [];
        
        this.draws.forEach(draw => {
            const matched = selectedNumbers.filter(n => draw.numbers.includes(n));
            if (matched.length >= 3) {
                matches.push({
                    round: draw.round,
                    date: draw.date,
                    numbers: draw.numbers,
                    bonus: draw.bonus,
                    matchedNumbers: matched,
                    matchCount: matched.length,
                    bonusMatched: selectedNumbers.includes(draw.bonus)
                });
            }
        });

        return matches.sort((a, b) => b.matchCount - a.matchCount || b.round - a.round);
    }

    /** 범위 필터링 (최근 N회) */
    _getRange(range) {
        if (range === 'all') return this.draws;
        const n = parseInt(range);
        if (isNaN(n)) return this.draws;
        return this.draws.slice(-n);
    }
}

// Export for use in other files
window.LottoStatistics = LottoStatistics;
