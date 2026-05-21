/**
 * charts.js - Canvas 기반 차트 렌더링
 */

class LottoCharts {
    constructor() {
        this.colors = {
            accent1: '#6366f1',
            accent2: '#8b5cf6',
            accent3: '#a855f7',
            success: '#22c55e',
            warning: '#f59e0b',
            danger: '#ef4444',
            blue: '#3b82f6',
            textPrimary: '#f0f4ff',
            textSecondary: '#94a3b8',
            textMuted: '#64748b',
            bgTertiary: '#1a2035',
            gridLine: 'rgba(255,255,255,0.05)',
        };

        this.ballColors = {
            '1-10': '#fbbf24',
            '11-20': '#3b82f6',
            '21-30': '#ef4444',
            '31-40': '#6b7280',
            '41-45': '#22c55e',
        };
    }

    getBallColor(num) {
        if (num <= 10) return this.ballColors['1-10'];
        if (num <= 20) return this.ballColors['11-20'];
        if (num <= 30) return this.ballColors['21-30'];
        if (num <= 40) return this.ballColors['31-40'];
        return this.ballColors['41-45'];
    }

    /** 번호별 출현 빈도 차트 */
    drawFrequencyChart(canvasId, frequency, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const { mini = false } = options;

        const rect = canvas.parentElement.getBoundingClientRect();
        const width = rect.width - 48;
        const height = mini ? 220 : 320;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, width, height);

        const values = Object.values(frequency);
        const maxVal = Math.max(...values);
        const minVal = Math.min(...values);
        
        const padding = { top: 20, right: 16, bottom: 40, left: 40 };
        const chartW = width - padding.left - padding.right;
        const chartH = height - padding.top - padding.bottom;
        const barWidth = chartW / 45 - 2;
        const barGap = 2;

        // Draw grid lines
        ctx.strokeStyle = this.colors.gridLine;
        ctx.lineWidth = 1;
        const gridLines = 5;
        for (let i = 0; i <= gridLines; i++) {
            const y = padding.top + (chartH / gridLines) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();

            // Y-axis labels
            const val = Math.round(maxVal - (maxVal / gridLines) * i);
            ctx.fillStyle = this.colors.textMuted;
            ctx.font = '10px Inter, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(val, padding.left - 6, y + 4);
        }

        // Draw bars
        for (let i = 0; i < 45; i++) {
            const num = i + 1;
            const val = frequency[num] || 0;
            const barH = (val / maxVal) * chartH;
            const x = padding.left + i * (barWidth + barGap);
            const y = padding.top + chartH - barH;

            // Bar gradient
            const gradient = ctx.createLinearGradient(x, y, x, padding.top + chartH);
            const color = this.getBallColor(num);
            gradient.addColorStop(0, color);
            gradient.addColorStop(1, color + '33');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth, barH, [2, 2, 0, 0]);
            ctx.fill();

            // X-axis labels
            if (!mini || num % 5 === 0 || num === 1 || num === 45) {
                ctx.fillStyle = this.colors.textMuted;
                ctx.font = `${mini ? 9 : 10}px Inter, sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText(num, x + barWidth / 2, height - padding.bottom + 16);
            }

            // Value on top (only for non-mini)
            if (!mini && barH > 20) {
                ctx.fillStyle = this.colors.textSecondary;
                ctx.font = '9px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(val, x + barWidth / 2, y - 4);
            }
        }

        // Highlight max and min
        const maxNum = Object.entries(frequency).sort((a, b) => b[1] - a[1])[0];
        const minNum = Object.entries(frequency).sort((a, b) => a[1] - b[1])[0];

        if (maxNum) {
            const idx = parseInt(maxNum[0]) - 1;
            const x = padding.left + idx * (barWidth + barGap);
            const barH = (maxNum[1] / maxVal) * chartH;
            const y = padding.top + chartH - barH;
            
            ctx.strokeStyle = this.colors.warning;
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 2]);
            ctx.strokeRect(x - 1, y - 1, barWidth + 2, barH + 2);
            ctx.setLineDash([]);
        }
    }

    /** 홀짝/고저 분포 차트 (도넛형) */
    drawDonutChart(canvasId, data, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        const rect = canvas.parentElement.getBoundingClientRect();
        const size = Math.min(rect.width - 48, 280);
        const height = size;

        canvas.width = size * dpr;
        canvas.height = height * dpr;
        canvas.style.width = size + 'px';
        canvas.style.height = height + 'px';
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, size, height);

        const centerX = size / 2;
        const centerY = height / 2;
        const radius = Math.min(size, height) / 2 - 20;
        const innerRadius = radius * 0.55;

        const total = data.reduce((s, d) => s + d.count, 0);
        const chartColors = [
            '#6366f1', '#8b5cf6', '#a855f7', '#c084fc',
            '#3b82f6', '#06b6d4', '#22c55e', '#f59e0b'
        ];

        let startAngle = -Math.PI / 2;

        data.forEach((item, i) => {
            const sliceAngle = (item.count / total) * Math.PI * 2;
            const endAngle = startAngle + sliceAngle;
            const color = chartColors[i % chartColors.length];

            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();

            // Label
            if (sliceAngle > 0.15) {
                const midAngle = startAngle + sliceAngle / 2;
                const labelR = radius - (radius - innerRadius) / 2;
                const lx = centerX + Math.cos(midAngle) * labelR;
                const ly = centerY + Math.sin(midAngle) * labelR;

                const pct = Math.round((item.count / total) * 100);
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 11px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${pct}%`, lx, ly);
            }

            startAngle = endAngle;
        });

        // Center text
        ctx.fillStyle = this.colors.textPrimary;
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('총', centerX, centerY - 8);
        ctx.fillText(`${total}회`, centerX, centerY + 10);

        // Return colors for legend
        return data.map((item, i) => ({
            label: item.ratio || item.label,
            count: item.count,
            color: chartColors[i % chartColors.length]
        }));
    }

    /** 합계 분포 히스토그램 */
    drawHistogram(canvasId, sums) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        const rect = canvas.parentElement.getBoundingClientRect();
        const width = rect.width - 48;
        const height = 260;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, width, height);

        // Build histogram
        const bucketSize = 10;
        const minSum = Math.floor(Math.min(...sums) / bucketSize) * bucketSize;
        const maxSum = Math.ceil(Math.max(...sums) / bucketSize) * bucketSize;
        const buckets = {};

        for (let i = minSum; i <= maxSum; i += bucketSize) {
            buckets[i] = 0;
        }

        sums.forEach(s => {
            const bucket = Math.floor(s / bucketSize) * bucketSize;
            buckets[bucket] = (buckets[bucket] || 0) + 1;
        });

        const entries = Object.entries(buckets).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
        const maxCount = Math.max(...entries.map(e => e[1]));

        const padding = { top: 20, right: 16, bottom: 40, left: 45 };
        const chartW = width - padding.left - padding.right;
        const chartH = height - padding.top - padding.bottom;
        const barWidth = chartW / entries.length - 4;

        // Grid
        ctx.strokeStyle = this.colors.gridLine;
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (chartH / 4) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();

            const val = Math.round(maxCount - (maxCount / 4) * i);
            ctx.fillStyle = this.colors.textMuted;
            ctx.font = '10px Inter, sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(val, padding.left - 6, y + 4);
        }

        // Average line
        const avg = sums.reduce((a, b) => a + b, 0) / sums.length;
        const avgX = padding.left + ((avg - minSum) / (maxSum - minSum)) * chartW;
        
        ctx.strokeStyle = this.colors.warning + '88';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(avgX, padding.top);
        ctx.lineTo(avgX, padding.top + chartH);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = this.colors.warning;
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`평균 ${Math.round(avg)}`, avgX, padding.top - 6);

        // Bars
        entries.forEach(([bucket, count], i) => {
            const barH = (count / maxCount) * chartH;
            const x = padding.left + i * (barWidth + 4);
            const y = padding.top + chartH - barH;

            const gradient = ctx.createLinearGradient(x, y, x, padding.top + chartH);
            gradient.addColorStop(0, this.colors.accent1);
            gradient.addColorStop(1, this.colors.accent1 + '33');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth, barH, [3, 3, 0, 0]);
            ctx.fill();

            // Labels
            ctx.fillStyle = this.colors.textMuted;
            ctx.font = '9px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${bucket}`, x + barWidth / 2, height - padding.bottom + 14);
        });
    }

    /** 연속 번호 & 끝자리 막대 차트 (수평) */
    drawHorizontalBarChart(canvasId, data, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;

        const rect = canvas.parentElement.getBoundingClientRect();
        const width = rect.width - 48;
        const barHeight = 28;
        const gap = 8;
        const height = (barHeight + gap) * data.length + 40;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, width, height);

        const maxVal = Math.max(...data.map(d => d.count || d.value));
        const labelWidth = options.labelWidth || 80;
        const chartW = width - labelWidth - 60;

        data.forEach((item, i) => {
            const y = i * (barHeight + gap) + 10;
            const val = item.count || item.value;
            const barW = (val / maxVal) * chartW;

            // Label
            ctx.fillStyle = this.colors.textSecondary;
            ctx.font = '12px Inter, sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(item.label, labelWidth - 10, y + barHeight / 2);

            // Bar
            const gradient = ctx.createLinearGradient(labelWidth, y, labelWidth + barW, y);
            gradient.addColorStop(0, this.colors.accent1);
            gradient.addColorStop(1, this.colors.accent3);

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.roundRect(labelWidth, y, barW, barHeight, 4);
            ctx.fill();

            // Value
            ctx.fillStyle = this.colors.textPrimary;
            ctx.font = 'bold 11px Inter, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(val, labelWidth + barW + 8, y + barHeight / 2);
        });
    }

    /** 끝자리 분포 차트 */
    drawEndingDigitChart(canvasId, distribution) {
        const data = Object.entries(distribution).map(([digit, count]) => ({
            label: digit + '끝',
            count
        }));
        this.drawHorizontalBarChart(canvasId, data, { labelWidth: 50 });
    }
}

window.LottoCharts = LottoCharts;
