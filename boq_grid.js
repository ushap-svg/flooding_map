/**
 * StructuraQS - Bill of Quantities (BOQ) Studio Module
 * Pure Native JavaScript - Standard Measurement Rules (SMM7/NRM2/IS 1200/POMI).
 */

window.boqGrid = {
    items: [],
    editingItemId: null,

    async loadBOQ() {
        const res = await window.app.apiGet(`/api/projects/${window.app.currentProjectId}/boq`);
        if (res && res.success) {
            this.items = res.items || [];
            this.renderTable();
            this.populateDivisionFilter();
            this.populateBOQDropdownInTakeoff();
        }
    },

    populateDivisionFilter() {
        const select = document.getElementById('boq-division-filter');
        if (!select) return;
        const divs = [...new Set(this.items.map(i => i.division))].filter(Boolean).sort();
        
        select.innerHTML = `<option value="ALL">All Divisions (${divs.length})</option>` +
            divs.map(d => `<option value="${d}">${d}</option>`).join('');
    },

    populateBOQDropdownInTakeoff() {
        const select = document.getElementById('prop-link-boq');
        if (!select) return;

        select.innerHTML = `<option value="">-- Select BOQ Item to Synchronize --</option>` +
            this.items.map(i => `<option value="${i.id}">[${i.item_code}] ${i.description.substring(0, 45)}... (${i.unit})</option>`).join('');
    },

    renderTable() {
        const tbody = document.getElementById('boq-table-body');
        const grandTotalFoot = document.getElementById('boq-foot-grand-total');
        if (!tbody) return;

        const searchTerm = (document.getElementById('boq-search')?.value || '').toLowerCase();
        const divisionFilter = document.getElementById('boq-division-filter')?.value || 'ALL';

        let filtered = this.items.filter(item => {
            const matchesSearch = !searchTerm || 
                item.item_code.toLowerCase().includes(searchTerm) ||
                item.description.toLowerCase().includes(searchTerm) ||
                (item.section && item.section.toLowerCase().includes(searchTerm));
            const matchesDiv = divisionFilter === 'ALL' || item.division === divisionFilter;
            return matchesSearch && matchesDiv;
        });

        let currentDiv = null;
        let html = '';
        let grandTotal = 0;

        filtered.forEach(item => {
            const totalAmt = parseFloat(item.total_amount || 0);
            grandTotal += totalAmt;

            // Division header row
            if (item.division !== currentDiv && divisionFilter === 'ALL') {
                currentDiv = item.division;
                html += `
                <tr class="division-header-row">
                    <td colspan="8">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <span>${currentDiv}</span>
                            <span class="text-xs text-muted" style="font-weight: normal;">Work Package</span>
                        </div>
                    </td>
                </tr>`;
            }

            html += `
            <tr data-id="${item.id}">
                <td class="font-bold" style="font-family: var(--font-mono); color: #93c5fd;">${item.item_code}</td>
                <td><span class="badge-status" style="background: var(--bg-surface-raised); font-size: 11px;">${item.section || item.division}</span></td>
                <td>
                    <div class="font-semibold">${item.description}</div>
                </td>
                <td class="text-center font-bold">${item.unit}</td>
                <td class="text-right">
                    <input type="number" class="form-input text-right font-bold inline-edit-input" 
                        value="${item.quantity}" step="0.01" style="width: 100px; padding: 4px;"
                        onchange="window.boqGrid.updateInlineQuantity('${item.id}', this.value)">
                </td>
                <td class="text-right">
                    <input type="number" class="form-input text-right font-bold text-accent inline-edit-input" 
                        value="${item.unit_rate}" step="0.01" style="width: 110px; padding: 4px;"
                        onchange="window.boqGrid.updateInlineRate('${item.id}', this.value)">
                </td>
                <td class="text-right font-bold text-accent" style="font-family: var(--font-mono);">
                    $${totalAmt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td class="text-center">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
                        <button class="btn-icon" onclick="window.boqGrid.openEditItemModal('${item.id}')" title="Edit Item Details">✎</button>
                        <button class="btn-icon text-danger" onclick="window.boqGrid.deleteItem('${item.id}')" title="Delete Item">×</button>
                    </div>
                </td>
            </tr>`;
        });

        if (filtered.length === 0) {
            html = `<tr><td colspan="8" class="text-center text-muted p-6">No BOQ items match the selected filter.</td></tr>`;
        }

        tbody.innerHTML = html;
        if (grandTotalFoot) {
            grandTotalFoot.innerText = `$${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
    },

    filterTable() {
        this.renderTable();
    },

    async updateInlineQuantity(itemId, newQty) {
        const item = this.items.find(i => i.id === itemId);
        if (!item) return;
        item.quantity = parseFloat(newQty) || 0;
        item.total_amount = round(item.quantity * item.unit_rate, 2);

        await window.app.apiPut(`/api/boq/${itemId}`, item);
        this.renderTable();
        window.app.refreshDashboardKPIs();
        window.app.showToast(`Updated Quantity for [${item.item_code}]`, "info");
    },

    async updateInlineRate(itemId, newRate) {
        const item = this.items.find(i => i.id === itemId);
        if (!item) return;
        item.unit_rate = parseFloat(newRate) || 0;
        item.total_amount = round(item.quantity * item.unit_rate, 2);

        await window.app.apiPut(`/api/boq/${itemId}`, item);
        this.renderTable();
        window.app.refreshDashboardKPIs();
        window.app.showToast(`Updated Unit Rate for [${item.item_code}]`, "info");
    },

    openAddItemModal() {
        this.editingItemId = null;
        document.getElementById('modal-boq-title').innerText = "Add New BOQ Line Item";
        document.getElementById('boq-form-id').value = "";
        document.getElementById('boq-form-code').value = "";
        document.getElementById('boq-form-section').value = "";
        document.getElementById('boq-form-desc').value = "";
        document.getElementById('boq-form-unit').value = "m3";
        document.getElementById('boq-form-qty').value = "1.0";
        document.getElementById('boq-form-rate').value = "0.00";
        this.calcModalTotal();
        window.app.openModal('modal-boq-item');
    },

    openEditItemModal(itemId) {
        const item = this.items.find(i => i.id === itemId);
        if (!item) return;

        this.editingItemId = itemId;
        document.getElementById('modal-boq-title').innerText = `Edit BOQ Item: ${item.item_code}`;
        document.getElementById('boq-form-id').value = item.id;
        document.getElementById('boq-form-code').value = item.item_code;
        document.getElementById('boq-form-division').value = item.division;
        document.getElementById('boq-form-section').value = item.section || '';
        document.getElementById('boq-form-desc').value = item.description;
        document.getElementById('boq-form-unit').value = item.unit;
        document.getElementById('boq-form-qty').value = item.quantity;
        document.getElementById('boq-form-rate').value = item.unit_rate;
        this.calcModalTotal();
        window.app.openModal('modal-boq-item');
    },

    calcModalTotal() {
        const qty = parseFloat(document.getElementById('boq-form-qty')?.value || 0);
        const rate = parseFloat(document.getElementById('boq-form-rate')?.value || 0);
        const total = qty * rate;
        const totalDisplay = document.getElementById('boq-modal-calc-total');
        if (totalDisplay) {
            totalDisplay.innerText = `$${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
    },

    async saveBOQItem() {
        const code = document.getElementById('boq-form-code')?.value;
        const desc = document.getElementById('boq-form-desc')?.value;
        const unit = document.getElementById('boq-form-unit')?.value;
        const qty = parseFloat(document.getElementById('boq-form-qty')?.value || 0);
        const rate = parseFloat(document.getElementById('boq-form-rate')?.value || 0);
        const division = document.getElementById('boq-form-division')?.value;
        const section = document.getElementById('boq-form-section')?.value;

        if (!code || !desc || !unit) {
            window.app.showToast("Please fill all required item fields (*)", "warning");
            return;
        }

        const payload = {
            item_code: code,
            division: division,
            section: section,
            description: desc,
            unit: unit,
            quantity: qty,
            unit_rate: rate,
            total_amount: round(qty * rate, 2)
        };

        if (this.editingItemId) {
            await window.app.apiPut(`/api/boq/${this.editingItemId}`, payload);
            window.app.showToast(`Updated item ${code}`, 'success');
        } else {
            await window.app.apiPost(`/api/projects/${window.app.currentProjectId}/boq`, payload);
            window.app.showToast(`Added BOQ item ${code}`, 'success');
        }

        window.app.closeModal();
        this.loadBOQ();
        window.app.refreshDashboardKPIs();
    },

    async deleteItem(itemId) {
        if (!confirm("Are you sure you want to delete this BOQ item?")) return;
        await window.app.apiDelete(`/api/boq/${itemId}`);
        window.app.showToast("Item deleted", "info");
        this.loadBOQ();
        window.app.refreshDashboardKPIs();
    }
};

function round(val, dec) {
    return Number(Math.round(val + 'e' + dec) + 'e-' + dec);
}
