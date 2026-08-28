/**
 * StructuraQS - Interim Payment Certificates (IPC) & Variations Module
 * Valuation of work executed, contractual deductions, and change orders.
 */

window.ipcBilling = {
    certificates: [],
    variations: [],

    async loadIPCData() {
        const res = await window.app.apiGet(`/api/projects/${window.app.currentProjectId}/ipc`);
        if (res && res.success) {
            this.certificates = res.certificates || [];
            this.renderIPCCards();
        }

        const resVar = await window.app.apiGet(`/api/projects/${window.app.currentProjectId}/variations`);
        if (resVar && resVar.success) {
            this.variations = resVar.variations || [];
            this.renderVariationsTable();
        }
    },

    renderIPCCards() {
        const container = document.getElementById('ipc-list-container');
        if (!container) return;

        if (this.certificates.length === 0) {
            container.innerHTML = `<div class="card text-center text-muted p-8">No interim payment certificates generated yet.</div>`;
            return;
        }

        container.innerHTML = this.certificates.map(ipc => {
            const grossPeriod = parseFloat(ipc.gross_work_this_period || 0);
            const grossCum = parseFloat(ipc.gross_work_cumulative || 0);
            const ret = parseFloat(ipc.retention_deducted || 0);
            const adv = parseFloat(ipc.advance_recovered || 0);
            const tax = parseFloat(ipc.tax_deducted || 0);
            const net = parseFloat(ipc.net_payable_this_period || 0);

            return `
            <div class="ipc-card">
                <div class="ipc-header-bar">
                    <div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <h3 class="font-bold text-sm">INTERIM PAYMENT CERTIFICATE #${String(ipc.cert_number).padStart(2, '0')}</h3>
                            <span class="badge-status ${ipc.status === 'PAID' ? 'badge-success' : 'badge-warning'}">${ipc.status}</span>
                        </div>
                        <div class="text-muted text-xs mt-2">Billing Period: ${ipc.period_start} to ${ipc.period_end} | Certified: ${ipc.submission_date}</div>
                    </div>
                    <div class="text-right">
                        <div class="text-xs text-muted font-bold">NET CERTIFIED AMOUNT PAYABLE:</div>
                        <div class="font-bold text-accent" style="font-size: 22px; font-family: var(--font-mono);">$${net.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                </div>

                <div class="ipc-breakdown-grid">
                    <div class="result-stat-box">
                        <div class="stat-label">GROSS VALUATION (THIS BILL)</div>
                        <div class="stat-val">$${grossPeriod.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        <div class="stat-sub">Cumulative: $${grossCum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                    <div class="result-stat-box">
                        <div class="stat-label">RETENTION MONEY (5.0%)</div>
                        <div class="stat-val text-warning">-$${ret.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        <div class="stat-sub">Defects Liability Holdback</div>
                    </div>
                    <div class="result-stat-box">
                        <div class="stat-label">ADVANCE RECOVERY (10.0%)</div>
                        <div class="stat-val text-warning">-$${adv.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        <div class="stat-sub">Mobilization Amortization</div>
                    </div>
                    <div class="result-stat-box">
                        <div class="stat-label">WITHHOLDING TAX (5.0%)</div>
                        <div class="stat-val text-warning">-$${tax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        <div class="stat-sub">Statutory Construction Tax</div>
                    </div>
                </div>

                <div class="text-muted text-xs mt-4">
                    <strong>Engineer Remark:</strong> ${ipc.notes || 'Verified against site measurement sheets and joint inspection records.'}
                </div>
            </div>
            `;
        }).join('');
    },

    renderVariationsTable() {
        const tbody = document.getElementById('variations-tbody');
        if (!tbody) return;

        let html = this.variations.map(vo => {
            const amt = parseFloat(vo.amount || 0);
            const isPos = amt >= 0;

            return `
            <tr>
                <td class="font-bold text-accent" style="font-family: var(--font-mono);">${vo.vo_number}</td>
                <td>
                    <div class="font-semibold">${vo.title}</div>
                    <div class="text-muted text-xs">${vo.description || ''}</div>
                </td>
                <td><span class="badge-status" style="background: var(--bg-surface-raised); font-size: 11px;">${vo.category}</span></td>
                <td class="text-right font-bold font-mono ${isPos ? 'text-success' : 'text-danger'}">
                    ${isPos ? '+' : ''}$${amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td class="text-center font-bold font-mono">${vo.time_extension_days > 0 ? `+${vo.time_extension_days} d` : '0 d'}</td>
                <td class="text-center"><span class="badge-status badge-success">${vo.status}</span></td>
                <td>${vo.approved_date || '-'}</td>
                <td class="text-xs text-muted">${vo.justification || '-'}</td>
            </tr>`;
        }).join('');

        if (this.variations.length === 0) {
            html = `<tr><td colspan="8" class="text-center text-muted p-6">No change orders or variation claims registered.</td></tr>`;
        }

        tbody.innerHTML = html;
    },

    openNewIPCModal() {
        const certNum = this.certificates.length + 1;
        const gross = prompt(`Enter Gross Valuation of Work Completed for IPC #${certNum} ($):`, "450000.00");
        if (!gross || isNaN(gross)) return;

        const payload = {
            cert_number: certNum,
            period_start: "2026-07-01",
            period_end: "2026-08-15",
            submission_date: "2026-08-20",
            gross_work_this_period: parseFloat(gross),
            notes: "Certified pursuant to Site Engineer measurement record & consultant progress audit."
        };

        window.app.apiPost(`/api/projects/${window.app.currentProjectId}/ipc`, payload).then(res => {
            if (res && res.success) {
                window.app.showToast(`Generated IPC #${certNum} (Net Payable: $${res.net_payable})`, "success");
                this.loadIPCData();
                window.app.loadProjectData();
            }
        });
    },

    openNewVariationModal() {
        const voNum = `VO-${String(this.variations.length + 1).padStart(3, '0')}`;
        const title = prompt("Enter Variation Title (e.g. Additional Pile Foundations Under Tower Core):", "Additional Foundation Works");
        if (!title) return;
        const amt = prompt("Enter Variation Claim Amount ($) [Negative for Omission]:", "35000.00");
        if (!amt || isNaN(amt)) return;

        const payload = {
            vo_number: voNum,
            title: title,
            description: "Site condition variation approved by Structural Consultant",
            category: parseFloat(amt) >= 0 ? "ADDITION" : "OMISSION",
            amount: parseFloat(amt),
            time_extension_days: 5,
            status: "APPROVED",
            requested_date: "2026-08-10",
            approved_date: "2026-08-18",
            justification: "Consultant Site Instruction SI-08"
        };

        window.app.apiPost(`/api/projects/${window.app.currentProjectId}/variations`, payload).then(res => {
            if (res && res.success) {
                window.app.showToast(`Logged variation ${voNum}`, "success");
                this.loadIPCData();
                window.app.loadProjectData();
            }
        });
    }
};
