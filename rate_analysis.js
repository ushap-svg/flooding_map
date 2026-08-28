/**
 * StructuraQS - Detailed Unit Price Rate Analysis (DUPR) Module
 * Standard cost buildup: Materials + Labor + Machinery + Overheads & Profit.
 */

window.rateAnalysis = {
    analyses: [],

    async loadRateAnalyses() {
        const res = await window.app.apiGet(`/api/projects/${window.app.currentProjectId}/rate-analysis`);
        if (res && res.success) {
            this.analyses = res.analyses || [];
            this.renderList();
        }
    },

    renderList() {
        const container = document.getElementById('rate-analysis-list');
        if (!container) return;

        if (this.analyses.length === 0) {
            container.innerHTML = `<div class="card text-center text-muted p-8">No rate analysis buildups recorded. Click 'Create New Rate Buildup' above.</div>`;
            return;
        }

        container.innerHTML = this.analyses.map(ra => {
            const mats = ra.materials || [];
            const labs = ra.labors || [];
            const eqs = ra.equipment || [];

            const matSub = mats.reduce((acc, m) => acc + (parseFloat(m.qty || 0) * parseFloat(m.rate || 0) * (1 + (parseFloat(m.waste_pct || 0)/100))), 0);
            const labSub = labs.reduce((acc, l) => acc + (parseFloat(l.qty || 0) * parseFloat(l.rate || 0)), 0);
            const eqSub = eqs.reduce((acc, e) => acc + (parseFloat(e.qty || 0) * parseFloat(e.rate || 0)), 0);

            return `
            <div class="rate-card">
                <div class="rate-header-flex">
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="rate-badge">[Item ${ra.item_code}]</span>
                            <h3 class="font-bold text-sm">${ra.title}</h3>
                        </div>
                        <div class="text-muted text-xs mt-2">Unit Output: 1.00 ${ra.unit} | Overhead: ${ra.overhead_pct}% | Contractor Profit: ${ra.profit_pct}%</div>
                    </div>
                    <div class="text-right">
                        <div class="text-xs text-muted font-bold">CALCULATED UNIT RATE:</div>
                        <div class="font-bold text-accent" style="font-size: 20px; font-family: var(--font-mono);">$${parseFloat(ra.calculated_unit_rate).toFixed(2)} <span style="font-size: 12px;">/${ra.unit}</span></div>
                    </div>
                </div>

                <div class="table-responsive mt-2">
                    <table class="data-table" style="font-size: 12px;">
                        <thead>
                            <tr>
                                <th>Cost Element</th>
                                <th>Description / Resource Name</th>
                                <th class="text-center">Unit</th>
                                <th class="text-right">Quantity / Days</th>
                                <th class="text-right">Base Rate ($)</th>
                                <th class="text-right">Waste %</th>
                                <th class="text-right">Subtotal ($)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${mats.map(m => `
                                <tr>
                                    <td><span class="badge-status bg-blue-dim">Material</span></td>
                                    <td>${m.name}</td>
                                    <td class="text-center">${m.unit}</td>
                                    <td class="text-right font-mono">${m.qty}</td>
                                    <td class="text-right font-mono">$${parseFloat(m.rate).toFixed(2)}</td>
                                    <td class="text-right font-mono">${m.waste_pct || 0}%</td>
                                    <td class="text-right font-mono font-bold">$${(parseFloat(m.qty) * parseFloat(m.rate) * (1 + (parseFloat(m.waste_pct || 0)/100))).toFixed(2)}</td>
                                </tr>
                            `).join('')}

                            ${labs.map(l => `
                                <tr>
                                    <td><span class="badge-status bg-emerald-dim">Labor</span></td>
                                    <td>${l.name}</td>
                                    <td class="text-center">${l.unit}</td>
                                    <td class="text-right font-mono">${l.qty}</td>
                                    <td class="text-right font-mono">$${parseFloat(l.rate).toFixed(2)}</td>
                                    <td class="text-right font-mono">-</td>
                                    <td class="text-right font-mono font-bold">$${(parseFloat(l.qty) * parseFloat(l.rate)).toFixed(2)}</td>
                                </tr>
                            `).join('')}

                            ${eqs.map(e => `
                                <tr>
                                    <td><span class="badge-status bg-amber-dim">Machinery</span></td>
                                    <td>${e.name}</td>
                                    <td class="text-center">${e.unit}</td>
                                    <td class="text-right font-mono">${e.qty}</td>
                                    <td class="text-right font-mono">$${parseFloat(e.rate).toFixed(2)}</td>
                                    <td class="text-right font-mono">-</td>
                                    <td class="text-right font-mono font-bold">$${(parseFloat(e.qty) * parseFloat(e.rate)).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <div class="rate-buildup-summary">
                    <div class="quick-kpi-pill">
                        <span class="kpi-title">Materials Subtotal:</span>
                        <span class="kpi-val">$${matSub.toFixed(2)}</span>
                    </div>
                    <div class="quick-kpi-pill">
                        <span class="kpi-title">Labor Subtotal:</span>
                        <span class="kpi-val">$${labSub.toFixed(2)}</span>
                    </div>
                    <div class="quick-kpi-pill">
                        <span class="kpi-title">Plant/Machinery:</span>
                        <span class="kpi-val">$${eqSub.toFixed(2)}</span>
                    </div>
                    <div class="quick-kpi-pill">
                        <span class="kpi-title">Water/Sundries (${ra.water_sundries_pct}%):</span>
                        <span class="kpi-val">$${((matSub + labSub + eqSub) * (ra.water_sundries_pct/100)).toFixed(2)}</span>
                    </div>
                </div>
            </div>
            `;
        }).join('');
    },

    openNewRateModal() {
        const itemCode = prompt("Enter BOQ Item Code to analyze (e.g. 05.01):", "05.01");
        if (!itemCode) return;
        const title = prompt("Enter Rate Buildup Title:", "Internal Plaster 12mm Rate Analysis");
        if (!title) return;

        // Create sample rate analysis template
        const payload = {
            item_code: itemCode,
            title: title,
            unit: "m2",
            output_qty: 1.0,
            materials: [
                { name: "OPC Cement", unit: "bag", qty: 0.12, rate: 7.50, waste_pct: 2.0 },
                { name: "Plaster Sand", unit: "m3", qty: 0.016, rate: 38.00, waste_pct: 3.0 }
            ],
            labors: [
                { name: "Skilled Plasterer", unit: "day", qty: 0.08, rate: 35.00 },
                { name: "Helper / Mazdoor", unit: "day", qty: 0.10, rate: 20.00 }
            ],
            equipment: [],
            water_sundries_pct: 1.5,
            overhead_pct: 5.0,
            profit_pct: 10.0,
            contingency_pct: 1.0
        };

        window.app.apiPost(`/api/projects/${window.app.currentProjectId}/rate-analysis`, payload).then(res => {
            if (res && res.success) {
                window.app.showToast(`Rate analysis created for [${itemCode}]`, "success");
                this.loadRateAnalyses();
                window.app.loadProjectData();
            }
        });
    }
};
