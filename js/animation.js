/**
 * animation.js - 로또 볼 추첨 애니메이션
 */

class LottoAnimation {
    constructor() {
        this.isAnimating = false;
    }

    getBallClass(num) {
        if (num <= 10) return 'ball-1-10';
        if (num <= 20) return 'ball-11-20';
        if (num <= 30) return 'ball-21-30';
        if (num <= 40) return 'ball-31-40';
        return 'ball-41-45';
    }

    getBallBg(num) {
        if (num <= 10) return 'var(--ball-yellow-bg)';
        if (num <= 20) return 'var(--ball-blue-bg)';
        if (num <= 30) return 'var(--ball-red-bg)';
        if (num <= 40) return 'var(--ball-gray-bg)';
        return 'var(--ball-green-bg)';
    }

    /** 로또 볼 HTML 생성 */
    createBallElement(num, options = {}) {
        const { size = 'normal', bonus = false, delay = 0, matched = false } = options;
        const ball = document.createElement('div');
        const ballClass = this.getBallClass(num);

        let sizeClass = '';
        if (size === 'small') sizeClass = 'hot-cold-ball';
        else if (size === 'result') sizeClass = 'result-ball';
        else if (size === 'match') sizeClass = 'match-ball';
        else if (size === 'machine') sizeClass = 'machine-ball';
        else sizeClass = 'lotto-ball';

        ball.className = `${sizeClass} ${ballClass}`;
        if (bonus) ball.classList.add('bonus');
        if (matched) ball.classList.add('matched');
        ball.textContent = num;

        if (delay > 0) {
            ball.style.animationDelay = delay + 'ms';
        }

        return ball;
    }

    /** 추첨 애니메이션 실행 */
    async animateDraw(numbers, containerId, onComplete) {
        if (this.isAnimating) return;
        this.isAnimating = true;

        const area = document.getElementById('draw-animation-area');
        const container = document.getElementById(containerId);

        if (!area || !container) {
            this.isAnimating = false;
            if (onComplete) onComplete();
            return;
        }

        area.style.display = 'block';
        container.innerHTML = '';

        // 혼합 볼 애니메이션
        const mixBalls = this._createMixingBalls();
        container.appendChild(mixBalls);

        await this._sleep(800);
        container.innerHTML = '';

        // 볼 하나씩 공개
        for (let i = 0; i < numbers.length; i++) {
            const ball = this.createBallElement(numbers[i], {
                size: 'machine',
                delay: 0
            });
            container.appendChild(ball);

            // 공개 애니메이션
            await this._sleep(50);
            ball.classList.add('revealed');
            await this._sleep(400);
        }

        await this._sleep(500);
        this.isAnimating = false;

        if (onComplete) onComplete();
    }

    /** 혼합 볼 효과 */
    _createMixingBalls() {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;justify-content:center;';
        
        for (let i = 0; i < 12; i++) {
            const ball = document.createElement('div');
            const randomNum = Math.floor(Math.random() * 45) + 1;
            ball.className = `machine-ball ${this.getBallClass(randomNum)}`;
            ball.textContent = '?';
            ball.style.cssText = `
                opacity: 0.4;
                width: 36px;
                height: 36px;
                font-size: 0.8rem;
                animation: mixBall ${0.3 + Math.random() * 0.5}s ease-in-out infinite alternate;
                animation-delay: ${Math.random() * 0.3}s;
            `;
            wrapper.appendChild(ball);
        }

        // Add mix animation
        if (!document.getElementById('mix-animation-style')) {
            const style = document.createElement('style');
            style.id = 'mix-animation-style';
            style.textContent = `
                @keyframes mixBall {
                    0% { transform: scale(0.8) translateY(0) rotate(0); opacity: 0.3; }
                    100% { transform: scale(1.1) translateY(-8px) rotate(20deg); opacity: 0.6; }
                }
            `;
            document.head.appendChild(style);
        }

        return wrapper;
    }

    /** 히어로 배경 볼 생성 */
    createHeroBalls(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const colors = ['#fbbf24', '#3b82f6', '#ef4444', '#6b7280', '#22c55e'];
        const numBalls = 15;

        for (let i = 0; i < numBalls; i++) {
            const ball = document.createElement('div');
            ball.className = 'hero-bg-ball';
            const size = 30 + Math.random() * 60;
            const color = colors[Math.floor(Math.random() * colors.length)];
            
            ball.style.cssText = `
                width: ${size}px;
                height: ${size}px;
                background: ${color};
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
                animation-delay: ${Math.random() * 5}s;
                animation-duration: ${5 + Math.random() * 5}s;
            `;
            container.appendChild(ball);
        }
    }

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

window.LottoAnimation = LottoAnimation;
