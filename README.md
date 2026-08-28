# StructuraQS - Construction Quantity Surveyor & Cost Engineering SaaS Platform

**StructuraQS** is an enterprise-grade, offline-first construction cost management and quantity surveying platform designed for **Quantity Surveyors (PQS / Contractor QS)**, **Civil & Site Engineers**, **Contractors**, **Estimators**, **Architects**, and **Construction Executives**.

Runs **100% locally with zero external API dependencies**.

---

## 🏗️ Core Engineering & QS Capabilities

### 1. Interactive 2D Blueprint Plan Takeoff Engine (QTO)
- **Vector CAD Canvas**: Calibrate real-world scale (e.g., $1.0\text{ m} = 80\text{ px}$) against any uploaded blueprint or built-in architectural plans.
- **Measurement Tools**: Polygon Area ($m^2$), Polyline Wall Length ($m$), Point Count Markers (Columns, Doors, Fixtures), Rectangular Slabs.
- **Depth & Height Multipliers**: Real-time conversion to volume ($m^3$) for concrete slabs and excavation pits.
- **Deduction Engine**: Automatic deduction of door/window openings and escalator voids.
- **Direct BOQ Synchronization**: 1-click binding from measured drawing takeoff directly into BOQ line items.

### 2. Standard Bill of Quantities (BOQ) Studio
- **Standard Measurement Methods**: Complies with SMM7, NRM2, IS 1200, POMI, and CESMM4 standard division hierarchies:
  - *Division 01: Preliminaries & General Requirements*
  - *Division 02: Substructure & Earthwork*
  - *Division 03: Superstructure RCC & Formwork*
  - *Division 04: Masonry & Partitions*
  - *Division 05: Plastering & Architectural Finishes*
  - *Division 06: Doors, Windows & Curtain Wall Facades*
  - *Division 07: Mechanical, Electrical & Plumbing (MEP)*
  - *Division 08: External Works & Infrastructure*
- **Inline Spreadsheet Grid**: Fast inline editing of quantities and unit rates with automatic division recalculations.
- **Multi-Tab Excel Export**: Full formatted `.xlsx` workbook generation with Executive Summary, Itemized BOQ, and Rate Buildup Breakdown.

### 3. Bar Bending Schedule (BBS) Engine
- **Civil Code Compliance**: IS 2502 & BS 8666 standard rebar shapes (Straight, L-Bend $90^\circ$, U-Shape $180^\circ$, Cranked/Bent-up Slab Bar $45^\circ$, Rectangular Stirrups with $135^\circ$ seismic hooks, Circular Links, Spacer Chair Bars).
- **Unit Weight Matrix**: Calculated via $W = \frac{D^2}{162.2}\text{ kg/m}$ across all standard diameters ($\Phi 8, 10, 12, 16, 20, 25, 32\text{ mm}$).
- **Automated Bend Deductions**:
  - $45^\circ\text{ bend} = 1d$
  - $90^\circ\text{ bend} = 2d$
  - $135^\circ\text{ hook} = 3d$
- **Tonnage Aggregation**: Instant metric tonne breakdown and diameter distribution charts.

### 4. Civil Engineering Mix & Takeoff Calculators
- **Concrete & Formwork Mix Calculator**: Nominal and Design mixes (M10, M15, M20, M25, M30, M35) using dry volume factor ($1.54$) to calculate exact cement bags ($50\text{ kg}$), fine aggregate sand ($m^3$ & tons), coarse aggregate ($m^3$ & tons), and superplasticizer.
- **Brickwork & AAC Blockwork Calculator**: Calculates brick count, wet mortar volume, and dry mortar ($1.33$ multiplier) with cement bags and sand tons across CM 1:3, 1:4, 1:6 ratios.
- **Plastering & Finishes Calculator**: 6mm ceiling, 12mm single coat, and 20mm external double coat plaster calculations with $1.35$ dry volume factor and $15\%$ unevenness allowance.
- **Earthwork & Excavation Calculator**: Trapezoidal pit/trench excavation with side slopes ($H:V$), swell factors ($1.20$), and dump truck haulage trips.

### 5. Detailed Unit Price Rate Analysis (DUPR)
- **Granular Cost Buildup**: Material prime costs + wastage %, Skilled/Unskilled labor days, Machinery & equipment hire rates, Water & electricity sundries ($1.5\%$), Overheads ($5\%$), Contractor's Profit ($10\%$), and Contingency ($1\%$).
- **Live Sync**: Automatically updates BOQ rates when unit rate analysis is saved.

### 6. Valuations, Interim Payment Certificates (IPC) & Variations
- **Progress Valuations**: Monthly billing with Gross Cumulative, Previous Billed, and Current Period valuation.
- **Contractual Deductions**: Retention money holdback ($5\%$), Mobilization Advance recovery ($10\%$), and Withholding Tax ($5\%$).
- **Variation Register**: Tracks Scope Additions, Omissions, Star Items, and Time Extension claims with financial impact auditing.

### 7. Earned Value Management (EVM) & S-Curve Analytics
- **PMI Standards**: Planned Value (PV), Earned Value (EV), Actual Cost (AC), Cost Variance (CV), Schedule Variance (SV), CPI, SPI, Estimate at Completion (EAC), Variance at Completion (VAC), and TCPI.
- **Zero-Dependency Charts**: Custom HTML5 Canvas S-Curves and Cost Doughnut charts.

---

## 🚀 Quick Start Guide

### Launch Application
```bash
python run.py
```
This starts the local Flask server on `http://127.0.0.1:5000` and automatically opens your web browser.

### Run Verification Test Suite
```bash
python test_qs.py
```
Runs 100% offline verification across all civil calculation formulas, SQLite queries, REST endpoints, and Excel generation.
