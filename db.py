"""
Database Layer & Seed Data for StructuraQS
Persistent SQLite database with comprehensive Civil Construction schema and realistic demo dataset.
"""

import sqlite3
import json
import os
from typing import Dict, List, Any, Optional

DB_FILE = os.path.join(os.path.dirname(__file__), "structura_qs.db")

def get_db_connection():
    """Returns a SQLite connection with row factory enabled."""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes the database schema and seeds initial benchmark project if empty."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Projects Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        client TEXT,
        contractor TEXT,
        consultant TEXT,
        project_type TEXT,
        location TEXT,
        currency TEXT DEFAULT '$',
        contract_sum REAL DEFAULT 0.0,
        start_date TEXT,
        target_completion TEXT,
        retention_pct REAL DEFAULT 5.0,
        advance_recovery_pct REAL DEFAULT 10.0,
        tax_pct REAL DEFAULT 5.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 2. BOQ Items Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS boq_items (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        item_code TEXT NOT NULL,
        division TEXT NOT NULL,
        section TEXT,
        description TEXT NOT NULL,
        unit TEXT NOT NULL,
        quantity REAL DEFAULT 0.0,
        unit_rate REAL DEFAULT 0.0,
        total_amount REAL DEFAULT 0.0,
        material_rate REAL DEFAULT 0.0,
        labor_rate REAL DEFAULT 0.0,
        equipment_rate REAL DEFAULT 0.0,
        subcontractor_rate REAL DEFAULT 0.0,
        overhead_profit_pct REAL DEFAULT 15.0,
        source_takeoff_id TEXT,
        sort_order INTEGER DEFAULT 0,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
    )
    """)

    # 3. 2D Plan QTO Measurements Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS qto_measurements (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        tool_type TEXT NOT NULL, -- 'polygon_area', 'polyline_length', 'point_count', 'rectangle'
        drawing_name TEXT DEFAULT 'Ground Floor Plan - Arch Rev 2',
        measured_value REAL DEFAULT 0.0,
        unit TEXT NOT NULL,
        multiplier REAL DEFAULT 1.0,
        depth_height REAL DEFAULT 0.0,
        calculated_quantity REAL DEFAULT 0.0,
        deduction_value REAL DEFAULT 0.0,
        net_quantity REAL DEFAULT 0.0,
        linked_boq_id TEXT,
        geometry_json TEXT,
        color TEXT DEFAULT '#2563eb',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
    )
    """)

    # 4. Bar Bending Schedule (BBS) Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS bbs_items (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        member_name TEXT NOT NULL, -- e.g. 'Footing F1 (2.4x2.4m)', 'Column C1 Ground Flr', 'Beam B101'
        bar_mark TEXT NOT NULL,    -- e.g. 'B1', 'T1', 'S1'
        shape_code TEXT NOT NULL,  -- 'STRAIGHT', 'L_BEND', 'U_SHAPE', 'CRANK_SLAB', 'RECT_STIRRUP', etc.
        diameter_mm REAL NOT NULL,
        dimensions_json TEXT,      -- {"a": 2.2, "b": 0.3, "h": 0.15, "hook": 0.12}
        num_members INTEGER DEFAULT 1,
        bars_per_member INTEGER DEFAULT 1,
        total_bars INTEGER DEFAULT 1,
        cut_length_m REAL DEFAULT 0.0,
        total_length_m REAL DEFAULT 0.0,
        unit_weight_kg_m REAL DEFAULT 0.0,
        total_weight_kg REAL DEFAULT 0.0,
        total_weight_mt REAL DEFAULT 0.0,
        notes TEXT,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
    )
    """)

    # 5. Rate Analyses (DUPR) Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS rate_analyses (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        item_code TEXT NOT NULL,
        title TEXT NOT NULL,
        unit TEXT NOT NULL,
        batch_output_qty REAL DEFAULT 1.0,
        materials_json TEXT,
        labors_json TEXT,
        equipment_json TEXT,
        subcontractor_cost REAL DEFAULT 0.0,
        water_sundries_pct REAL DEFAULT 1.5,
        overhead_pct REAL DEFAULT 5.0,
        profit_pct REAL DEFAULT 10.0,
        contingency_pct REAL DEFAULT 1.0,
        calculated_unit_rate REAL DEFAULT 0.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
    )
    """)

    # 6. Interim Payment Certificates (IPC) Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ipc_certificates (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        cert_number INTEGER NOT NULL,
        period_start TEXT,
        period_end TEXT,
        submission_date TEXT,
        status TEXT DEFAULT 'APPROVED', -- 'DRAFT', 'SUBMITTED', 'CERTIFIED', 'PAID'
        gross_work_this_period REAL DEFAULT 0.0,
        gross_work_cumulative REAL DEFAULT 0.0,
        retention_deducted REAL DEFAULT 0.0,
        advance_recovered REAL DEFAULT 0.0,
        tax_deducted REAL DEFAULT 0.0,
        other_deductions REAL DEFAULT 0.0,
        net_payable_this_period REAL DEFAULT 0.0,
        line_items_json TEXT,
        notes TEXT,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
    )
    """)

    # 7. Variations (Change Orders) Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS variations (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        vo_number TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT DEFAULT 'ADDITION', -- 'ADDITION', 'OMISSION', 'STAR_ITEM', 'RATE_REVISION'
        amount REAL DEFAULT 0.0,
        time_extension_days INTEGER DEFAULT 0,
        status TEXT DEFAULT 'APPROVED', -- 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'
        requested_date TEXT,
        approved_date TEXT,
        justification TEXT,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
    )
    """)

    # 8. Material Master Price Catalog
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS material_master (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        material_name TEXT NOT NULL,
        unit TEXT NOT NULL,
        standard_rate REAL DEFAULT 0.0,
        supplier TEXT,
        density_kg_m3 REAL,
        standard_wastage_pct REAL DEFAULT 3.0
    )
    """)

    # 9. EVM Periods Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS evm_periods (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        month_index INTEGER NOT NULL,
        period_label TEXT NOT NULL,
        planned_value REAL DEFAULT 0.0,
        earned_value REAL DEFAULT 0.0,
        actual_cost REAL DEFAULT 0.0,
        cpi REAL DEFAULT 1.0,
        spi REAL DEFAULT 1.0,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
    )
    """)

    conn.commit()

    # Check if project already exists, if not, seed realistic flagship project
    cursor.execute("SELECT COUNT(*) FROM projects")
    count = cursor.fetchone()[0]
    if count == 0:
        seed_flagship_data(conn)

    conn.close()


def seed_flagship_data(conn):
    """Populates realistic construction project data."""
    cursor = conn.cursor()

    # 1. Project
    proj_id = "proj-skyline-01"
    contract_sum = 4850000.00
    cursor.execute("""
    INSERT INTO projects (id, name, code, client, contractor, consultant, project_type, location, currency, contract_sum, start_date, target_completion, retention_pct, advance_recovery_pct, tax_pct)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        proj_id,
        "Skyline Grand Horizon Towers & Plaza",
        "PRJ-2026-SK01",
        "Apex Horizon Real Estate Corp.",
        "Structura Builders & Infra Ltd.",
        "Stantec Engineering & Cost Consultants",
        "Commercial & High-Rise Mixed-Use (2B+G+18 Floors)",
        "Financial District, Sector 62",
        "$",
        contract_sum,
        "2026-01-15",
        "2027-10-30",
        5.0,
        10.0,
        5.0
    ))

    # 2. Material Master
    materials_catalog = [
        ("mat-01", "Cement & Binders", "OPC 53 Grade Cement (50kg Bag)", "bag", 7.50, "UltraTech / Lafarge", 1440.0, 2.0),
        ("mat-02", "Aggregates", "Manufactured Sand (M-Sand Fine Aggregate)", "m3", 38.00, "Apex Quarry Supplies", 1600.0, 3.0),
        ("mat-03", "Aggregates", "Coarse Aggregate 20mm Crushed Stone", "m3", 42.00, "Apex Quarry Supplies", 1500.0, 3.0),
        ("mat-04", "Aggregates", "Coarse Aggregate 10mm Crushed Stone", "m3", 45.00, "Apex Quarry Supplies", 1500.0, 3.0),
        ("mat-05", "Steel Reinforcement", "TMT Fe500D High Yield Rebar (8mm-32mm)", "ton", 780.00, "Tata Tiscon / ArcelorMittal", 7850.0, 4.0),
        ("mat-06", "Masonry", "Standard Clay Modular Bricks (190x90x90mm)", "1000 nos", 120.00, "City Clay Kilns", 1800.0, 5.0),
        ("mat-07", "Masonry", "Autoclaved Aerated Concrete (AAC) Blocks 600x200x150", "m3", 65.00, "Aerocon Blocks", 600.0, 3.0),
        ("mat-08", "Finishes", "Vitrified Anti-Skid Floor Tiles 600x600mm", "m2", 18.50, "Somany / Johnson Ceramics", 2200.0, 5.0),
        ("mat-09", "Finishes", "Premium Interior Acrylic Emulsion Paint", "liter", 8.20, "Asian Paints Royale", 1250.0, 4.0),
        ("mat-10", "Waterproofing", "Elastomeric SBS Bituminous Waterproofing Membrane", "m2", 12.00, "Fosroc / Sika", 1100.0, 5.0)
    ]
    for mat in materials_catalog:
        cursor.execute("""
        INSERT INTO material_master (id, category, material_name, unit, standard_rate, supplier, density_kg_m3, standard_wastage_pct)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, mat)

    # 3. Bill of Quantities (BOQ) Items (Industry Standard Divisions)
    boq_items_seed = [
        # Division 01: Preliminaries & General
        ("boq-01", proj_id, "01.01", "01. PRELIMINARIES & GENERAL", "Site Establishment", "Mobilization, site hoarding, temporary access roads, client site office, survey control & safety compliance", "ls", 1.0, 45000.00, 45000.00, 15000.00, 18000.00, 7000.00, 0.0, 15.0, 1),
        ("boq-02", proj_id, "01.02", "01. PRELIMINARIES & GENERAL", "Insurances & Permits", "Contractor All Risk (CAR) insurance, workmen compensation, third-party liability & environmental permits", "ls", 1.0, 28000.00, 28000.00, 0.0, 0.0, 0.0, 28000.00, 0.0, 2),
        
        # Division 02: Earthwork & Substructure
        ("boq-03", proj_id, "02.01", "02. SUBSTRUCTURE & EARTHWORK", "Bulk Excavation", "Bulk excavation in all classes of soil/soft rock for double basement, including dewatering, shoring & carting away within 10km", "m3", 14500.0, 16.50, 239250.00, 0.0, 4.50, 10.00, 0.0, 15.0, 3),
        ("boq-04", proj_id, "02.02", "02. SUBSTRUCTURE & EARTHWORK", "Anti-Termite Treatment", "Subterranean chemical anti-termite treatment under rafts, column pits and perimeter plinth walls with 10-yr warranty", "m2", 3200.0, 4.20, 13440.00, 2.50, 1.20, 0.0, 0.0, 12.0, 4),
        ("boq-05", proj_id, "02.03", "02. SUBSTRUCTURE & EARTHWORK", "PCC Levelling Course", "Plain Cement Concrete M10 (1:3:6) in 100mm thick mud-mat under raft foundation and isolated footings", "m3", 420.0, 88.00, 36960.00, 62.00, 18.00, 4.00, 0.0, 15.0, 5),
        ("boq-06", proj_id, "02.04", "02. SUBSTRUCTURE & EARTHWORK", "Raft Foundation Concrete M30", "Reinforced cement concrete M30 in 1200mm thick foundation raft, retaining walls and sump tanks including curing & admixtures", "m3", 1850.0, 142.00, 262700.00, 102.00, 24.00, 8.00, 0.0, 15.0, 6),
        ("boq-07", proj_id, "02.05", "02. SUBSTRUCTURE & EARTHWORK", "Substructure Rebar Fe500D", "Providing, cutting, bending, hoisting and tying high yield TMT Fe500D rebar in raft foundation, grade beams and basement walls", "ton", 210.0, 1050.00, 220500.00, 810.00, 140.00, 30.00, 0.0, 15.0, 7),

        # Division 03: Superstructure Reinforced Concrete
        ("boq-08", proj_id, "03.01", "03. SUPERSTRUCTURE RCC", "Columns RCC M35", "RCC M35 grade design mix in circular and rectangular columns from ground floor to 18th floor with micro-silica and pumpable slump", "m3", 920.0, 168.00, 154560.00, 118.00, 32.00, 9.00, 0.0, 15.0, 8),
        ("boq-09", proj_id, "03.02", "03. SUPERSTRUCTURE RCC", "Beams & Slabs RCC M25", "RCC M25 grade in post-tensioned / RCC floor slabs, transfer girders, drops and cantilevers", "m3", 3400.0, 148.00, 503200.00, 105.00, 28.00, 7.00, 0.0, 15.0, 9),
        ("boq-10", proj_id, "03.03", "03. SUPERSTRUCTURE RCC", "Superstructure Rebar Fe500D", "High yield TMT Fe500D rebar reinforcement in all superstructure columns, beams, shear walls and slabs as per BBS", "ton", 440.0, 1080.00, 475200.00, 810.00, 170.00, 30.00, 0.0, 15.0, 10),
        ("boq-11", proj_id, "03.04", "03. SUPERSTRUCTURE RCC", "Engineered Formwork Shuttering", "Film-faced marine plywood formwork with aluminium staging, props and adjustable jacks for fair-faced concrete finish", "m2", 16800.0, 22.50, 378000.00, 8.50, 11.50, 1.50, 0.0, 15.0, 11),

        # Division 04: Masonry & Partition Walls
        ("boq-12", proj_id, "04.01", "04. MASONRY & PARTITIONS", "External Blockwork 200mm", "200mm thick AAC block masonry in external facade walls using polymer-modified thin bed adhesive jointing", "m3", 1150.0, 98.00, 112700.00, 72.00, 18.00, 2.00, 0.0, 15.0, 12),
        ("boq-13", proj_id, "04.02", "04. MASONRY & PARTITIONS", "Internal Brickwork 115mm", "115mm thick modular brick masonry in cement mortar 1:4 with 2-nos 6mm MS rebar at every 3rd course for stability", "m2", 6400.0, 19.80, 126720.00, 12.80, 5.80, 0.50, 0.0, 15.0, 13),

        # Division 05: Plastering & Architectural Finishes
        ("boq-14", proj_id, "05.01", "05. PLASTERING & FINISHES", "Internal Plaster 12mm CM 1:4", "12mm thick internal smooth cement plaster on blockwork and RCC ceiling/walls in cement mortar 1:4 with sponge finish", "m2", 19200.0, 8.40, 161280.00, 3.80, 4.00, 0.20, 0.0, 15.0, 14),
        ("boq-15", proj_id, "05.02", "05. PLASTERING & FINISHES", "External Sand-Faced Plaster 20mm", "20mm thick double coat sand-faced water-proof cement plaster on external surfaces with drip moulds and groove lines", "m2", 7800.0, 14.50, 113100.00, 6.20, 7.20, 0.40, 0.0, 15.0, 15),
        ("boq-16", proj_id, "05.03", "05. PLASTERING & FINISHES", "Vitrified Tile Flooring 600x600", "Laying 600x600mm double-charged vitrified floor tiles with polymer adhesive, epoxy grouting and 100mm skirting", "m2", 8500.0, 34.00, 289000.00, 22.00, 10.00, 0.50, 0.0, 15.0, 16),
        ("boq-17", proj_id, "05.04", "05. PLASTERING & FINISHES", "Granite Stone Cladding & Treads", "20mm thick polished Jet Black granite stone on main staircase treads, risers, lift fascias and entrance lobby", "m2", 1250.0, 68.00, 85000.00, 48.00, 16.00, 1.50, 0.0, 15.0, 17),
        ("boq-18", proj_id, "05.05", "05. PLASTERING & FINISHES", "Premium Acrylic Painting", "Applying 2 coats of acrylic wall putty, 1 coat water-thinnable primer and 2 coats of premium interior emulsion paint", "m2", 19200.0, 6.80, 130560.00, 3.90, 2.50, 0.10, 0.0, 15.0, 18),

        # Division 06: Doors, Windows & Glazing
        ("boq-19", proj_id, "06.01", "06. DOORS, WINDOWS & FACADE", "Aluminium Curtain Wall & Windows", "Powder-coated thermal-break aluminium window systems with 6mm+12A+6mm double glazed Low-E toughened glass", "m2", 2400.0, 185.00, 444000.00, 120.00, 35.00, 5.00, 15.0, 15.0, 19),
        ("boq-20", proj_id, "06.02", "06. DOORS, WINDOWS & FACADE", "Fire-Rated Steel & Flush Doors", "2-hour fire-rated galvanised steel double doors for stairwell shafts and teak-finish solid core flush doors for units", "nos", 360.0, 380.00, 136800.00, 280.00, 65.00, 5.00, 0.0, 15.0, 20),

        # Division 07: MEP Services
        ("boq-21", proj_id, "07.01", "07. MECHANICAL, ELECTRICAL & PLUMBING", "Electrical Conduiting & Wiring", "FRLS copper wiring, recessed PVC conduits, modular switches, DBs and main LT distribution panels", "ls", 1.0, 385000.00, 385000.00, 210000.00, 120000.00, 15000.00, 0.0, 15.0, 21),
        ("boq-22", proj_id, "07.02", "07. MECHANICAL, ELECTRICAL & PLUMBING", "Sanitary & Water Supply Piping", "CPVC/UPVC water supply rings, hydro-pneumatic booster pumps, soil & waste drainage stacks, sanitary fixtures", "ls", 1.0, 290000.00, 290000.00, 160000.00, 95000.00, 10000.00, 0.0, 15.0, 22),
        ("boq-23", proj_id, "07.03", "07. MECHANICAL, ELECTRICAL & PLUMBING", "Fire Fighting & Sprinkler System", "Automatic wet-riser sprinkler network, fire pumps, yard hydrants, hose reels and smoke detection integration", "ls", 1.0, 210000.00, 210000.00, 125000.00, 62000.00, 8000.00, 0.0, 15.0, 23),

        # Division 08: External Works & Landscaping
        ("boq-24", proj_id, "08.01", "08. EXTERNAL WORKS & INFRASTRUCTURE", "Interlocking Paver Driveways", "80mm thick heavy-duty M40 interlocking concrete paver blocks over 250mm WMM sub-base and compacted sand bed", "m2", 3100.0, 26.00, 80600.00, 17.50, 6.80, 0.50, 0.0, 15.0, 24),
        ("boq-25", proj_id, "08.02", "08. EXTERNAL WORKS & INFRASTRUCTURE", "Boundary Wall & Landscaped Greens", "RCC framed perimeter boundary wall with security fencing, automated gates, turfing and exterior illumination", "ls", 1.0, 95000.00, 95000.00, 52000.00, 30000.00, 5000.00, 0.0, 15.0, 25)
    ]

    for item in boq_items_seed:
        cursor.execute("""
        INSERT INTO boq_items (id, project_id, item_code, division, section, description, unit, quantity, unit_rate, total_amount, material_rate, labor_rate, equipment_rate, subcontractor_rate, overhead_profit_pct, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, item)

    # 4. Bar Bending Schedule (BBS) Seed Data
    bbs_seed = [
        ("bbs-01", proj_id, "Combined Footing CF-01 (4.5m x 3.0m x 0.8m)", "B-01", "STRAIGHT", 20.0, json.dumps({"a": 4.30}), 6, 24, 144, 4.30, 619.2, 2.47, 1529.42, 1.529, "Bottom main reinforcement in X-direction with 50mm cover"),
        ("bbs-02", proj_id, "Combined Footing CF-01 (4.5m x 3.0m x 0.8m)", "B-02", "STRAIGHT", 16.0, json.dumps({"a": 2.80}), 6, 36, 216, 2.80, 604.8, 1.58, 955.58, 0.956, "Bottom distribution rebar in Y-direction"),
        ("bbs-03", proj_id, "Columns C1 to C12 (Ground to 1st Floor)", "C-VERT-01", "L_BEND", 25.0, json.dumps({"a": 3.85, "b": 0.45}), 12, 12, 144, 4.25, 612.0, 3.85, 2356.20, 2.356, "Main vertical rebar with 450mm lap/bend into footing"),
        ("bbs-04", proj_id, "Columns C1 to C12 (Ground to 1st Floor)", "C-TIE-01", "RECT_STIRRUP", 10.0, json.dumps({"a": 0.50, "b": 0.50}), 12, 28, 336, 2.12, 712.3, 0.62, 441.63, 0.442, "Column lateral ties @ 125mm c/c with 135-deg seismic hooks"),
        ("bbs-05", proj_id, "Main Transfer Girder TG-01 (Span 8.2m, 600x900mm)", "TG-BOT-01", "L_BEND", 32.0, json.dumps({"a": 8.50, "b": 0.60}), 4, 8, 32, 9.04, 289.3, 6.31, 1825.48, 1.825, "Bottom tensile reinforcement in heavy transfer beam"),
        ("bbs-06", proj_id, "Main Transfer Girder TG-01 (Span 8.2m, 600x900mm)", "TG-STR-01", "RECT_STIRRUP", 12.0, json.dumps({"a": 0.52, "b": 0.82}), 4, 60, 240, 2.82, 676.8, 0.89, 602.35, 0.602, "4-legged shear stirrups @ 100mm near supports"),
        ("bbs-07", proj_id, "Typical Floor Slab S-01 (6.0m x 4.5m x 150mm)", "SL-CRK-01", "CRANK_SLAB", 10.0, json.dumps({"a": 5.85, "h": 0.09, "hook": 0.10}), 18, 32, 576, 6.08, 3502.1, 0.62, 2171.30, 2.171, "45-degree bent-up tensile rebar over supports"),
        ("bbs-08", proj_id, "Typical Floor Slab S-01 (6.0m x 4.5m x 150mm)", "SL-DIST-01", "STRAIGHT", 8.0, json.dumps({"a": 4.35}), 18, 40, 720, 4.35, 3132.0, 0.395, 1237.14, 1.237, "Top and bottom distribution steel @ 150mm c/c")
    ]
    for b in bbs_seed:
        cursor.execute("""
        INSERT INTO bbs_items (id, project_id, member_name, bar_mark, shape_code, diameter_mm, dimensions_json, num_members, bars_per_member, total_bars, cut_length_m, total_length_m, unit_weight_kg_m, total_weight_kg, total_weight_mt, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, b)

    # 5. QTO 2D Blueprint Plan Measurements Seed Data
    qto_seed = [
        ("qto-01", proj_id, "Tower Core Foundation Slab Raft", "Concrete", "polygon_area", "Ground Floor Plan - Arch Rev 2", 485.0, "m2", 1.0, 1.2, 582.0, 0.0, 582.0, "boq-06", json.dumps({"points": [{"x": 120, "y": 80}, {"x": 450, "y": 80}, {"x": 450, "y": 320}, {"x": 120, "y": 320}]}), "#2563eb", "Measured from grid lines A1 to F4"),
        ("qto-02", proj_id, "External Perimeter Facade Wall Plaster", "Finishes", "polyline_length", "Ground Floor Plan - Arch Rev 2", 185.0, "m", 1.0, 3.6, 666.0, 48.0, 618.0, "boq-15", json.dumps({"points": [{"x": 100, "y": 60}, {"x": 580, "y": 60}, {"x": 580, "y": 420}, {"x": 100, "y": 420}, {"x": 100, "y": 60}]}), "#10b981", "Deducted 48m2 for window curtain wall openings"),
        ("qto-03", proj_id, "Retail Promenade Vitrified Flooring", "Finishes", "polygon_area", "Ground Floor Plan - Arch Rev 2", 340.0, "m2", 1.0, 1.0, 340.0, 15.0, 325.0, "boq-16", json.dumps({"points": [{"x": 180, "y": 140}, {"x": 410, "y": 140}, {"x": 410, "y": 300}, {"x": 180, "y": 300}]}), "#f59e0b", "Deducted escalator pit opening"),
        ("qto-04", proj_id, "Internal Masonry Partition Walls", "Masonry", "polyline_length", "Ground Floor Plan - Arch Rev 2", 120.0, "m", 1.0, 3.2, 384.0, 36.0, 348.0, "boq-13", json.dumps({"points": [{"x": 200, "y": 100}, {"x": 200, "y": 350}, {"x": 300, "y": 100}, {"x": 300, "y": 350}]}), "#8b5cf6", "Deducted 12 door openings of 3m2 each"),
        ("qto-05", proj_id, "Heavy Duty Structural Columns Count", "Structure", "point_count", "Ground Floor Plan - Arch Rev 2", 24.0, "nos", 1.0, 3.6, 24.0, 0.0, 24.0, "boq-08", json.dumps({"points": [{"x": 150, "y": 90}, {"x": 250, "y": 90}, {"x": 350, "y": 90}, {"x": 450, "y": 90}, {"x": 150, "y": 200}, {"x": 250, "y": 200}, {"x": 350, "y": 200}, {"x": 450, "y": 200}]}), "#ef4444", "Ground floor heavy columns (800x800mm)")
    ]
    for q in qto_seed:
        cursor.execute("""
        INSERT INTO qto_measurements (id, project_id, name, category, tool_type, drawing_name, measured_value, unit, multiplier, depth_height, calculated_quantity, deduction_value, net_quantity, linked_boq_id, geometry_json, color, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, q)

    # 6. Detailed Unit Price Rate Analyses (DUPR)
    ra_m25_materials = [
        {"name": "OPC 53 Cement", "unit": "bag", "qty": 8.2, "rate": 7.50, "waste_pct": 2.0},
        {"name": "M-Sand Fine Aggregate", "unit": "m3", "qty": 0.45, "rate": 38.00, "waste_pct": 3.0},
        {"name": "20mm Coarse Aggregate", "unit": "m3", "qty": 0.85, "rate": 42.00, "waste_pct": 3.0},
        {"name": "Superplasticizer Admixture", "unit": "kg", "qty": 3.2, "rate": 2.20, "waste_pct": 1.0}
    ]
    ra_m25_labors = [
        {"name": "Mason (Skilled)", "unit": "day", "qty": 0.35, "rate": 35.00},
        {"name": "Bhishti / Water Curer", "unit": "day", "qty": 0.20, "rate": 22.00},
        {"name": "Helper / Laborer", "unit": "day", "qty": 0.80, "rate": 20.00}
    ]
    ra_m25_equipment = [
        {"name": "Transit Mixer & Concrete Pump Hire", "unit": "m3", "qty": 1.0, "rate": 6.50},
        {"name": "Needle Vibrator with Operator", "unit": "day", "qty": 0.05, "rate": 18.00}
    ]
    cursor.execute("""
    INSERT INTO rate_analyses (id, project_id, item_code, title, unit, batch_output_qty, materials_json, labors_json, equipment_json, subcontractor_cost, water_sundries_pct, overhead_pct, profit_pct, contingency_pct, calculated_unit_rate)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "ra-01", proj_id, "03.02", "RCC M25 in Slabs & Beams Rate Buildup", "m3", 1.0,
        json.dumps(ra_m25_materials), json.dumps(ra_m25_labors), json.dumps(ra_m25_equipment),
        0.0, 1.5, 5.0, 10.0, 1.0, 148.00
    ))

    ra_brick_materials = [
        {"name": "Modular Bricks 190x90x90mm", "unit": "1000 nos", "qty": 0.50, "rate": 120.00, "waste_pct": 5.0},
        {"name": "OPC Cement", "unit": "bag", "qty": 1.4, "rate": 7.50, "waste_pct": 2.0},
        {"name": "Sand for Mortar", "unit": "m3", "qty": 0.25, "rate": 38.00, "waste_pct": 3.0}
    ]
    ra_brick_labors = [
        {"name": "Brick Mason", "unit": "day", "qty": 0.40, "rate": 35.00},
        {"name": "Laborer / Mazdoor", "unit": "day", "qty": 0.50, "rate": 20.00}
    ]
    cursor.execute("""
    INSERT INTO rate_analyses (id, project_id, item_code, title, unit, batch_output_qty, materials_json, labors_json, equipment_json, subcontractor_cost, water_sundries_pct, overhead_pct, profit_pct, contingency_pct, calculated_unit_rate)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "ra-02", proj_id, "04.02", "Brickwork 115mm in CM 1:4 Rate Buildup", "m2", 1.0,
        json.dumps(ra_brick_materials), json.dumps(ra_brick_labors), json.dumps([]),
        0.0, 1.5, 5.0, 10.0, 1.0, 19.80
    ))

    # 7. Interim Payment Certificates (IPC)
    cursor.execute("""
    INSERT INTO ipc_certificates (id, project_id, cert_number, period_start, period_end, submission_date, status, gross_work_this_period, gross_work_cumulative, retention_deducted, advance_recovered, tax_deducted, other_deductions, net_payable_this_period, line_items_json, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "ipc-01", proj_id, 1, "2026-01-15", "2026-02-28", "2026-03-05", "PAID",
        342000.00, 342000.00, 17100.00, 34200.00, 17100.00, 0.0, 273600.00,
        json.dumps([{"item_code": "01.01", "qty": 1.0, "amount": 45000.0}, {"item_code": "02.01", "qty": 14500.0, "amount": 239250.0}, {"item_code": "02.03", "qty": 420.0, "amount": 36960.0}, {"item_code": "02.04", "qty": 150.0, "amount": 20790.0}]),
        "Certified for initial site mobilization and bulk basement excavation"
    ))

    cursor.execute("""
    INSERT INTO ipc_certificates (id, project_id, cert_number, period_start, period_end, submission_date, status, gross_work_this_period, gross_work_cumulative, retention_deducted, advance_recovered, tax_deducted, other_deductions, net_payable_this_period, line_items_json, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "ipc-02", proj_id, 2, "2026-03-01", "2026-04-30", "2026-05-04", "PAID",
        518500.00, 860500.00, 25925.00, 51850.00, 25925.00, 0.0, 414800.00,
        json.dumps([{"item_code": "02.04", "qty": 1700.0, "amount": 241910.0}, {"item_code": "02.05", "qty": 210.0, "amount": 220500.0}, {"item_code": "03.01", "qty": 330.0, "amount": 56090.0}]),
        "Completion of Raft Foundation concrete casting and basement column stubs"
    ))

    cursor.execute("""
    INSERT INTO ipc_certificates (id, project_id, cert_number, period_start, period_end, submission_date, status, gross_work_this_period, gross_work_cumulative, retention_deducted, advance_recovered, tax_deducted, other_deductions, net_payable_this_period, line_items_json, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "ipc-03", proj_id, 3, "2026-05-01", "2026-06-30", "2026-07-06", "CERTIFIED",
        645000.00, 1505500.00, 32250.00, 64500.00, 32250.00, 0.0, 516000.00,
        json.dumps([{"item_code": "03.01", "qty": 450.0, "amount": 75600.0}, {"item_code": "03.02", "qty": 1800.0, "amount": 266400.0}, {"item_code": "03.03", "qty": 220.0, "amount": 237600.0}, {"item_code": "03.04", "qty": 2900.0, "amount": 65400.0}]),
        "Superstructure casting from Ground to 6th Floor slabs"
    ))

    # 8. Variations (Change Orders)
    cursor.execute("""
    INSERT INTO variations (id, project_id, vo_number, title, description, category, amount, time_extension_days, status, requested_date, approved_date, justification)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "vo-01", proj_id, "VO-001", "Basement Hard Rock Blasting & Shoring Extension",
        "Encountered unexpected basalt rock strata requiring hydraulic rock breaker and secondary contiguous pile anchors",
        "ADDITION", 68500.00, 12, "APPROVED", "2026-02-10", "2026-02-18",
        "Geotechnical variation confirmed by Structural Consultant Site Instruction SI-04"
    ))

    cursor.execute("""
    INSERT INTO variations (id, project_id, vo_number, title, description, category, amount, time_extension_days, status, requested_date, approved_date, justification)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "vo-02", proj_id, "VO-002", "High-Performance Low-E Acoustic Double Glazing Upgrade",
        "Upgrade facade glass from standard tint 6mm to 6+12A+6mm double acoustic Low-E units on highway facing elevation",
        "STAR_ITEM", 42000.00, 0, "APPROVED", "2026-04-12", "2026-04-20",
        "Client marketing directive for enhanced LEED acoustic insulation ratings"
    ))

    cursor.execute("""
    INSERT INTO variations (id, project_id, vo_number, title, description, category, amount, time_extension_days, status, requested_date, approved_date, justification)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "vo-03", proj_id, "VO-003", "Optimization of Basement Partition Layout",
        "Elimination of internal brick storage lockers in favour of open parking layout",
        "OMISSION", -18400.00, 0, "APPROVED", "2026-05-02", "2026-05-10",
        "Value engineering recommendation adopted to maximize vehicular parking bays"
    ))

    # 9. EVM Periods Historical Tracking
    evm_seed = [
        ("evm-01", proj_id, 1, "Month 1 (Jan)", 180000.0, 195000.0, 190000.0, 1.026, 1.083),
        ("evm-02", proj_id, 2, "Month 2 (Feb)", 370000.0, 390000.0, 375000.0, 1.040, 1.054),
        ("evm-03", proj_id, 3, "Month 3 (Mar)", 620000.0, 640000.0, 615000.0, 1.041, 1.032),
        ("evm-04", proj_id, 4, "Month 4 (Apr)", 910000.0, 940000.0, 895000.0, 1.050, 1.033),
        ("evm-05", proj_id, 5, "Month 5 (May)", 1240000.0, 1260000.0, 1210000.0, 1.041, 1.016),
        ("evm-06", proj_id, 6, "Month 6 (Jun)", 1600000.0, 1620000.0, 1545000.0, 1.049, 1.013),
        ("evm-07", proj_id, 7, "Month 7 (Jul)", 1980000.0, 1995000.0, 1890000.0, 1.056, 1.008),
        ("evm-08", proj_id, 8, "Month 8 (Current)", 2390000.0, 2410000.0, 2275000.0, 1.059, 1.008)
    ]
    for ev in evm_seed:
        cursor.execute("""
        INSERT INTO evm_periods (id, project_id, month_index, period_label, planned_value, earned_value, actual_cost, cpi, spi)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, ev)

    conn.commit()


# --- CRUD HELPER FUNCTIONS ---

def get_all_projects() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM projects ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_project_by_id(project_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    conn.close()
    return dict(row) if row else None

def get_boq_items(project_id: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM boq_items WHERE project_id = ? ORDER BY sort_order ASC, item_code ASC", (project_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_qto_measurements(project_id: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM qto_measurements WHERE project_id = ? ORDER BY created_at DESC", (project_id,)).fetchall()
    conn.close()
    res = []
    for r in rows:
        d = dict(r)
        if d.get('geometry_json'):
            try:
                d['geometry'] = json.loads(d['geometry_json'])
            except Exception:
                d['geometry'] = None
        res.append(d)
    return res

def get_bbs_items(project_id: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM bbs_items WHERE project_id = ? ORDER BY member_name, bar_mark", (project_id,)).fetchall()
    conn.close()
    res = []
    for r in rows:
        d = dict(r)
        if d.get('dimensions_json'):
            try:
                d['dimensions'] = json.loads(d['dimensions_json'])
            except Exception:
                d['dimensions'] = {}
        res.append(d)
    return res

def get_rate_analyses(project_id: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM rate_analyses WHERE project_id = ? ORDER BY item_code", (project_id,)).fetchall()
    conn.close()
    res = []
    for r in rows:
        d = dict(r)
        for key in ['materials_json', 'labors_json', 'equipment_json']:
            if d.get(key):
                try:
                    d[key.replace('_json', '')] = json.loads(d[key])
                except Exception:
                    d[key.replace('_json', '')] = []
        res.append(d)
    return res

def get_ipc_certificates(project_id: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM ipc_certificates WHERE project_id = ? ORDER BY cert_number ASC", (project_id,)).fetchall()
    conn.close()
    res = []
    for r in rows:
        d = dict(r)
        if d.get('line_items_json'):
            try:
                d['line_items'] = json.loads(d['line_items_json'])
            except Exception:
                d['line_items'] = []
        res.append(d)
    return res

def get_variations(project_id: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM variations WHERE project_id = ? ORDER BY vo_number ASC", (project_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_material_master() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM material_master ORDER BY category, material_name").fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_evm_periods(project_id: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM evm_periods WHERE project_id = ? ORDER BY month_index ASC", (project_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]
