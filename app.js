/**
 * StructuraQS - Master Application State Manager & Controller
 * Pure Native JavaScript - Zero third-party API dependencies.
 */

window.app = {
    currentProjectId: 'proj-skyline-01',
    projects: [],
    currentProject: null,

    async init() {
        console.log("Initializing StructuraQS Platform...");
        await this.loadProjects();
        await this.loadProjectData();

        // Initialize submodules
        if (window.qtoCanvas) window.qtoCanvas.init();
        if (window.calculatorsUI) window.calculatorsUI.init();
        
        this.loadMaterialMaster();
        this.renderDashboardCharts();
    },

    // --- API CLIENT ---
    async apiGet(url) {
        try {
            const res = await fetch(url);
            return await res.json();
        } catch (e) {
            console.error(`API GET error on ${url}:`, e);
            this.showToast(`Network error: ${e.message}`, 'error');
            return { success: false, error: e.message };
        }
    },

    async apiPost(url, data) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return await res.json();
        } catch (e) {
            console.error(`API POST error on ${url}:`, e);
            this.showToast(`Network error: ${e.message}`, 'error');
            return { success: false, error: e.message };
        }
    },

    async apiPut(url, data) {
        try {
            const res = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return await res.json();
        } catch (e) {
            console.error(`API PUT error on ${url}:`, e);
            this.showToast(`Network error: ${e.message}`, 'error');
            return { success: false, error: e.message };
        }
    },

    async apiDelete(url) {
        try {
            const res = await fetch(url, { method: 'DELETE' });
            return await res.json();
        } catch (e) {
            console.error(`API DELETE error on ${url}:`, e);
            this.showToast(`Network error: ${e.message}`, 'error');
            return { success: false, error: e.message };
        }
    },

    // --- PROJECT MANAGEMENT ---
    async loadProjects() {
        const res = await this.apiGet('/api/projects');
        if (res && res.success) {
            this.projects = res.projects || [];
            this.renderProjectDropdown();
        }
    },

    renderProjectDropdown() {
        const select = document.getElementById('project-select');
        if (!select) return;

        select.innerHTML = this.projects.map(p => `
            <option value="${p.id}" ${p.id === this.currentProjectId ? 'selected' : ''}>
                ${p.code} - ${p.name}
            </option>
        `).join('');

        this.currentProject = this.projects.find(p => p.id === this.currentProjectId) || this.projects[0];
        if (this.currentProject) {
            this.currentProjectId = this.currentProject.id;
        }
    },

    async switchProject(projId) {
        this.currentProjectId = projId;
        this.currentProject = this.projects.find(p => p.id === projId);
        this.showToast(`Switched active project: ${this.currentProject?.name}`, 'info');
        await this.loadProjectData();
    },

    async loadProjectData() {
        if (!this.currentProjectId) return;

        const projRes = await this.apiGet(`/api/projects/${this.currentProjectId}`);
        if (projRes && projRes.success) {
            this.currentProject = projRes.project;
            this.updateProjectHeaderInfo();
        }

        if (window.boqGrid) await window.boqGrid.loadBOQ();
        if (window.bbsEngine) await window.bbsEngine.loadBBS();
        if (window.rateAnalysis) await window.rateAnalysis.loadRateAnalyses();
        if (window.ipcBilling) await window.ipcBilling.loadIPCData();
        if (window.qtoCanvas) await window.qtoCanvas.loadProjectTakeoffs();

        this.refreshDashboardKPIs();
        this.renderDashboardCharts();
    },

    updateProjectHeaderInfo() {
        if (!this.currentProject) return;
        const p = this.currentProject;

        const title = document.getElementById('dash-project-name');
        const subtitle = document.getElementById('dash-project-subtitle');
        if (title) title.innerText = p.name;
        if (subtitle) subtitle.innerText = `${p.project_type || 'Construction Project'} | ${p.location || 'Site Location'} | Code: ${p.code}`;

        const contractSumFormatted = `$${parseFloat(p.contract_sum || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const headerSum = document.getElementById('header-contract-sum');
        if (headerSum) headerSum.innerText = contractSumFormatted;

        const dashSum = document.getElementById('dash-contract-val');
        if (dashSum) dashSum.innerText = contractSumFormatted;
    },

    async refreshDashboardKPIs() {
        if (!window.boqGrid || !window.boqGrid.items) return;

        const items = window.boqGrid.items;
        const grandTotal = items.reduce((acc, i) => acc + parseFloat(i.total_amount || 0), 0);

        const contractSumFormatted = `$${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const dashSum = document.getElementById('dash-contract-val');
        if (dashSum) dashSum.innerText = contractSumFormatted;
        const headerSum = document.getElementById('header-contract-sum');
        if (headerSum) headerSum.innerText = contractSumFormatted;

        // Division breakdown table on dashboard
        const divisions = {};
        items.forEach(i => {
            const div = i.division || 'General';
            if (!divisions[div]) divisions[div] = { count: 0, total: 0 };
            divisions[div].count++;
            divisions[div].total += parseFloat(i.total_amount || 0);
        });

        const tbodyDiv = document.getElementById('dash-divisions-tbody');
        if (tbodyDiv) {
            tbodyDiv.innerHTML = Object.entries(divisions).map(([div, data]) => {
                const pct = grandTotal > 0 ? (data.total / grandTotal * 100).toFixed(1) : 0;
                return `
                <tr>
                    <td class="font-bold text-xs" style="color: #93c5fd;">${div.split('.')[0] || '00'}</td>
                    <td class="font-semibold text-xs">${div}</td>
                    <td class="text-right font-mono">${data.count}</td>
                    <td class="text-right font-bold font-mono text-accent">$${data.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td class="text-right font-mono">${pct}%</td>
                </tr>`;
            }).join('');
        }

        // Recent takeoffs on dashboard
        if (window.qtoCanvas && window.qtoCanvas.savedTakeoffs) {
            const tbodyTakeoff = document.getElementById('dash-takeoff-tbody');
            if (tbodyTakeoff) {
                tbodyTakeoff.innerHTML = window.qtoCanvas.savedTakeoffs.slice(0, 5).map(t => `
                <tr>
                    <td class="font-semibold text-xs">${t.name}</td>
                    <td><span class="badge-status" style="background: var(--bg-surface-raised); font-size: 11px;">${t.category}</span></td>
                    <td class="text-right font-bold text-accent font-mono">${t.net_quantity}</td>
                    <td>${t.unit}</td>
                    <td><span class="badge-status badge-success text-xs">Linked to BOQ</span></td>
                </tr>`).join('');
            }
        }
    },

    async renderDashboardCharts() {
        // 1. S-Curve
        const evmRes = await this.apiGet(`/api/projects/${this.currentProjectId}/evm`);
        if (evmRes && evmRes.success) {
            window.qsCharts.drawSCurve('canvas-s-curve', evmRes.periods);
            window.qsCharts.drawSCurve('canvas-evm-full', evmRes.periods);

            if (evmRes.metrics) {
                const m = evmRes.metrics;
                const headerCpi = document.getElementById('header-cpi');
                if (headerCpi) headerCpi.innerText = m.cpi.toFixed(3);

                const evmCpi = document.getElementById('evm-cpi-val');
                if (evmCpi) evmCpi.innerText = m.cpi.toFixed(3);

                const evmSpi = document.getElementById('evm-spi-val');
                if (evmSpi) evmSpi.innerText = m.spi.toFixed(3);

                const evmEac = document.getElementById('evm-eac-val');
                if (evmEac) evmEac.innerText = `$${m.estimate_at_completion_eac.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

                const evmVac = document.getElementById('evm-vac-val');
                if (evmVac) evmVac.innerText = `+$${m.variance_at_completion_vac.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }
        }

        // 2. Cost Breakdown Doughnut
        if (window.boqGrid && window.boqGrid.items) {
            const divisions = {};
            window.boqGrid.items.forEach(i => {
                const div = (i.division || 'General').substring(0, 18);
                divisions[div] = (divisions[div] || 0) + parseFloat(i.total_amount || 0);
            });

            const slices = Object.entries(divisions).map(([k, v]) => ({ label: k, value: v }));
            window.qsCharts.drawDoughnut('canvas-cost-doughnut', slices);
        }
    },

    async loadMaterialMaster() {
        const res = await this.apiGet('/api/material-master');
        if (res && res.success) {
            const tbody = document.getElementById('material-master-tbody');
            if (tbody) {
                tbody.innerHTML = (res.materials || []).map(m => `
                <tr>
                    <td><span class="badge-status" style="background: var(--bg-surface-raised); font-size: 11px;">${m.category}</span></td>
                    <td class="font-bold">${m.material_name}</td>
                    <td class="text-center font-bold">${m.unit}</td>
                    <td class="text-right font-bold text-accent font-mono">$${parseFloat(m.standard_rate).toFixed(2)}</td>
                    <td class="text-right font-mono">${m.density_kg_m3 || '-'}</td>
                    <td class="text-right font-mono">${m.standard_wastage_pct}%</td>
                    <td class="text-muted text-xs">${m.supplier || '-'}</td>
                </tr>`).join('');
            }
        }
    },

    // --- NAVIGATION & TABS ---
    navigateTab(tabName) {
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));

        const targetNav = document.querySelector(`[data-tab="${tabName}"]`);
        const targetPane = document.getElementById(`tab-${tabName}`);

        if (targetNav) targetNav.classList.add('active');
        if (targetPane) targetPane.classList.add('active');

        // Trigger redraw on resize/tab change for canvas components
        if (tabName === 'qto' && window.qtoCanvas) {
            setTimeout(() => {
                window.qtoCanvas.resizeCanvas();
            }, 50);
        }
        if (tabName === 'dashboard' || tabName === 'evm') {
            setTimeout(() => {
                this.renderDashboardCharts();
            }, 50);
        }
        if (tabName === 'bbs' && window.bbsEngine) {
            setTimeout(() => {
                window.bbsEngine.renderDiameterSummary();
            }, 50);
        }
    },

    // --- THEME TOGGLE ---
    toggleTheme() {
        const body = document.body;
        const isDark = body.classList.contains('theme-dark');
        if (isDark) {
            body.classList.remove('theme-dark');
            body.classList.add('theme-light');
            document.getElementById('theme-icon-sun')?.classList.add('hidden');
            document.getElementById('theme-icon-moon')?.classList.remove('hidden');
        } else {
            body.classList.remove('theme-light');
            body.classList.add('theme-dark');
            document.getElementById('theme-icon-sun')?.classList.remove('hidden');
            document.getElementById('theme-icon-moon')?.classList.add('hidden');
        }
        this.renderDashboardCharts();
    },

    // --- MODAL CONTROLLER ---
    openModal(modalId) {
        const backdrop = document.getElementById('modal-backdrop');
        const modal = document.getElementById(modalId);
        if (backdrop) backdrop.classList.remove('hidden');
        if (modal) modal.classList.remove('hidden');
    },

    closeModal() {
        const backdrop = document.getElementById('modal-backdrop');
        if (backdrop) backdrop.classList.add('hidden');
        document.querySelectorAll('.modal-dialog').forEach(m => m.classList.add('hidden'));
    },

    openNewProjectModal() {
        this.openModal('modal-project');
    },

    async submitNewProject() {
        const name = document.getElementById('proj-form-name')?.value;
        const code = document.getElementById('proj-form-code')?.value;
        const currency = document.getElementById('proj-form-currency')?.value || '$';
        const client = document.getElementById('proj-form-client')?.value || '';
        const contractor = document.getElementById('proj-form-contractor')?.value || '';
        const ret = parseFloat(document.getElementById('proj-form-retention')?.value || 5.0);
        const adv = parseFloat(document.getElementById('proj-form-advance')?.value || 10.0);
        const tax = parseFloat(document.getElementById('proj-form-tax')?.value || 5.0);

        if (!name || !code) {
            this.showToast("Please enter Project Name and Code", "warning");
            return;
        }

        const payload = {
            name: name,
            code: code,
            currency: currency,
            client: client,
            contractor: contractor,
            retention_pct: ret,
            advance_recovery_pct: adv,
            tax_pct: tax
        };

        const res = await this.apiPost('/api/projects', payload);
        if (res && res.success) {
            this.showToast(`Project created: ${name}`, 'success');
            this.closeModal();
            await this.loadProjects();
            this.switchProject(res.project.id);
        }
    },

    // --- TOAST NOTIFICATIONS ---
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span>${type === 'success' ? '✓' : (type === 'error' ? '⚠' : 'ℹ')}</span>
            <div>${message}</div>
        `;

        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(30px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    },

    // --- EXPORTS ---
    exportBOQExcel() {
        window.open(`/api/export/excel/boq/${this.currentProjectId}`, '_blank');
        this.showToast("Generating Multi-Sheet BOQ Excel Workbook...", "info");
    },

    exportBBSExcel() {
        window.open(`/api/export/excel/bbs/${this.currentProjectId}`, '_blank');
        this.showToast("Generating Bar Bending Schedule Excel...", "info");
    },

    exportBOQCSV() {
        window.open(`/api/export/csv/boq/${this.currentProjectId}`, '_blank');
        this.showToast("Downloading CSV raw data stream...", "info");
    }
};

// Bootstrap when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app.init();
});
