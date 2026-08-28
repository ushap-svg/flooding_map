/**
 * StructuraQS - 2D Vector CAD Blueprint Plan Takeoff (QTO) Engine
 * Pure Native HTML5 Canvas Vector Engine.
 */

window.qtoCanvas = {
    canvas: null,
    ctx: null,
    activeTool: 'select', // 'select', 'calibrate', 'polygon', 'polyline', 'rect', 'count'
    currentColor: '#2563eb',
    scalePxPerMeter: 80.0, // 80px = 1.0m by default
    zoomLevel: 1.0,
    panX: 0,
    panY: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,

    activePoints: [], // Points of current in-progress shape
    savedTakeoffs: [], // All completed takeoffs for this project
    customBackgroundImage: null,

    init() {
        this.canvas = document.getElementById('qto-main-canvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');

        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        this.setupEvents();
        this.loadProjectTakeoffs();
        this.render();
    },

    resizeCanvas() {
        const wrapper = document.getElementById('canvas-wrapper');
        if (!wrapper || !this.canvas) return;

        const rect = wrapper.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.render();
    },

    setupEvents() {
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('dblclick', (e) => this.onDoubleClick(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.finishCurrentShape();
            if (e.key === 'Escape') this.clearActiveDrawing();
        });
    },

    setTool(toolName) {
        this.activeTool = toolName;
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById(`tool-${toolName}`);
        if (activeBtn) activeBtn.classList.add('active');

        const instr = document.getElementById('qto-instruction-pill');
        if (toolName === 'polygon') {
            instr.innerText = "📐 Area Mode: Click on plan to add vertices. Double-click or press Enter to close polygon.";
        } else if (toolName === 'polyline') {
            instr.innerText = "📏 Wall Length Mode: Click to trace walls. Double-click to complete measurement.";
        } else if (toolName === 'rect') {
            instr.innerText = "⛶ Rect Mode: Click and drag to measure rectangular room/footing.";
        } else if (toolName === 'count') {
            instr.innerText = "📍 Count Mode: Click on structural columns, doors or fixtures to place count markers.";
        } else if (toolName === 'calibrate') {
            instr.innerText = "⚖ Calibration Mode: Click 2 reference points of known dimension (e.g. 5.0m grid).";
        } else {
            instr.innerText = "✋ Pan & Select Mode: Click and drag canvas to pan. Scroll to zoom.";
        }

        this.render();
    },

    getCanvasCoords(e) {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        // Transform based on pan and zoom
        const worldX = (screenX - this.panX) / this.zoomLevel;
        const worldY = (screenY - this.panY) / this.zoomLevel;
        return { worldX, worldY, screenX, screenY };
    },

    onMouseDown(e) {
        const coords = this.getCanvasCoords(e);

        if (this.activeTool === 'select') {
            this.isDragging = true;
            this.dragStartX = e.clientX - this.panX;
            this.dragStartY = e.clientY - this.panY;
            return;
        }

        if (this.activeTool === 'rect') {
            this.isDragging = true;
            this.activePoints = [{ x: coords.worldX, y: coords.worldY }, { x: coords.worldX, y: coords.worldY }];
            return;
        }

        if (this.activeTool === 'count') {
            this.activePoints.push({ x: coords.worldX, y: coords.worldY });
            this.updatePropertyPanelFromMeasurement(this.activePoints.length, 'nos');
            this.render();
            return;
        }

        if (this.activeTool === 'calibrate') {
            this.activePoints.push({ x: coords.worldX, y: coords.worldY });
            if (this.activePoints.length === 2) {
                const dx = this.activePoints[1].x - this.activePoints[0].x;
                const dy = this.activePoints[1].y - this.activePoints[0].y;
                const pixelDistance = Math.hypot(dx, dy);
                const realMeters = prompt("Enter real-world dimension between calibrated points (in meters):", "5.0");
                if (realMeters && !isNaN(realMeters) && parseFloat(realMeters) > 0) {
                    this.scalePxPerMeter = pixelDistance / parseFloat(realMeters);
                    const badge = document.getElementById('qto-scale-badge');
                    if (badge) badge.innerHTML = `Scale: <strong>1.00 m = ${this.scalePxPerMeter.toFixed(1)} px</strong> (Calibrated)`;
                    window.app.showToast(`Scale calibrated to ${this.scalePxPerMeter.toFixed(1)} px/m`, 'success');
                }
                this.activePoints = [];
                this.setTool('select');
            }
            this.render();
            return;
        }

        // Polygon or Polyline
        this.activePoints.push({ x: coords.worldX, y: coords.worldY });
        this.computeActiveMeasurement();
        this.render();
    },

    onMouseMove(e) {
        if (this.isDragging && this.activeTool === 'select') {
            this.panX = e.clientX - this.dragStartX;
            this.panY = e.clientY - this.dragStartY;
            this.render();
            return;
        }

        if (this.isDragging && this.activeTool === 'rect' && this.activePoints.length >= 2) {
            const coords = this.getCanvasCoords(e);
            this.activePoints[1] = { x: coords.worldX, y: coords.worldY };
            this.computeActiveMeasurement();
            this.render();
        }
    },

    onMouseUp() {
        if (this.activeTool === 'select') {
            this.isDragging = false;
        } else if (this.activeTool === 'rect' && this.isDragging) {
            this.isDragging = false;
            this.finishCurrentShape();
        }
    },

    onDoubleClick() {
        if (['polygon', 'polyline'].includes(this.activeTool)) {
            this.finishCurrentShape();
        }
    },

    onWheel(e) {
        e.preventDefault();
        const zoomDelta = e.deltaY < 0 ? 0.1 : -0.1;
        this.zoom(zoomDelta);
    },

    zoom(delta) {
        const oldZoom = this.zoomLevel;
        this.zoomLevel = Math.max(0.3, Math.min(3.0, this.zoomLevel + delta));
        const zoomPill = document.getElementById('qto-zoom-level');
        if (zoomPill) zoomPill.innerText = `${Math.round(this.zoomLevel * 100)}%`;
        this.render();
    },

    resetView() {
        this.zoomLevel = 1.0;
        this.panX = 0;
        this.panY = 0;
        const zoomPill = document.getElementById('qto-zoom-level');
        if (zoomPill) zoomPill.innerText = `100%`;
        this.render();
    },

    clearActiveDrawing() {
        this.activePoints = [];
        this.render();
    },

    computeActiveMeasurement() {
        if (this.activePoints.length === 0) return;

        if (this.activeTool === 'polygon' && this.activePoints.length >= 3) {
            // Shoelace formula in pixels -> convert to m2
            let areaPx = 0;
            const pts = this.activePoints;
            for (let i = 0; i < pts.length; i++) {
                const j = (i + 1) % pts.length;
                areaPx += pts[i].x * pts[j].y;
                areaPx -= pts[j].x * pts[i].y;
            }
            areaPx = Math.abs(areaPx) / 2.0;
            const areaM2 = areaPx / (this.scalePxPerMeter * this.scalePxPerMeter);
            this.updatePropertyPanelFromMeasurement(areaM2, 'm²');
        } else if (this.activeTool === 'polyline' && this.activePoints.length >= 2) {
            let lengthPx = 0;
            for (let i = 0; i < this.activePoints.length - 1; i++) {
                const dx = this.activePoints[i+1].x - this.activePoints[i].x;
                const dy = this.activePoints[i+1].y - this.activePoints[i].y;
                lengthPx += Math.hypot(dx, dy);
            }
            const lengthM = lengthPx / this.scalePxPerMeter;
            this.updatePropertyPanelFromMeasurement(lengthM, 'm');
        } else if (this.activeTool === 'rect' && this.activePoints.length >= 2) {
            const p1 = this.activePoints[0];
            const p2 = this.activePoints[1];
            const wPx = Math.abs(p2.x - p1.x);
            const hPx = Math.abs(p2.y - p1.y);
            const areaM2 = (wPx * hPx) / (this.scalePxPerMeter * this.scalePxPerMeter);
            this.updatePropertyPanelFromMeasurement(areaM2, 'm²');
        }
    },

    updatePropertyPanelFromMeasurement(val, unit) {
        const valInput = document.getElementById('prop-measured-val');
        const unitBadge = document.getElementById('prop-unit-badge');
        const finalUnit = document.getElementById('prop-final-unit');
        
        if (valInput) valInput.value = val.toFixed(2);
        if (unitBadge) unitBadge.innerText = unit;
        if (finalUnit) finalUnit.innerText = unit;

        this.recalcNet();
    },

    recalcNet() {
        const measured = parseFloat(document.getElementById('prop-measured-val')?.value || 0);
        const depth = parseFloat(document.getElementById('prop-depth')?.value || 0);
        const deduction = parseFloat(document.getElementById('prop-deduction')?.value || 0);
        const unit = document.getElementById('prop-unit-badge')?.innerText || 'm²';

        let net = measured;
        let finalUnitStr = unit;

        if (depth > 0 && (unit === 'm²' || unit === 'sqm')) {
            net = measured * depth;
            finalUnitStr = 'm³';
        } else if (depth > 0 && unit === 'm') {
            net = measured * depth; // e.g. wall length * wall height = wall area
            finalUnitStr = 'm²';
        }

        net = Math.max(0, net - deduction);

        const netDisplay = document.getElementById('prop-net-quantity');
        const finalUnitDisplay = document.getElementById('prop-final-unit');
        if (netDisplay) netDisplay.innerHTML = `${net.toFixed(2)} <span class="unit">${finalUnitStr}</span>`;
        if (finalUnitDisplay) finalUnitDisplay.innerText = finalUnitStr;
    },

    finishCurrentShape() {
        if (this.activePoints.length === 0) return;
        this.computeActiveMeasurement();

        const nameInput = document.getElementById('prop-takeoff-name');
        if (nameInput && !nameInput.value) {
            nameInput.value = `Takeoff Layer #${this.savedTakeoffs.length + 1} (${this.activeTool})`;
        }
        window.app.showToast("Takeoff measured. Review properties & click Save.", "info");
    },

    async saveCurrentTakeoff() {
        const name = document.getElementById('prop-takeoff-name')?.value || 'Takeoff Measurement';
        const category = document.getElementById('prop-category')?.value || 'Concrete';
        const measuredVal = parseFloat(document.getElementById('prop-measured-val')?.value || 0);
        const unit = document.getElementById('prop-unit-badge')?.innerText || 'm²';
        const depth = parseFloat(document.getElementById('prop-depth')?.value || 0);
        const deduction = parseFloat(document.getElementById('prop-deduction')?.value || 0);
        const linkedBOQ = document.getElementById('prop-link-boq')?.value || null;

        if (measuredVal <= 0 && this.activePoints.length === 0) {
            window.app.showToast("Please draw a measurement on the canvas first.", "warning");
            return;
        }

        const payload = {
            name: name,
            category: category,
            tool_type: this.activeTool,
            measured_value: measuredVal,
            unit: unit,
            depth_height: depth,
            deduction_value: deduction,
            linked_boq_id: linkedBOQ,
            geometry: { points: this.activePoints },
            color: this.currentColor
        };

        const res = await window.app.apiPost(`/api/projects/${window.app.currentProjectId}/qto`, payload);
        if (res && res.success) {
            window.app.showToast(`Takeoff saved & synced to BOQ (${res.net_quantity} ${unit})`, 'success');
            this.activePoints = [];
            this.loadProjectTakeoffs();
            window.app.loadProjectData(); // Refresh BOQ table
        }
    },

    async loadProjectTakeoffs() {
        const res = await window.app.apiGet(`/api/projects/${window.app.currentProjectId}/qto`);
        if (res && res.success) {
            this.savedTakeoffs = res.takeoffs || [];
            this.renderTakeoffListUI();
            this.render();
        }
    },

    renderTakeoffListUI() {
        const container = document.getElementById('saved-takeoff-list');
        const badge = document.getElementById('takeoff-count-badge');
        if (badge) badge.innerText = this.savedTakeoffs.length;
        if (!container) return;

        if (this.savedTakeoffs.length === 0) {
            container.innerHTML = `<div class="text-muted text-xs text-center p-4">No measurements recorded on this blueprint yet.</div>`;
            return;
        }

        container.innerHTML = this.savedTakeoffs.map(t => `
            <div class="takeoff-item-card">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div class="takeoff-color-dot" style="background: ${t.color || '#2563eb'};"></div>
                    <div>
                        <div class="font-semibold text-xs">${t.name}</div>
                        <div class="text-muted" style="font-size: 10px;">${t.category} • ${t.net_quantity} ${t.unit}</div>
                    </div>
                </div>
                <button class="btn-close" onclick="window.qtoCanvas.deleteTakeoff('${t.id}')" title="Delete Takeoff">×</button>
            </div>
        `).join('');
    },

    async deleteTakeoff(id) {
        if (!confirm("Are you sure you want to delete this takeoff measurement?")) return;
        const res = await window.app.apiDelete(`/api/qto/${id}`);
        if (res && res.success) {
            window.app.showToast("Takeoff deleted", "info");
            this.loadProjectTakeoffs();
            window.app.loadProjectData();
        }
    },

    loadSamplePlan() {
        this.customBackgroundImage = null;
        this.resetView();
        window.app.showToast("Loaded Architectural Plan Benchmark", "info");
    },

    loadUserPlan(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.customBackgroundImage = img;
                this.resetView();
                window.app.showToast("Custom Architectural Drawing Loaded", "success");
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    /**
     * Master Canvas Rendering Loop
     */
    render() {
        if (!this.ctx || !this.canvas) return;
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.clearRect(0, 0, w, h);

        ctx.save();
        // Apply Pan and Zoom
        ctx.translate(this.panX, this.panY);
        ctx.scale(this.zoomLevel, this.zoomLevel);

        // 1. Draw Architectural Blueprint / CAD Plan
        if (this.customBackgroundImage) {
            ctx.drawImage(this.customBackgroundImage, 0, 0);
        } else {
            this.drawProceduralCADBlueprint(ctx);
        }

        // 2. Draw Saved Takeoffs
        this.savedTakeoffs.forEach(t => {
            if (t.geometry && t.geometry.points && t.geometry.points.length > 0) {
                this.drawShape(ctx, t.tool_type, t.geometry.points, t.color || '#2563eb', true, `${t.name}: ${t.net_quantity} ${t.unit}`);
            }
        });

        // 3. Draw Active In-Progress Shape
        if (this.activePoints.length > 0) {
            this.drawShape(ctx, this.activeTool, this.activePoints, this.currentColor, false, "In Progress");
        }

        ctx.restore();
    },

    /**
     * Generates a realistic high-definition Architectural CAD Blueprint.
     */
    drawProceduralCADBlueprint(ctx) {
        // Blueprint background grid
        const gridW = 900;
        const gridH = 650;

        ctx.fillStyle = '#0a101d';
        ctx.fillRect(0, 0, gridW, gridH);

        // Grid lines (1m grid)
        const gridStep = this.scalePxPerMeter;
        ctx.strokeStyle = 'rgba(30, 58, 138, 0.25)';
        ctx.lineWidth = 1;

        for (let x = 0; x <= gridW; x += gridStep) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, gridH);
            ctx.stroke();
        }
        for (let y = 0; y <= gridH; y += gridStep) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(gridW, y);
            ctx.stroke();
        }

        // External Concrete Perimeter Walls
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 4;
        ctx.strokeRect(80, 60, 740, 520);

        // Internal Rooms & Partitions
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#93c5fd';

        // Core / Elevator Shaft & Stairwell
        ctx.strokeRect(360, 220, 180, 200);
        ctx.fillStyle = 'rgba(37, 99, 235, 0.15)';
        ctx.fillRect(360, 220, 180, 200);

        // Office Unit 1
        ctx.strokeRect(80, 60, 280, 240);
        // Office Unit 2
        ctx.strokeRect(540, 60, 280, 240);
        // Conference Hall
        ctx.strokeRect(80, 300, 280, 280);
        // Open Workspace / Terrace
        ctx.strokeRect(540, 300, 280, 280);

        // Heavy Structural Columns (800x800mm -> ~64px)
        const colCoords = [
            [80, 60], [360, 60], [540, 60], [820, 60],
            [80, 300], [360, 220], [540, 220], [820, 300],
            [80, 420], [360, 420], [540, 420], [820, 420],
            [80, 580], [360, 580], [540, 580], [820, 580]
        ];

        colCoords.forEach(([cx, cy]) => {
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(cx - 10, cy - 10, 20, 20);
            ctx.strokeStyle = '#fca5a5';
            ctx.lineWidth = 1;
            ctx.strokeRect(cx - 10, cy - 10, 20, 20);
        });

        // Room Labels & Dimensions
        ctx.fillStyle = '#cbd5e1';
        ctx.font = 'bold 12px -apple-system, sans-serif';
        ctx.fillText('EXECUTIVE SUITE 101 (3.5m x 3.0m)', 100, 180);
        ctx.fillText('BOARDROOM SUITE 102 (3.5m x 3.0m)', 560, 180);
        ctx.fillText('CENTRAL RCC CORE / LIFTS', 380, 320);
        ctx.fillText('OPEN COLLABORATIVE STUDIO (3.5m x 3.5m)', 100, 450);
        ctx.fillText('RETAIL & LOUNGE SUITE 103', 560, 450);

        // Drawing Title Block
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(80, 595, 740, 40);
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.strokeRect(80, 595, 740, 40);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px -apple-system, sans-serif';
        ctx.fillText('ARCHITECTURAL GENERAL ARRANGEMENT PLAN | LEVEL 01 TYPICAL FLOOR | SCALE 1:100', 100, 620);
    },

    drawShape(ctx, toolType, pts, color, isFilled, labelText) {
        if (!pts || pts.length === 0) return;

        ctx.strokeStyle = color;
        ctx.fillStyle = `${color}40`; // 25% alpha fill
        ctx.lineWidth = 2;

        if (toolType === 'polygon' || (toolType === 'rect' && pts.length >= 2)) {
            ctx.beginPath();
            if (toolType === 'rect') {
                const p1 = pts[0];
                const p2 = pts[1];
                ctx.rect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
            } else {
                ctx.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length; i++) {
                    ctx.lineTo(pts[i].x, pts[i].y);
                }
                if (isFilled) ctx.closePath();
            }
            if (isFilled) ctx.fill();
            ctx.stroke();

            // Vertices
            pts.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
            });

            // Label
            if (labelText) {
                const center = pts[0];
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 11px -apple-system, sans-serif';
                ctx.fillText(labelText, center.x + 8, center.y - 8);
            }
        } else if (toolType === 'polyline' || toolType === 'calibrate') {
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) {
                ctx.lineTo(pts[i].x, pts[i].y);
            }
            ctx.stroke();

            pts.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
            });

            if (labelText) {
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 11px -apple-system, sans-serif';
                ctx.fillText(labelText, pts[0].x + 8, pts[0].y - 8);
            }
        } else if (toolType === 'count') {
            pts.forEach((p, idx) => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.stroke();

                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 10px var(--font-mono)';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(idx + 1, p.x, p.y);
            });
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
        }
    }
};
