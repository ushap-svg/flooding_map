"""
StructuraQS - Construction-Tech Quantity Surveyor & Cost Engineering Application Server
Flask RESTful Backend & Single-Page Application Host.
Runs 100% locally with zero external API dependencies.
"""

import os
import sys
import json
import uuid
from flask import Flask, render_template, request, jsonify, send_file, Response

import db
import calculators
import export_service

app = Flask(__name__, template_folder="templates", static_folder="static")
app.config['SECRET_KEY'] = 'structura-qs-secure-local-key-2026'

# Ensure database is initialized at startup
db.init_db()


# -------------------------------------------------------------
# ROOT ROUTE - SINGLE PAGE SaaS APPLICATION
# -------------------------------------------------------------
@app.route('/')
def index():
    return render_template('index.html')


# -------------------------------------------------------------
# PROJECT APIS
# -------------------------------------------------------------
@app.route('/api/projects', methods=['GET'])
def list_projects():
    projects = db.get_all_projects()
    return jsonify({'success': True, 'projects': projects})


@app.route('/api/projects', methods=['POST'])
def create_project():
    data = request.json or {}
    proj_id = f"proj-{uuid.uuid4().hex[:8]}"
    name = data.get('name', 'New Construction Project')
    code = data.get('code', f"PRJ-{uuid.uuid4().hex[:6].upper()}")
    client = data.get('client', '')
    contractor = data.get('contractor', '')
    consultant = data.get('consultant', '')
    project_type = data.get('project_type', 'Commercial / Residential')
    location = data.get('location', '')
    currency = data.get('currency', '$')
    contract_sum = float(data.get('contract_sum', 0.0))
    start_date = data.get('start_date', '')
    target_completion = data.get('target_completion', '')
    retention_pct = float(data.get('retention_pct', 5.0))
    advance_recovery_pct = float(data.get('advance_recovery_pct', 10.0))
    tax_pct = float(data.get('tax_pct', 5.0))

    conn = db.get_db_connection()
    conn.execute("""
    INSERT INTO projects (id, name, code, client, contractor, consultant, project_type, location, currency, contract_sum, start_date, target_completion, retention_pct, advance_recovery_pct, tax_pct)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (proj_id, name, code, client, contractor, consultant, project_type, location, currency, contract_sum, start_date, target_completion, retention_pct, advance_recovery_pct, tax_pct))
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'project': db.get_project_by_id(proj_id)}), 201


@app.route('/api/projects/<project_id>', methods=['GET'])
def get_project(project_id):
    proj = db.get_project_by_id(project_id)
    if not proj:
        return jsonify({'success': False, 'error': 'Project not found'}), 404
    return jsonify({'success': True, 'project': proj})


@app.route('/api/projects/<project_id>', methods=['PUT'])
def update_project(project_id):
    data = request.json or {}
    conn = db.get_db_connection()
    conn.execute("""
    UPDATE projects SET
        name = ?, code = ?, client = ?, contractor = ?, consultant = ?,
        project_type = ?, location = ?, currency = ?, contract_sum = ?,
        start_date = ?, target_completion = ?, retention_pct = ?,
        advance_recovery_pct = ?, tax_pct = ?
    WHERE id = ?
    """, (
        data.get('name'), data.get('code'), data.get('client'), data.get('contractor'), data.get('consultant'),
        data.get('project_type'), data.get('location'), data.get('currency', '$'), float(data.get('contract_sum', 0.0)),
        data.get('start_date'), data.get('target_completion'), float(data.get('retention_pct', 5.0)),
        float(data.get('advance_recovery_pct', 10.0)), float(data.get('tax_pct', 5.0)),
        project_id
    ))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'project': db.get_project_by_id(project_id)})


# -------------------------------------------------------------
# BILL OF QUANTITIES (BOQ) APIS
# -------------------------------------------------------------
@app.route('/api/projects/<project_id>/boq', methods=['GET'])
def get_boq(project_id):
    items = db.get_boq_items(project_id)
    total_contract = sum(float(i.get('total_amount', 0.0)) for i in items)
    return jsonify({'success': True, 'items': items, 'total_amount': round(total_contract, 2)})


@app.route('/api/projects/<project_id>/boq', methods=['POST'])
def add_boq_item(project_id):
    data = request.json or {}
    item_id = f"boq-{uuid.uuid4().hex[:8]}"
    item_code = data.get('item_code', '01.00')
    division = data.get('division', '01. PRELIMINARIES & GENERAL')
    section = data.get('section', '')
    description = data.get('description', '')
    unit = data.get('unit', 'm3')
    qty = float(data.get('quantity', 0.0))
    rate = float(data.get('unit_rate', 0.0))
    total_amt = round(qty * rate, 2)
    mat_rate = float(data.get('material_rate', 0.0))
    lab_rate = float(data.get('labor_rate', 0.0))
    eq_rate = float(data.get('equipment_rate', 0.0))
    sub_rate = float(data.get('subcontractor_rate', 0.0))
    op_pct = float(data.get('overhead_profit_pct', 15.0))
    sort_order = int(data.get('sort_order', 999))

    conn = db.get_db_connection()
    conn.execute("""
    INSERT INTO boq_items (id, project_id, item_code, division, section, description, unit, quantity, unit_rate, total_amount, material_rate, labor_rate, equipment_rate, subcontractor_rate, overhead_profit_pct, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (item_id, project_id, item_code, division, section, description, unit, qty, rate, total_amt, mat_rate, lab_rate, eq_rate, sub_rate, op_pct, sort_order))
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'item_id': item_id}), 201


@app.route('/api/boq/<item_id>', methods=['PUT'])
def update_boq_item(item_id):
    data = request.json or {}
    qty = float(data.get('quantity', 0.0))
    rate = float(data.get('unit_rate', 0.0))
    total_amt = round(qty * rate, 2)

    conn = db.get_db_connection()
    conn.execute("""
    UPDATE boq_items SET
        item_code = ?, division = ?, section = ?, description = ?, unit = ?,
        quantity = ?, unit_rate = ?, total_amount = ?, material_rate = ?,
        labor_rate = ?, equipment_rate = ?, subcontractor_rate = ?, overhead_profit_pct = ?, sort_order = ?
    WHERE id = ?
    """, (
        data.get('item_code'), data.get('division'), data.get('section'), data.get('description'), data.get('unit'),
        qty, rate, total_amt, float(data.get('material_rate', 0.0)),
        float(data.get('labor_rate', 0.0)), float(data.get('equipment_rate', 0.0)), float(data.get('subcontractor_rate', 0.0)),
        float(data.get('overhead_profit_pct', 15.0)), int(data.get('sort_order', 0)),
        item_id
    ))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


@app.route('/api/boq/<item_id>', methods=['DELETE'])
def delete_boq_item(item_id):
    conn = db.get_db_connection()
    conn.execute("DELETE FROM boq_items WHERE id = ?", (item_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


# -------------------------------------------------------------
# 2D PLAN QUANTITY TAKEOFF (QTO) APIS
# -------------------------------------------------------------
@app.route('/api/projects/<project_id>/qto', methods=['GET'])
def get_qto(project_id):
    items = db.get_qto_measurements(project_id)
    return jsonify({'success': True, 'takeoffs': items})


@app.route('/api/projects/<project_id>/qto', methods=['POST'])
def add_qto(project_id):
    data = request.json or {}
    qto_id = f"qto-{uuid.uuid4().hex[:8]}"
    name = data.get('name', 'Measured Takeoff')
    category = data.get('category', 'Concrete')
    tool_type = data.get('tool_type', 'polygon_area')
    drawing_name = data.get('drawing_name', 'Ground Floor Plan - Arch Rev 2')
    measured_val = float(data.get('measured_value', 0.0))
    unit = data.get('unit', 'm2')
    multiplier = float(data.get('multiplier', 1.0))
    depth_height = float(data.get('depth_height', 0.0))
    deduction = float(data.get('deduction_value', 0.0))
    
    # Calculate volume or net qty
    if depth_height > 0 and unit in ['m2', 'sqm']:
        calc_qty = measured_val * depth_height * multiplier
    else:
        calc_qty = measured_val * multiplier
        
    net_qty = max(0.0, calc_qty - deduction)
    linked_boq_id = data.get('linked_boq_id', None)
    geom_json = json.dumps(data.get('geometry', {}))
    color = data.get('color', '#2563eb')
    notes = data.get('notes', '')

    conn = db.get_db_connection()
    conn.execute("""
    INSERT INTO qto_measurements (id, project_id, name, category, tool_type, drawing_name, measured_value, unit, multiplier, depth_height, calculated_quantity, deduction_value, net_quantity, linked_boq_id, geometry_json, color, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (qto_id, project_id, name, category, tool_type, drawing_name, measured_val, unit, multiplier, depth_height, calc_qty, deduction, net_qty, linked_boq_id, geom_json, color, notes))
    conn.commit()
    conn.close()

    # If linked to BOQ, auto-sync quantity
    if linked_boq_id:
        sync_takeoff_to_boq_internal(linked_boq_id, net_qty)

    return jsonify({'success': True, 'takeoff_id': qto_id, 'net_quantity': round(net_qty, 3)}), 201


@app.route('/api/qto/<qto_id>', methods=['PUT'])
def update_qto(qto_id):
    data = request.json or {}
    measured_val = float(data.get('measured_value', 0.0))
    multiplier = float(data.get('multiplier', 1.0))
    depth_height = float(data.get('depth_height', 0.0))
    deduction = float(data.get('deduction_value', 0.0))
    unit = data.get('unit', 'm2')

    if depth_height > 0 and unit in ['m2', 'sqm']:
        calc_qty = measured_val * depth_height * multiplier
    else:
        calc_qty = measured_val * multiplier
        
    net_qty = max(0.0, calc_qty - deduction)
    linked_boq_id = data.get('linked_boq_id', None)

    conn = db.get_db_connection()
    conn.execute("""
    UPDATE qto_measurements SET
        name = ?, category = ?, tool_type = ?, drawing_name = ?,
        measured_value = ?, unit = ?, multiplier = ?, depth_height = ?,
        calculated_quantity = ?, deduction_value = ?, net_quantity = ?,
        linked_boq_id = ?, geometry_json = ?, color = ?, notes = ?
    WHERE id = ?
    """, (
        data.get('name'), data.get('category'), data.get('tool_type'), data.get('drawing_name'),
        measured_val, unit, multiplier, depth_height,
        calc_qty, deduction, net_qty,
        linked_boq_id, json.dumps(data.get('geometry', {})), data.get('color'), data.get('notes'),
        qto_id
    ))
    conn.commit()
    conn.close()

    if linked_boq_id:
        sync_takeoff_to_boq_internal(linked_boq_id, net_qty)

    return jsonify({'success': True, 'net_quantity': round(net_qty, 3)})


@app.route('/api/qto/<qto_id>', methods=['DELETE'])
def delete_qto(qto_id):
    conn = db.get_db_connection()
    conn.execute("DELETE FROM qto_measurements WHERE id = ?", (qto_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


def sync_takeoff_to_boq_internal(boq_id: str, new_qty: float):
    """Updates BOQ item quantity and total amount from QTO takeoff."""
    conn = db.get_db_connection()
    cursor = conn.cursor()
    row = cursor.execute("SELECT unit_rate FROM boq_items WHERE id = ?", (boq_id,)).fetchone()
    if row:
        unit_rate = float(row['unit_rate'])
        new_total = round(new_qty * unit_rate, 2)
        cursor.execute("UPDATE boq_items SET quantity = ?, total_amount = ? WHERE id = ?", (new_qty, new_total, boq_id))
        conn.commit()
    conn.close()


@app.route('/api/qto/<qto_id>/sync-to-boq', methods=['POST'])
def sync_qto_to_boq(qto_id):
    data = request.json or {}
    boq_id = data.get('boq_id')
    if not boq_id:
        return jsonify({'success': False, 'error': 'Target BOQ item id required'}), 400

    conn = db.get_db_connection()
    row = conn.execute("SELECT net_quantity FROM qto_measurements WHERE id = ?", (qto_id,)).fetchone()
    if not row:
        conn.close()
        return jsonify({'success': False, 'error': 'Takeoff measurement not found'}), 404
        
    net_qty = float(row['net_quantity'])
    conn.execute("UPDATE qto_measurements SET linked_boq_id = ? WHERE id = ?", (boq_id, qto_id))
    conn.commit()
    conn.close()

    sync_takeoff_to_boq_internal(boq_id, net_qty)
    return jsonify({'success': True, 'synced_quantity': net_qty, 'boq_id': boq_id})


# -------------------------------------------------------------
# BAR BENDING SCHEDULE (BBS) APIS
# -------------------------------------------------------------
@app.route('/api/projects/<project_id>/bbs', methods=['GET'])
def get_bbs(project_id):
    items = db.get_bbs_items(project_id)
    total_wt_kg = sum(float(i.get('total_weight_kg', 0.0)) for i in items)
    total_wt_mt = round(total_wt_kg / 1000.0, 4)
    return jsonify({'success': True, 'items': items, 'total_weight_kg': round(total_wt_kg, 2), 'total_weight_mt': total_wt_mt})


@app.route('/api/bbs/calculate', methods=['POST'])
def calc_bbs_item_preview():
    data = request.json or {}
    shape_code = data.get('shape_code', 'STRAIGHT')
    dia = float(data.get('diameter_mm', 12.0))
    dims = data.get('dimensions', {})
    num_m = int(data.get('num_members', 1))
    bpm = int(data.get('bars_per_member', 1))
    
    result = calculators.calculate_bbs_item(shape_code, dia, dims, num_m, bpm)
    return jsonify({'success': True, 'result': result})


@app.route('/api/projects/<project_id>/bbs', methods=['POST'])
def add_bbs_item(project_id):
    data = request.json or {}
    bbs_id = f"bbs-{uuid.uuid4().hex[:8]}"
    member_name = data.get('member_name', 'RCC Member')
    bar_mark = data.get('bar_mark', 'B1')
    shape_code = data.get('shape_code', 'STRAIGHT')
    dia = float(data.get('diameter_mm', 12.0))
    dims = data.get('dimensions', {})
    num_m = int(data.get('num_members', 1))
    bpm = int(data.get('bars_per_member', 1))
    notes = data.get('notes', '')

    calc = calculators.calculate_bbs_item(shape_code, dia, dims, num_m, bpm)

    conn = db.get_db_connection()
    conn.execute("""
    INSERT INTO bbs_items (id, project_id, member_name, bar_mark, shape_code, diameter_mm, dimensions_json, num_members, bars_per_member, total_bars, cut_length_m, total_length_m, unit_weight_kg_m, total_weight_kg, total_weight_mt, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        bbs_id, project_id, member_name, bar_mark, shape_code, dia,
        json.dumps(dims), num_m, bpm, calc['total_bars'],
        calc['cut_length_m'], calc['total_length_m'], calc['unit_weight_kg_m'],
        calc['total_weight_kg'], calc['total_weight_mt'], notes
    ))
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'item_id': bbs_id, 'calc': calc}), 201


@app.route('/api/bbs/<bbs_id>', methods=['DELETE'])
def delete_bbs_item(bbs_id):
    conn = db.get_db_connection()
    conn.execute("DELETE FROM bbs_items WHERE id = ?", (bbs_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})


# -------------------------------------------------------------
# CIVIL CALCULATOR APIS (CONCRETE, BRICKWORK, PLASTER, EARTHWORK)
# -------------------------------------------------------------
@app.route('/api/calculators/concrete', methods=['POST'])
def calc_concrete():
    data = request.json or {}
    wet_vol = float(data.get('wet_volume_m3', 1.0))
    grade = data.get('mix_grade', 'M20')
    waste = float(data.get('wastage_pct', 2.0))
    res = calculators.calculate_concrete_materials(wet_vol, grade, waste)
    return jsonify({'success': True, 'result': res})


@app.route('/api/calculators/brickwork', methods=['POST'])
def calc_brickwork():
    data = request.json or {}
    l = float(data.get('wall_length_m', 5.0))
    h = float(data.get('wall_height_m', 3.0))
    thk = float(data.get('wall_thickness_m', 0.23))
    b_type = data.get('brick_type', 'MODULAR')
    m_ratio = data.get('mortar_ratio', '1:6')
    ded = float(data.get('deductions_m3', 0.0))
    waste = float(data.get('wastage_pct', 5.0))
    res = calculators.calculate_brickwork(l, h, thk, b_type, m_ratio, ded, waste)
    return jsonify({'success': True, 'result': res})


@app.route('/api/calculators/plastering', methods=['POST'])
def calc_plastering():
    data = request.json or {}
    area = float(data.get('area_m2', 50.0))
    thk = float(data.get('thickness_mm', 12.0))
    m_ratio = data.get('mortar_ratio', '1:4')
    waste = float(data.get('wastage_pct', 15.0))
    res = calculators.calculate_plastering(area, thk, m_ratio, waste)
    return jsonify({'success': True, 'result': res})


@app.route('/api/calculators/earthwork', methods=['POST'])
def calc_earthwork():
    data = request.json or {}
    l = float(data.get('length_m', 10.0))
    w = float(data.get('width_m', 5.0))
    d = float(data.get('depth_m', 2.5))
    slope = float(data.get('side_slope_h_v', 0.5))
    res = calculators.calculate_earthwork(l, w, d, slope)
    return jsonify({'success': True, 'result': res})


# -------------------------------------------------------------
# RATE ANALYSIS (DUPR) APIS
# -------------------------------------------------------------
@app.route('/api/projects/<project_id>/rate-analysis', methods=['GET'])
def get_rate_analyses(project_id):
    items = db.get_rate_analyses(project_id)
    return jsonify({'success': True, 'analyses': items})


@app.route('/api/rate-analysis/compute', methods=['POST'])
def compute_rate_analysis_api():
    data = request.json or {}
    mats = data.get('materials', [])
    labs = data.get('labors', [])
    eqs = data.get('equipment', [])
    sub = float(data.get('subcontractor_cost', 0.0))
    water = float(data.get('water_sundries_pct', 1.5))
    op = float(data.get('profit_pct', 10.0))
    oh = float(data.get('overhead_pct', 5.0))
    cont = float(data.get('contingency_pct', 1.0))
    qty = float(data.get('output_qty', 1.0))
    unit = data.get('unit', 'm3')

    res = calculators.compute_rate_analysis(mats, labs, eqs, sub, water, op, oh, cont, qty, unit)
    return jsonify({'success': True, 'result': res})


@app.route('/api/projects/<project_id>/rate-analysis', methods=['POST'])
def save_rate_analysis(project_id):
    data = request.json or {}
    ra_id = data.get('id') or f"ra-{uuid.uuid4().hex[:8]}"
    item_code = data.get('item_code', '')
    title = data.get('title', 'Unit Rate Analysis')
    unit = data.get('unit', 'm3')
    batch_qty = float(data.get('output_qty', 1.0))
    mats = data.get('materials', [])
    labs = data.get('labors', [])
    eqs = data.get('equipment', [])
    sub = float(data.get('subcontractor_cost', 0.0))
    water = float(data.get('water_sundries_pct', 1.5))
    oh = float(data.get('overhead_pct', 5.0))
    profit = float(data.get('profit_pct', 10.0))
    cont = float(data.get('contingency_pct', 1.0))

    calc = calculators.compute_rate_analysis(mats, labs, eqs, sub, water, profit, oh, cont, batch_qty, unit)
    calculated_rate = calc['calculated_unit_rate']

    conn = db.get_db_connection()
    # Check if exists
    exists = conn.execute("SELECT id FROM rate_analyses WHERE id = ?", (ra_id,)).fetchone()
    if exists:
        conn.execute("""
        UPDATE rate_analyses SET
            item_code = ?, title = ?, unit = ?, batch_output_qty = ?,
            materials_json = ?, labors_json = ?, equipment_json = ?,
            subcontractor_cost = ?, water_sundries_pct = ?, overhead_pct = ?,
            profit_pct = ?, contingency_pct = ?, calculated_unit_rate = ?
        WHERE id = ?
        """, (item_code, title, unit, batch_qty, json.dumps(mats), json.dumps(labs), json.dumps(eqs), sub, water, oh, profit, cont, calculated_rate, ra_id))
    else:
        conn.execute("""
        INSERT INTO rate_analyses (id, project_id, item_code, title, unit, batch_output_qty, materials_json, labors_json, equipment_json, subcontractor_cost, water_sundries_pct, overhead_pct, profit_pct, contingency_pct, calculated_unit_rate)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (ra_id, project_id, item_code, title, unit, batch_qty, json.dumps(mats), json.dumps(labs), json.dumps(eqs), sub, water, oh, profit, cont, calculated_rate))

    # Optional: Update BOQ unit rate if matched by item_code
    if item_code:
        conn.execute("UPDATE boq_items SET unit_rate = ?, total_amount = round(quantity * ?, 2) WHERE project_id = ? AND item_code = ?", (calculated_rate, calculated_rate, project_id, item_code))

    conn.commit()
    conn.close()

    return jsonify({'success': True, 'rate_analysis_id': ra_id, 'calculated_unit_rate': calculated_rate})


# -------------------------------------------------------------
# INTERIM PAYMENT CERTIFICATES (IPC) & VARIATIONS APIS
# -------------------------------------------------------------
@app.route('/api/projects/<project_id>/ipc', methods=['GET'])
def get_ipcs(project_id):
    certs = db.get_ipc_certificates(project_id)
    return jsonify({'success': True, 'certificates': certs})


@app.route('/api/projects/<project_id>/ipc', methods=['POST'])
def create_ipc(project_id):
    data = request.json or {}
    ipc_id = f"ipc-{uuid.uuid4().hex[:8]}"
    cert_num = int(data.get('cert_number', 1))
    p_start = data.get('period_start', '')
    p_end = data.get('period_end', '')
    sub_date = data.get('submission_date', '')
    status = data.get('status', 'CERTIFIED')
    gross_period = float(data.get('gross_work_this_period', 0.0))
    gross_cum = float(data.get('gross_work_cumulative', gross_period))
    
    proj = db.get_project_by_id(project_id) or {}
    ret_pct = float(proj.get('retention_pct', 5.0))
    adv_pct = float(proj.get('advance_recovery_pct', 10.0))
    tax_pct = float(proj.get('tax_pct', 5.0))

    ret_ded = round(gross_period * (ret_pct / 100.0), 2)
    adv_ded = round(gross_period * (adv_pct / 100.0), 2)
    tax_ded = round(gross_period * (tax_pct / 100.0), 2)
    other_ded = float(data.get('other_deductions', 0.0))
    net_payable = round(gross_period - (ret_ded + adv_ded + tax_ded + other_ded), 2)
    line_items = json.dumps(data.get('line_items', []))
    notes = data.get('notes', '')

    conn = db.get_db_connection()
    conn.execute("""
    INSERT INTO ipc_certificates (id, project_id, cert_number, period_start, period_end, submission_date, status, gross_work_this_period, gross_work_cumulative, retention_deducted, advance_recovered, tax_deducted, other_deductions, net_payable_this_period, line_items_json, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (ipc_id, project_id, cert_num, p_start, p_end, sub_date, status, gross_period, gross_cum, ret_ded, adv_ded, tax_ded, other_ded, net_payable, line_items, notes))
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'certificate_id': ipc_id, 'net_payable': net_payable}), 201


@app.route('/api/projects/<project_id>/variations', methods=['GET'])
def get_variations(project_id):
    vos = db.get_variations(project_id)
    net_vo_sum = sum(float(v.get('amount', 0.0)) for v in vos if v.get('status') == 'APPROVED')
    return jsonify({'success': True, 'variations': vos, 'net_approved_variation_sum': round(net_vo_sum, 2)})


@app.route('/api/projects/<project_id>/variations', methods=['POST'])
def add_variation(project_id):
    data = request.json or {}
    vo_id = f"vo-{uuid.uuid4().hex[:8]}"
    vo_number = data.get('vo_number', 'VO-00X')
    title = data.get('title', 'Variation Order')
    desc = data.get('description', '')
    cat = data.get('category', 'ADDITION')
    amt = float(data.get('amount', 0.0))
    days = int(data.get('time_extension_days', 0))
    status = data.get('status', 'APPROVED')
    req_date = data.get('requested_date', '')
    app_date = data.get('approved_date', '')
    just = data.get('justification', '')

    conn = db.get_db_connection()
    conn.execute("""
    INSERT INTO variations (id, project_id, vo_number, title, description, category, amount, time_extension_days, status, requested_date, approved_date, justification)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (vo_id, project_id, vo_number, title, desc, cat, amt, days, status, req_date, app_date, just))
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'variation_id': vo_id}), 201


# -------------------------------------------------------------
# EARNED VALUE MANAGEMENT (EVM) APIS
# -------------------------------------------------------------
@app.route('/api/projects/<project_id>/evm', methods=['GET'])
def get_project_evm(project_id):
    proj = db.get_project_by_id(project_id)
    if not proj:
        return jsonify({'success': False, 'error': 'Project not found'}), 404

    periods = db.get_evm_periods(project_id)
    boq_items = db.get_boq_items(project_id)
    bac = sum(float(i.get('total_amount', 0.0)) for i in boq_items) or float(proj.get('contract_sum', 1000000.0))

    if periods:
        latest = periods[-1]
        pv = float(latest.get('planned_value', 0.0))
        ev = float(latest.get('earned_value', 0.0))
        ac = float(latest.get('actual_cost', 0.0))
    else:
        pv, ev, ac = bac * 0.5, bac * 0.52, bac * 0.49

    metrics = calculators.calculate_evm_metrics(pv, ev, ac, bac)

    return jsonify({
        'success': True,
        'metrics': metrics,
        'periods': periods
    })


# -------------------------------------------------------------
# MATERIAL MASTER CATALOG API
# -------------------------------------------------------------
@app.route('/api/material-master', methods=['GET'])
def list_materials():
    mats = db.get_material_master()
    return jsonify({'success': True, 'materials': mats})


# -------------------------------------------------------------
# EXPORT APIS (EXCEL & CSV)
# -------------------------------------------------------------
@app.route('/api/export/excel/boq/<project_id>', methods=['GET'])
def download_boq_excel(project_id):
    proj = db.get_project_by_id(project_id)
    if not proj:
        return "Project not found", 404
    items = db.get_boq_items(project_id)
    excel_stream = export_service.export_boq_to_excel(proj, items)
    filename = f"BOQ_{proj.get('code', 'PRJ')}_{proj.get('name', 'Project')[:20].replace(' ', '_')}.xlsx"
    return send_file(
        excel_stream,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=filename
    )


@app.route('/api/export/excel/bbs/<project_id>', methods=['GET'])
def download_bbs_excel(project_id):
    proj = db.get_project_by_id(project_id)
    if not proj:
        return "Project not found", 404
    items = db.get_bbs_items(project_id)
    excel_stream = export_service.export_bbs_to_excel(proj, items)
    filename = f"BBS_{proj.get('code', 'PRJ')}_Schedule.xlsx"
    return send_file(
        excel_stream,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
        download_name=filename
    )


@app.route('/api/export/csv/boq/<project_id>', methods=['GET'])
def download_boq_csv(project_id):
    items = db.get_boq_items(project_id)
    csv_str = export_service.export_boq_to_csv(items)
    return Response(
        csv_str,
        mimetype="text/csv",
        headers={"Content-disposition": f"attachment; filename=BOQ_Export_{project_id}.csv"}
    )


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"\n=======================================================")
    print(f"  STRUCTURA-QS | Quantity Surveyor SaaS Platform")
    print(f"  Running locally on: http://127.0.0.1:{port}")
    print(f"  Zero external APIs required.")
    print(f"=======================================================\n")
    app.run(host='127.0.0.1', port=port, debug=True)
