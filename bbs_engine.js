/**
 * StructuraQS - Bar Bending Schedule (BBS) Engine
 * IS 2502 / BS 8666 rebar shape visualizer & weight matrix ($D^2/162.2$).
 */

window.bbsEngine = {
    items: [],

    async loadBBS() {
        const res = await window.app.apiGet(`/api/projects/${window.app.currentProjectId}/bbs`);
        if (res && res.success) {
            this.items = res.items || [];
            this.renderTable();
            this.renderDiameterSummary();
        }
    },

    renderTable() {
        const tbody = document.getElementById('bbs-table-body');
        if (!tbody) return;

        let totWeightKg = 0;
        let totLengthM = 0;

        let html = this.items.map(item => {
            totWeightKg += parseFloat(item.total_weight_kg || 0);
            totLengthM += parseFloat(item.total_length_m || 0);

            return `
            <tr>
                <td class="font-bold">${item.member_name}</td>
                <td class="font-bold text-accent" style="font-family: var(--font-mono);">${item.bar_mark}</td>
                <td><span class="badge-status" style="background: var(--bg-surface-raised); font-size: 11px;">${item.shape_code}</span></td>
                <td class="text-center font-bold">Ø ${item.diameter_mm}</td>
                <td class="text-right">${parseFloat(item.cut_length_m).toFixed(2)}</td>
                <td class="text-center">${item.num_members}</td>
                <td class="text-center">${item.bars_per_member}</td>
                <td class="text-center font-bold">${item.total_bars}</td>
                <td class="text-right">${parseFloat(item.total_length_m).toFixed(2)}</td>
                <td class="text-right">${parseFloat(item.unit_weight_kg_m).toFixed(3)}</td>
                <td class="text-right font-bold text-accent">${parseFloat(item.total_weight_kg).toFixed(2)}</td>
                <td class="text-right font-bold">${parseFloat(item.total_weight_mt).toFixed(3)}</td>
                <td class="text-center">
                    <button class="btn-icon text-danger" onclick="window.bbsEngine.deleteBBSItem('${item.id}')" title="Delete Rebar Entry">×</button>
                </td>
            </tr>`;
        }).join('');

        if (this.items.length === 0) {
            html = `<tr><td colspan="13" class="text-center text-muted p-6">No rebar reinforcement items logged yet.</td></tr>`;
        }

        tbody.innerHTML = html;

        // Update Dashboard / Summary Badges
        const totalMt = (totWeightKg / 1000.0).toFixed(3);
        document.getElementById('bbs-total-mt').innerText = `${totalMt} MT`;
        document.getElementById('bbs-total-kg').innerText = totWeightKg.toFixed(1);
        document.getElementById('bbs-total-length').innerText = `${totLengthM.toFixed(1)} m`;
        document.getElementById('bbs-est-cost').innerText = `$${((totWeightKg / 1000.0) * 780.0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        const dashTonnage = document.getElementById('dash-steel-tonnage');
        if (dashTonnage) dashTonnage.innerText = `${totalMt} MT`;
    },

    renderDiameterSummary() {
        const diaWeights = { 8: 0, 10: 0, 12: 0, 16: 0, 20: 0, 25: 0, 32: 0 };
        let totalKg = 0;

        this.items.forEach(i => {
            const d = Math.round(parseFloat(i.diameter_mm));
            const wt = parseFloat(i.total_weight_kg || 0);
            totalKg += wt;
            if (diaWeights[d] !== undefined) diaWeights[d] += wt;
            else diaWeights[d] = wt;
        });

        const tbody = document.getElementById('bbs-dia-summary-tbody');
        if (tbody) {
            tbody.innerHTML = Object.entries(diaWeights).map(([d, kg]) => {
                const diaNum = parseInt(d);
                const unitWt = ((diaNum * diaNum) / 162.2).toFixed(3);
                const mt = (kg / 1000.0).toFixed(3);
                return `
                <tr>
                    <td class="font-bold">Ø ${d} mm</td>
                    <td class="text-right font-mono">${unitWt}</td>
                    <td class="text-right font-mono">${kg.toFixed(1)}</td>
                    <td class="text-right font-bold text-accent font-mono">${mt}</td>
                </tr>`;
            }).join('');
        }

        // Draw Bar Chart on BBS tab
        const chartItems = Object.entries(diaWeights).map(([d, kg]) => ({
            label: `Ø${d}`,
            value: kg / 1000.0
        }));
        window.qsCharts.drawBarChart('canvas-bbs-bar', chartItems);
    },

    openAddBBSModal() {
        document.getElementById('bbs-form-member').value = "Floor Beams Level 02 (B201-B208)";
        document.getElementById('bbs-form-mark').value = "B-BOT-01";
        document.getElementById('bbs-form-shape').value = "STRAIGHT";
        document.getElementById('bbs-form-dia').value = "16";
        document.getElementById('bbs-form-num-members').value = "8";
        document.getElementById('bbs-form-bars-per-member').value = "4";

        this.onShapeChange('STRAIGHT');
        window.app.openModal('modal-bbs-item');
    },

    onShapeChange(shapeCode) {
        const container = document.getElementById('bbs-dim-container');
        if (!container) return;

        let dimHTML = '';
        if (shapeCode === 'STRAIGHT') {
            dimHTML = `
                <div class="form-group">
                    <label class="form-label">Length A (m)</label>
                    <input type="number" id="dim-a" class="form-input" value="6.50" step="0.05" oninput="window.bbsEngine.recalcModal()">
                </div>`;
        } else if (shapeCode === 'L_BEND') {
            dimHTML = `
                <div class="form-row-2">
                    <div class="form-group">
                        <label class="form-label">Length A (m)</label>
                        <input type="number" id="dim-a" class="form-input" value="5.80" step="0.05" oninput="window.bbsEngine.recalcModal()">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Bend B (m)</label>
                        <input type="number" id="dim-b" class="form-input" value="0.45" step="0.05" oninput="window.bbsEngine.recalcModal()">
                    </div>
                </div>`;
        } else if (shapeCode === 'U_SHAPE') {
            dimHTML = `
                <div class="form-row-2">
                    <div class="form-group">
                        <label class="form-label">Span A (m)</label>
                        <input type="number" id="dim-a" class="form-input" value="4.20" step="0.05" oninput="window.bbsEngine.recalcModal()">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Hook Legs B (m)</label>
                        <input type="number" id="dim-b" class="form-input" value="0.30" step="0.05" oninput="window.bbsEngine.recalcModal()">
                    </div>
                </div>`;
        } else if (shapeCode === 'CRANK_SLAB') {
            dimHTML = `
                <div class="form-row-2">
                    <div class="form-group">
                        <label class="form-label">Clear Span A (m)</label>
                        <input type="number" id="dim-a" class="form-input" value="4.80" step="0.05" oninput="window.bbsEngine.recalcModal()">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Crank Depth H (m)</label>
                        <input type="number" id="dim-h" class="form-input" value="0.10" step="0.01" oninput="window.bbsEngine.recalcModal()">
                    </div>
                </div>`;
        } else if (shapeCode === 'RECT_STIRRUP') {
            dimHTML = `
                <div class="form-row-2">
                    <div class="form-group">
                        <label class="form-label">Width A (m)</label>
                        <input type="number" id="dim-a" class="form-input" value="0.25" step="0.02" oninput="window.bbsEngine.recalcModal()">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Depth B (m)</label>
                        <input type="number" id="dim-b" class="form-input" value="0.45" step="0.02" oninput="window.bbsEngine.recalcModal()">
                    </div>
                </div>`;
        } else if (shapeCode === 'CIRCULAR_TIE') {
            dimHTML = `
                <div class="form-group">
                    <label class="form-label">Ring Diameter A (m)</label>
                    <input type="number" id="dim-a" class="form-input" value="0.60" step="0.05" oninput="window.bbsEngine.recalcModal()">
                </div>`;
        } else if (shapeCode === 'CHAIR_BAR') {
            dimHTML = `
                <div class="form-row-3">
                    <div class="form-group">
                        <label class="form-label">Top A (m)</label>
                        <input type="number" id="dim-a" class="form-input" value="0.30" step="0.05" oninput="window.bbsEngine.recalcModal()">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Height B (m)</label>
                        <input type="number" id="dim-b" class="form-input" value="0.12" step="0.02" oninput="window.bbsEngine.recalcModal()">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Feet C (m)</label>
                        <input type="number" id="dim-c" class="form-input" value="0.15" step="0.02" oninput="window.bbsEngine.recalcModal()">
                    </div>
                </div>`;
        }

        container.innerHTML = dimHTML;
        this.recalcModal();
    },

    recalcModal() {
        const shapeCode = document.getElementById('bbs-form-shape')?.value || 'STRAIGHT';
        const dia = parseFloat(document.getElementById('bbs-form-dia')?.value || 12);
        const numMembers = parseInt(document.getElementById('bbs-form-num-members')?.value || 1);
        const barsPerMember = parseInt(document.getElementById('bbs-form-bars-per-member')?.value || 1);

        const a = parseFloat(document.getElementById('dim-a')?.value || 0);
        const b = parseFloat(document.getElementById('dim-b')?.value || 0);
        const c = parseFloat(document.getElementById('dim-c')?.value || 0);
        const h = parseFloat(document.getElementById('dim-h')?.value || 0);

        // Calculate cutting length based on civil codes
        let cutLen = 0;
        const d_m = dia / 1000.0;

        if (shapeCode === 'STRAIGHT') {
            cutLen = a;
        } else if (shapeCode === 'L_BEND') {
            cutLen = Math.max(0, a + b - (2 * d_m));
        } else if (shapeCode === 'U_SHAPE') {
            cutLen = Math.max(0, a + 2 * b - (4 * d_m));
        } else if (shapeCode === 'CRANK_SLAB') {
            cutLen = Math.max(0, a + 2 * (0.42 * h) + 2 * (10 * d_m) - (4 * d_m));
        } else if (shapeCode === 'RECT_STIRRUP') {
            cutLen = Math.max(0, 2 * (a + b) + 2 * (10 * d_m) - (3 * 2 * d_m + 2 * 3 * d_m));
        } else if (shapeCode === 'CIRCULAR_TIE') {
            cutLen = Math.max(0, (Math.PI * a) + 2 * (10 * d_m));
        } else if (shapeCode === 'CHAIR_BAR') {
            cutLen = a + 2 * b + 2 * c;
        }

        const totalBars = numMembers * barsPerMember;
        const unitWt = (dia * dia) / 162.2;
        const totLength = cutLen * totalBars;
        const totWt = totLength * unitWt;

        document.getElementById('bbs-modal-cut-len').innerText = `${cutLen.toFixed(2)} m`;
        document.getElementById('bbs-modal-total-bars').innerText = totalBars;
        document.getElementById('bbs-modal-total-wt').innerText = `${totWt.toFixed(2)} kg`;

        // Render preview canvas
        this.renderShapePreviewCanvas(shapeCode);
    },

    renderShapePreviewCanvas(shapeCode) {
        const canvas = document.getElementById('canvas-bbs-shape-preview');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        ctx.beginPath();
        if (shapeCode === 'STRAIGHT') {
            ctx.moveTo(40, cy);
            ctx.lineTo(240, cy);
        } else if (shapeCode === 'L_BEND') {
            ctx.moveTo(50, cy - 35);
            ctx.lineTo(50, cy + 35);
            ctx.lineTo(230, cy + 35);
        } else if (shapeCode === 'U_SHAPE') {
            ctx.moveTo(50, cy - 35);
            ctx.lineTo(50, cy + 35);
            ctx.lineTo(230, cy + 35);
            ctx.lineTo(230, cy - 35);
        } else if (shapeCode === 'CRANK_SLAB') {
            ctx.moveTo(30, cy + 25);
            ctx.lineTo(70, cy + 25);
            ctx.lineTo(100, cy - 25);
            ctx.lineTo(180, cy - 25);
            ctx.lineTo(210, cy + 25);
            ctx.lineTo(250, cy + 25);
        } else if (shapeCode === 'RECT_STIRRUP') {
            ctx.strokeRect(cx - 60, cy - 40, 120, 80);
            ctx.moveTo(cx + 60, cy - 20);
            ctx.lineTo(cx + 40, cy - 40);
        } else if (shapeCode === 'CIRCULAR_TIE') {
            ctx.arc(cx, cy, 45, 0, Math.PI * 2);
        } else if (shapeCode === 'CHAIR_BAR') {
            ctx.moveTo(cx - 50, cy + 30);
            ctx.lineTo(cx - 30, cy + 30);
            ctx.lineTo(cx - 30, cy - 20);
            ctx.lineTo(cx + 30, cy - 20);
            ctx.lineTo(cx + 30, cy + 30);
            ctx.lineTo(cx + 50, cy + 30);
        }
        ctx.stroke();

        // Label
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(shapeCode.replace('_', ' '), cx, canvas.height - 10);
    },

    async saveBBSItem() {
        const member = document.getElementById('bbs-form-member')?.value;
        const mark = document.getElementById('bbs-form-mark')?.value;
        const shape = document.getElementById('bbs-form-shape')?.value;
        const dia = parseFloat(document.getElementById('bbs-form-dia')?.value || 12);
        const numMembers = parseInt(document.getElementById('bbs-form-num-members')?.value || 1);
        const barsPerMember = parseInt(document.getElementById('bbs-form-bars-per-member')?.value || 1);

        const dims = {
            a: parseFloat(document.getElementById('dim-a')?.value || 0),
            b: parseFloat(document.getElementById('dim-b')?.value || 0),
            c: parseFloat(document.getElementById('dim-c')?.value || 0),
            h: parseFloat(document.getElementById('dim-h')?.value || 0)
        };

        if (!member || !mark) {
            window.app.showToast("Please enter member name & bar mark", "warning");
            return;
        }

        const payload = {
            member_name: member,
            bar_mark: mark,
            shape_code: shape,
            diameter_mm: dia,
            dimensions: dims,
            num_members: numMembers,
            bars_per_member: barsPerMember
        };

        const res = await window.app.apiPost(`/api/projects/${window.app.currentProjectId}/bbs`, payload);
        if (res && res.success) {
            window.app.showToast(`Logged BBS rebar mark ${mark}`, "success");
            window.app.closeModal();
            this.loadBBS();
        }
    },

    async deleteBBSItem(id) {
        if (!confirm("Delete this BBS rebar entry?")) return;
        await window.app.apiDelete(`/api/bbs/${id}`);
        window.app.showToast("Rebar entry removed", "info");
        this.loadBBS();
    }
};
