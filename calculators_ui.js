/**
 * StructuraQS - Civil Engineering Takeoff & Mix Calculators
 * Real-time material breakdown for Concrete, Brickwork, Plaster, and Earthwork.
 */

window.calculatorsUI = {
    init() {
        this.recalcConcrete();
        this.recalcBrickwork();
        this.recalcPlaster();
        this.recalcEarthwork();
    },

    switchCalc(calcName) {
        document.querySelectorAll('.calc-tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.calc-content-pane').forEach(p => p.classList.remove('active'));

        const targetPane = document.getElementById(`calc-pane-${calcName}`);
        if (targetPane) targetPane.classList.add('active');

        // Highlight active tab button
        const btns = document.querySelectorAll('.calc-tab-btn');
        if (calcName === 'concrete') btns[0].classList.add('active');
        if (calcName === 'brickwork') btns[1].classList.add('active');
        if (calcName === 'plaster') btns[2].classList.add('active');
        if (calcName === 'earthwork') btns[3].classList.add('active');
    },

    async recalcConcrete() {
        const vol = parseFloat(document.getElementById('calc-conc-vol')?.value || 1.0);
        const grade = document.getElementById('calc-conc-grade')?.value || 'M20';
        const waste = parseFloat(document.getElementById('calc-conc-waste')?.value || 2.0);

        const res = await window.app.apiPost('/api/calculators/concrete', {
            wet_volume_m3: vol,
            mix_grade: grade,
            wastage_pct: waste
        });

        if (res && res.success) {
            const r = res.result;
            const container = document.getElementById('calc-conc-results');
            if (!container) return;

            container.innerHTML = `
                <div class="result-stat-box">
                    <div class="stat-label">OPC CEMENT REQUIRED</div>
                    <div class="stat-val text-accent">${r.cement.exact_bags} <span class="text-xs">Bags</span></div>
                    <div class="stat-sub">${r.cement.weight_kg} kg (~${r.cement.volume_m3} m³)</div>
                </div>
                <div class="result-stat-box">
                    <div class="stat-label">FINE AGGREGATE (M-SAND)</div>
                    <div class="stat-val">${r.fine_aggregate_sand.weight_tons} <span class="text-xs">Tons</span></div>
                    <div class="stat-sub">${r.fine_aggregate_sand.volume_m3} m³ (${r.fine_aggregate_sand.volume_cft} cft)</div>
                </div>
                <div class="result-stat-box">
                    <div class="stat-label">COARSE AGGREGATE (10-20MM)</div>
                    <div class="stat-val">${r.coarse_aggregate.weight_tons} <span class="text-xs">Tons</span></div>
                    <div class="stat-sub">${r.coarse_aggregate.volume_m3} m³ (${r.coarse_aggregate.volume_cft} cft)</div>
                </div>
                <div class="result-stat-box">
                    <div class="stat-label">ESTIMATED WATER & ADMIXTURE</div>
                    <div class="stat-val">${r.water_liters} <span class="text-xs">Liters</span></div>
                    <div class="stat-sub">${r.admixture_kg} kg Superplasticizer</div>
                </div>
            `;
        }
    },

    async recalcBrickwork() {
        const len = parseFloat(document.getElementById('calc-brick-len')?.value || 10.0);
        const ht = parseFloat(document.getElementById('calc-brick-height')?.value || 3.0);
        const thk = parseFloat(document.getElementById('calc-brick-thk')?.value || 0.23);
        const bType = document.getElementById('calc-brick-type')?.value || 'MODULAR';
        const mortar = document.getElementById('calc-brick-mortar')?.value || '1:6';
        const ded = parseFloat(document.getElementById('calc-brick-ded')?.value || 0.0);

        const res = await window.app.apiPost('/api/calculators/brickwork', {
            wall_length_m: len,
            wall_height_m: ht,
            wall_thickness_m: thk,
            brick_type: bType,
            mortar_ratio: mortar,
            deductions_m3: ded
        });

        if (res && res.success) {
            const r = res.result;
            const container = document.getElementById('calc-brick-results');
            if (!container) return;

            container.innerHTML = `
                <div class="result-stat-box">
                    <div class="stat-label">TOTAL BRICKS / BLOCKS</div>
                    <div class="stat-val text-accent">${r.total_bricks_count} <span class="text-xs">Nos</span></div>
                    <div class="stat-sub">Net Volume: ${r.net_volume_m3} m³ (5% waste)</div>
                </div>
                <div class="result-stat-box">
                    <div class="stat-label">MORTAR CEMENT</div>
                    <div class="stat-val">${r.cement_bags} <span class="text-xs">Bags</span></div>
                    <div class="stat-sub">${r.cement_kg} kg (CM ${r.mortar_ratio})</div>
                </div>
                <div class="result-stat-box">
                    <div class="stat-label">MORTAR SAND</div>
                    <div class="stat-val">${r.sand_tons} <span class="text-xs">Tons</span></div>
                    <div class="stat-sub">${r.sand_m3} m³ (${r.sand_cft} cft)</div>
                </div>
                <div class="result-stat-box">
                    <div class="stat-label">DRY MORTAR VOLUME</div>
                    <div class="stat-val">${r.dry_mortar_m3} <span class="text-xs">m³</span></div>
                    <div class="stat-sub">Wet Mortar: ${r.wet_mortar_m3} m³</div>
                </div>
            `;
        }
    },

    async recalcPlaster() {
        const area = parseFloat(document.getElementById('calc-plaster-area')?.value || 100.0);
        const thk = parseFloat(document.getElementById('calc-plaster-thk')?.value || 12.0);
        const ratio = document.getElementById('calc-plaster-ratio')?.value || '1:4';

        const res = await window.app.apiPost('/api/calculators/plastering', {
            area_m2: area,
            thickness_mm: thk,
            mortar_ratio: ratio
        });

        if (res && res.success) {
            const r = res.result;
            const container = document.getElementById('calc-plaster-results');
            if (!container) return;

            container.innerHTML = `
                <div class="result-stat-box">
                    <div class="stat-label">CEMENT REQUIRED</div>
                    <div class="stat-val text-accent">${r.cement_bags} <span class="text-xs">Bags</span></div>
                    <div class="stat-sub">${r.cement_kg} kg (15% unevenness factor)</div>
                </div>
                <div class="result-stat-box">
                    <div class="stat-label">PLASTER SAND</div>
                    <div class="stat-val">${r.sand_tons} <span class="text-xs">Tons</span></div>
                    <div class="stat-sub">${r.sand_m3} m³ (${r.sand_cft} cft)</div>
                </div>
                <div class="result-stat-box">
                    <div class="stat-label">WET PLASTER VOLUME</div>
                    <div class="stat-val">${r.wet_volume_m3} <span class="text-xs">m³</span></div>
                    <div class="stat-sub">${r.thickness_mm} mm thickness on ${r.area_m2} m²</div>
                </div>
                <div class="result-stat-box">
                    <div class="stat-label">DRY MORTAR VOLUME</div>
                    <div class="stat-val">${r.dry_volume_m3} <span class="text-xs">m³</span></div>
                    <div class="stat-sub">Dry volume factor: 1.35</div>
                </div>
            `;
        }
    },

    async recalcEarthwork() {
        const l = parseFloat(document.getElementById('calc-earth-l')?.value || 20.0);
        const w = parseFloat(document.getElementById('calc-earth-w')?.value || 15.0);
        const d = parseFloat(document.getElementById('calc-earth-d')?.value || 3.0);
        const s = parseFloat(document.getElementById('calc-earth-slope')?.value || 0.5);

        const res = await window.app.apiPost('/api/calculators/earthwork', {
            length_m: l,
            width_m: w,
            depth_m: d,
            side_slope_h_v: s
        });

        if (res && res.success) {
            const r = res.result;
            const container = document.getElementById('calc-earth-results');
            if (!container) return;

            container.innerHTML = `
                <div class="result-stat-box">
                    <div class="stat-label">IN-SITU EXCAVATION (BANK)</div>
                    <div class="stat-val text-accent">${r.in_situ_volume_m3} <span class="text-xs">m³</span></div>
                    <div class="stat-sub">Prismoidal trapezoidal formula</div>
                </div>
                <div class="result-stat-box">
                    <div class="stat-label">LOOSE HAULAGE / CARTING</div>
                    <div class="stat-val">${r.loose_disposal_m3} <span class="text-xs">m³</span></div>
                    <div class="stat-sub">Swell factor: ${r.swell_factor}</div>
                </div>
                <div class="result-stat-box">
                    <div class="stat-label">TRUCK LOADS (10M³ DUMP TRUCKS)</div>
                    <div class="stat-val">${r.truck_loads_10m3} <span class="text-xs">Trips</span></div>
                    <div class="stat-sub">Assuming 10 m³ tipper capacity</div>
                </div>
                <div class="result-stat-box">
                    <div class="stat-label">TOP EXCAVATION AREA</div>
                    <div class="stat-val">${r.top_area_m2} <span class="text-xs">m²</span></div>
                    <div class="stat-sub">Bottom area: ${r.bottom_area_m2} m²</div>
                </div>
            `;
        }
    }
};
