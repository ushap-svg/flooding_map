/**
 * StructuraQS - Custom HTML5 Canvas Charting Engine
 * Pure Native JavaScript - Zero third party CDN / API dependencies.
 */

window.qsCharts = {
    /**
     * Draws an Earned Value Management (EVM) S-Curve on the given canvas.
     * Plots Planned Value (PV), Earned Value (EV), and Actual Cost (AC).
     */
    drawSCurve(canvasId, periods) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        // Handle high DPI displays
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const width = rect.width || canvas.width || 600;
        const height = rect.height || canvas.height || 260;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, width, height);

        if (!periods || periods.length === 0) return;

        const padding = { top: 25, right: 30, bottom: 40, left: 70 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        // Calculate max value across PV, EV, AC
        let maxVal = 0;
        periods.forEach(p => {
            maxVal = Math.max(maxVal, p.planned_value || 0, p.earned_value || 0, p.actual_cost || 0);
        });
        maxVal = maxVal > 0 ? maxVal * 1.15 : 1000000;

        // Grid lines & Y-axis labels
        const gridSteps = 4;
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px -apple-system, sans-serif';
        ctx.textAlign = 'right';

        for (let i = 0; i <= gridSteps; i++) {
            const y = padding.top + chartHeight - (i / gridSteps) * chartHeight;
            const val = (i / gridSteps) * maxVal;

            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();

            const labelStr = val >= 1000000 ? `$${(val / 1000000).toFixed(1)}M` : `$${(val / 1000).toFixed(0)}k`;
            ctx.fillText(labelStr, padding.left - 8, y + 3);
        }

        // X-axis labels
        ctx.textAlign = 'center';
        const numPts = periods.length;
        const stepX = numPts > 1 ? chartWidth / (numPts - 1) : chartWidth;

        periods.forEach((p, idx) => {
            const x = padding.left + idx * stepX;
            ctx.fillText(`M${p.month_index || (idx + 1)}`, x, height - padding.bottom + 18);
        });

        // Helper to draw a single line series
        function drawSeries(key, strokeColor, fillColor) {
            ctx.beginPath();
            periods.forEach((p, idx) => {
                const val = p[key] || 0;
                const x = padding.left + idx * stepX;
                const y = padding.top + chartHeight - (val / maxVal) * chartHeight;
                if (idx === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });

            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // Draw points
            periods.forEach((p, idx) => {
                const val = p[key] || 0;
                const x = padding.left + idx * stepX;
                const y = padding.top + chartHeight - (val / maxVal) * chartHeight;

                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fillStyle = strokeColor;
                ctx.fill();
                ctx.strokeStyle = '#0f172a';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            });
        }

        // Plot Series: PV (Blue), EV (Green), AC (Amber)
        drawSeries('planned_value', '#2563eb', 'rgba(37, 99, 235, 0.1)');
        drawSeries('earned_value', '#10b981', 'rgba(16, 185, 129, 0.1)');
        drawSeries('actual_cost', '#f59e0b', 'rgba(245, 158, 11, 0.1)');
    },

    /**
     * Draws a Doughnut Chart for division cost allocations.
     */
    drawDoughnut(canvasId, slices) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const width = rect.width || canvas.width || 280;
        const height = rect.height || canvas.height || 240;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, width, height);

        if (!slices || slices.length === 0) return;

        const total = slices.reduce((acc, s) => acc + s.value, 0);
        if (total === 0) return;

        const centerX = width / 2;
        const centerY = height / 2;
        const outerRadius = Math.min(centerX, centerY) - 20;
        const innerRadius = outerRadius * 0.58;

        const defaultColors = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#64748b'];

        let currentAngle = -Math.PI / 2;

        slices.forEach((slice, idx) => {
            const sliceAngle = (slice.value / total) * (Math.PI * 2);
            const color = slice.color || defaultColors[idx % defaultColors.length];

            ctx.beginPath();
            ctx.arc(centerX, centerY, outerRadius, currentAngle, currentAngle + sliceAngle);
            ctx.arc(centerX, centerY, innerRadius, currentAngle + sliceAngle, currentAngle, true);
            ctx.closePath();

            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 2;
            ctx.stroke();

            currentAngle += sliceAngle;
        });

        // Center Text
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 16px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const formattedTotal = total >= 1000000 ? `$${(total / 1000000).toFixed(1)}M` : `$${(total / 1000).toFixed(0)}k`;
        ctx.fillText(formattedTotal, centerX, centerY - 6);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px -apple-system, sans-serif';
        ctx.fillText('CONTRACT', centerX, centerY + 12);
    },

    /**
     * Draws a vertical Bar Chart for steel diameter distribution.
     */
    drawBarChart(canvasId, items) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const width = rect.width || canvas.width || 600;
        const height = rect.height || canvas.height || 240;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        ctx.clearRect(0, 0, width, height);

        if (!items || items.length === 0) return;

        const padding = { top: 20, right: 20, bottom: 35, left: 55 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        let maxVal = Math.max(...items.map(i => i.value), 0.5);
        maxVal = maxVal * 1.2;

        // Grid lines
        const steps = 4;
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px -apple-system, sans-serif';
        ctx.textAlign = 'right';

        for (let i = 0; i <= steps; i++) {
            const y = padding.top + chartHeight - (i / steps) * chartHeight;
            const val = (i / steps) * maxVal;

            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();

            ctx.fillText(`${val.toFixed(2)} MT`, padding.left - 6, y + 3);
        }

        // Bars
        const barWidth = Math.min(36, chartWidth / (items.length * 1.6));
        const spacing = chartWidth / items.length;

        items.forEach((item, idx) => {
            const x = padding.left + idx * spacing + (spacing - barWidth) / 2;
            const barHeight = (item.value / maxVal) * chartHeight;
            const y = padding.top + chartHeight - barHeight;

            // Gradient Bar
            const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
            grad.addColorStop(0, '#8b5cf6');
            grad.addColorStop(1, '#6366f1');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.roundRect ? ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]) : ctx.rect(x, y, barWidth, barHeight);
            ctx.fill();

            // Bar Label (Diameter)
            ctx.fillStyle = '#f8fafc';
            ctx.textAlign = 'center';
            ctx.font = '10px -apple-system, sans-serif';
            ctx.fillText(item.label, x + barWidth / 2, height - padding.bottom + 16);

            // Value on top of bar
            if (item.value > 0) {
                ctx.fillStyle = '#c084fc';
                ctx.font = 'bold 9px var(--font-mono)';
                ctx.fillText(`${item.value.toFixed(2)}`, x + barWidth / 2, y - 6);
            }
        });
    }
};
