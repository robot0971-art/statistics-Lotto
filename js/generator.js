/**
 * generator.js - 로또 번호 생성 알고리즘
 */

class LottoGenerator {
    constructor(statistics) {
        this.stats = statistics;
    }

    /**
     * 번호 생성 (알고리즘 + 필터)
     */
    generate(algorithm = 'balanced', options = {}) {
        const { includeNums = [], excludeNums = [], gameCount = 1 } = options;
        const results = [];

        for (let i = 0; i < gameCount; i++) {
            let numbers;
            let attempts = 0;
            const maxAttempts = 1000;

            do {
                switch (algorithm) {
                    case 'balanced':
                        numbers = this._balancedGenerate(includeNums, excludeNums);
                        break;
                    case 'hot':
                        numbers = this._hotGenerate(includeNums, excludeNums);
                        break;
                    case 'cold':
                        numbers = this._coldGenerate(includeNums, excludeNums);
                        break;
                    case 'trend':
                        numbers = this._trendGenerate(includeNums, excludeNums);
                        break;
                    case 'random':
                    default:
                        numbers = this._randomGenerate(includeNums, excludeNums);
                        break;
                }
                attempts++;
            } while (
                attempts < maxAttempts &&
                results.some(r => this._sameSet(r, numbers))
            );

            results.push(numbers.sort((a, b) => a - b));
        }

        return results;
    }

    /** 균형 조합 - 홀짝, 고저, 합계 최적화 */
    _balancedGenerate(includeNums, excludeNums) {
        const freq = this.stats.getFrequency();
        const available = this._getAvailable(excludeNums);
        
        // 통계적으로 가장 빈번한 패턴:
        // 홀짝: 3:3 또는 4:2 
        // 고저: 3:3 또는 2:4
        // 합계: 100~175 범위
        
        const targetOdd = Math.random() < 0.5 ? 3 : (Math.random() < 0.5 ? 4 : 2);
        const targetLow = Math.random() < 0.5 ? 3 : (Math.random() < 0.5 ? 2 : 4);
        
        let bestNumbers = null;
        let bestScore = -1;

        for (let attempt = 0; attempt < 200; attempt++) {
            const nums = this._weightedPick(available, 6, freq, includeNums);
            if (!nums) continue;

            const sorted = nums.sort((a, b) => a - b);
            const oddCount = sorted.filter(n => n % 2 !== 0).length;
            const lowCount = sorted.filter(n => n <= 22).length;
            const sum = sorted.reduce((a, b) => a + b, 0);

            // 점수 계산
            let score = 0;
            
            // 홀짝 점수
            score += (6 - Math.abs(oddCount - targetOdd)) * 10;
            
            // 고저 점수
            score += (6 - Math.abs(lowCount - targetLow)) * 10;
            
            // 합계 범위 점수 (100~175가 최적)
            if (sum >= 100 && sum <= 175) score += 30;
            else if (sum >= 80 && sum <= 195) score += 15;

            // 끝자리 다양성
            const endings = new Set(sorted.map(n => n % 10));
            score += endings.size * 5;

            // 연속 번호 페널티 (2개까지는 OK)
            let consec = 0;
            for (let i = 1; i < sorted.length; i++) {
                if (sorted[i] - sorted[i-1] === 1) consec++;
            }
            if (consec > 1) score -= 20;

            if (score > bestScore) {
                bestScore = score;
                bestNumbers = sorted;
            }
        }

        return bestNumbers || this._randomGenerate(includeNums, excludeNums);
    }

    /** 고빈도 기반 - 자주 나오는 번호 위주 */
    _hotGenerate(includeNums, excludeNums) {
        const freq = this.stats.getFrequency();
        const available = this._getAvailable(excludeNums);
        
        // 빈도 가중치를 높여서 선택
        const weights = {};
        available.forEach(n => {
            weights[n] = Math.pow(freq[n] || 1, 2); // 제곱으로 가중치 강화
        });

        return this._weightedPick(available, 6, weights, includeNums);
    }

    /** 저빈도 기반 - 안 나온 번호 위주 */
    _coldGenerate(includeNums, excludeNums) {
        const freq = this.stats.getFrequency();
        const available = this._getAvailable(excludeNums);
        const maxFreq = Math.max(...Object.values(freq));
        
        // 빈도 역수 가중치
        const weights = {};
        available.forEach(n => {
            weights[n] = Math.pow(maxFreq - (freq[n] || 0) + 1, 2);
        });

        return this._weightedPick(available, 6, weights, includeNums);
    }

    /** 최근 트렌드 기반 */
    _trendGenerate(includeNums, excludeNums) {
        const recentFreq = this.stats.getFrequency(20); // 최근 20회
        const available = this._getAvailable(excludeNums);
        
        const weights = {};
        available.forEach(n => {
            weights[n] = Math.pow(recentFreq[n] || 0.5, 2);
        });

        return this._weightedPick(available, 6, weights, includeNums);
    }

    /** 완전 랜덤 */
    _randomGenerate(includeNums, excludeNums) {
        const available = this._getAvailable(excludeNums);
        const result = [...includeNums];
        const pool = available.filter(n => !includeNums.includes(n));
        
        while (result.length < 6 && pool.length > 0) {
            const idx = Math.floor(Math.random() * pool.length);
            result.push(pool.splice(idx, 1)[0]);
        }

        return result.sort((a, b) => a - b);
    }

    /** 가중치 기반 랜덤 선택 */
    _weightedPick(available, count, weights, mustInclude = []) {
        const result = [...mustInclude];
        const pool = available.filter(n => !mustInclude.includes(n));
        
        const remaining = count - result.length;
        
        for (let i = 0; i < remaining && pool.length > 0; i++) {
            const totalWeight = pool.reduce((s, n) => s + (weights[n] || 1), 0);
            let rand = Math.random() * totalWeight;
            
            for (let j = 0; j < pool.length; j++) {
                rand -= (weights[pool[j]] || 1);
                if (rand <= 0) {
                    result.push(pool.splice(j, 1)[0]);
                    break;
                }
            }
        }

        return result.sort((a, b) => a - b);
    }

    _getAvailable(excludeNums) {
        const nums = [];
        for (let i = 1; i <= 45; i++) {
            if (!excludeNums.includes(i)) nums.push(i);
        }
        return nums;
    }

    _sameSet(a, b) {
        if (a.length !== b.length) return false;
        const sa = [...a].sort((x, y) => x - y).join(',');
        const sb = [...b].sort((x, y) => x - y).join(',');
        return sa === sb;
    }
}

window.LottoGenerator = LottoGenerator;
