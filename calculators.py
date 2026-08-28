"""
Civil Engineering & Quantity Surveying Calculation Engines
Pure Python implementation - zero third-party external API dependencies.
Follows standard civil engineering codes (IS 456, IS 1200, IS 2502, BS 8666, NRM2, POMI, CESMM4).
"""

import math
from typing import Dict, List, Any, Optional

# --- 1. BAR BENDING SCHEDULE (BBS) ENGINE ---
# Standard rebar unit weight: W = (D^2 / 162.2) kg/m or (D^2 / 162)
def get_rebar_unit_weight(diameter_mm: float) -> float:
    """Calculates unit weight of steel rebar in kg per meter."""
    if diameter_mm <= 0:
        return 0.0
    return round((diameter_mm ** 2) / 162.2, 4)


def calculate_bbs_item(
    shape_code: str,
    diameter_mm: float,
    dimensions: Dict[str, float],
    num_members: int,
    bars_per_member: int
) -> Dict[str, Any]:
    """
    Calculates cutting length, bend deductions, total length and total weight.
    Standard Shape Codes:
      - 'STRAIGHT': A
      - 'L_BEND' (90 deg hook): A + B - (1 * 2 * d)
      - 'U_SHAPE' (two 90 deg hooks): A + 2*B - (2 * 2 * d)
      - 'CRANK_SLAB' (bent up bar at 45 deg): A + 2*B + 2*(0.42*H) - bend deductions
      - 'RECT_STIRRUP' (ties): 2*(A + B) + 2*(10*d or 24*d hook) - (3*2d + 2*3d)
      - 'CIRCULAR_TIE': math.pi * (D - 2*cover) + 24*d hook
      - 'SPIRAL': Helical bar length
      - 'CUSTOM': Direct length
    """
    d_m = diameter_mm / 1000.0  # diameter in meters
    total_bars = max(1, num_members * bars_per_member)
    unit_weight = get_rebar_unit_weight(diameter_mm)

    a = dimensions.get('a', 0.0)
    b = dimensions.get('b', 0.0)
    c = dimensions.get('c', 0.0)
    h = dimensions.get('h', 0.0)
    hook_len = dimensions.get('hook', 10.0 * d_m)

    cut_length = 0.0
    shape_desc = ""

    if shape_code == 'STRAIGHT':
        cut_length = a
        shape_desc = "Straight Bar"
    elif shape_code == 'L_BEND':
        # Length = A + B - 1 bend deduction (2d)
        bend_deduction = 2.0 * d_m
        cut_length = max(0.0, (a + b) - bend_deduction)
        shape_desc = "L-Bend Bar (90°)"
    elif shape_code == 'U_SHAPE':
        # Length = A + 2*B - 2 bend deductions (2*2d)
        bend_deduction = 2.0 * (2.0 * d_m)
        cut_length = max(0.0, (a + 2.0 * b) - bend_deduction)
        shape_desc = "U-Shape Bar (180° / 2x90°)"
    elif shape_code == 'CRANK_SLAB':
        # Bent up bar: Length = A + 2*0.42*H + 2*hook - bend deductions
        crank_extra = 2.0 * (0.42 * h)
        bend_deduction = 4.0 * (1.0 * d_m)  # 45 deg bends
        cut_length = max(0.0, (a + crank_extra + 2.0 * hook_len) - bend_deduction)
        shape_desc = "Cranked / Bent-up Slab Bar (45°)"
    elif shape_code == 'RECT_STIRRUP':
        # Perimeter = 2*(A + B) + 2*hooks (each 10d or 75mm min) - 3x90° bends (3*2d) - 2x135° bends (2*3d)
        hook_allowance = 2.0 * max(0.075, 10.0 * d_m)
        bend_deductions = (3.0 * 2.0 * d_m) + (2.0 * 3.0 * d_m)
        cut_length = max(0.0, (2.0 * (a + b) + hook_allowance) - bend_deductions)
        shape_desc = "Rectangular Column/Beam Stirrup (135° Hooks)"
    elif shape_code == 'CIRCULAR_TIE':
        dia_ring = a  # Diameter of circular tie
        cut_length = max(0.0, (math.pi * dia_ring) + 2.0 * max(0.075, 10.0 * d_m))
        shape_desc = "Circular Column Link / Tie"
    elif shape_code == 'CHAIR_BAR':
        # Chair for slab double mesh: Top width A + 2*Legs B + 2*Feet C
        cut_length = max(0.0, a + 2.0 * b + 2.0 * c)
        shape_desc = "Spacer Chair Bar"
    else:  # CUSTOM or other
        cut_length = dimensions.get('length', a)
        shape_desc = "Custom Bar Profile"

    cut_length = round(cut_length, 3)
    total_length = round(cut_length * total_bars, 3)
    total_weight_kg = round(total_length * unit_weight, 2)
    total_weight_mt = round(total_weight_kg / 1000.0, 4)

    return {
        'shape_code': shape_code,
        'shape_desc': shape_desc,
        'diameter_mm': diameter_mm,
        'unit_weight_kg_m': unit_weight,
        'cut_length_m': cut_length,
        'num_members': num_members,
        'bars_per_member': bars_per_member,
        'total_bars': total_bars,
        'total_length_m': total_length,
        'total_weight_kg': total_weight_kg,
        'total_weight_mt': total_weight_mt,
        'dimensions': dimensions
    }


# --- 2. CONCRETE & FORMWORK MIX CALCULATOR ---
CONCRETE_MIX_PROPORTIONS = {
    'M10': {'ratio': (1, 3, 6), 'desc': 'PCC, Levelling Course, Mud Mat'},
    'M15': {'ratio': (1, 2, 4), 'desc': 'Plain Concrete, Mass Footings, Kerbs'},
    'M20': {'ratio': (1, 1.5, 3), 'desc': 'General RCC, Beams, Slabs (1:1.5:3)'},
    'M25': {'ratio': (1, 1, 2), 'desc': 'High Strength RCC, Columns, Heavy Slabs'},
    'M30': {'ratio': (1, 0.75, 1.5), 'desc': 'Design Mix RCC (Approx 1:0.75:1.5)'},
    'M35': {'ratio': (1, 0.6, 1.2), 'desc': 'Heavy Commercial / Bridge Columns'},
}

def calculate_concrete_materials(
    wet_volume_m3: float,
    mix_grade: str = 'M20',
    wastage_pct: float = 2.0,
    cement_bag_weight_kg: float = 50.0
) -> Dict[str, Any]:
    """
    Calculates quantities of Cement (bags), Sand/Fine Aggregate (m3 & tons),
    and Coarse Aggregate (m3 & tons) for a given wet volume of concrete.
    Dry volume conversion factor for concrete = 1.54 (to account for voids in dry ingredients).
    """
    mix_info = CONCRETE_MIX_PROPORTIONS.get(mix_grade, CONCRETE_MIX_PROPORTIONS['M20'])
    c_ratio, s_ratio, ca_ratio = mix_info['ratio']
    total_parts = c_ratio + s_ratio + ca_ratio

    dry_volume_m3 = wet_volume_m3 * 1.54 * (1.0 + (wastage_pct / 100.0))

    # Cement
    cement_vol_m3 = (c_ratio / total_parts) * dry_volume_m3
    # Density of standard Portland cement = 1440 kg/m3
    cement_weight_kg = cement_vol_m3 * 1440.0
    cement_bags = cement_weight_kg / cement_bag_weight_kg

    # Fine Aggregate (Sand / M-Sand)
    sand_vol_m3 = (s_ratio / total_parts) * dry_volume_m3
    sand_weight_tons = (sand_vol_m3 * 1600.0) / 1000.0

    # Coarse Aggregate (Gravel / Crushed Stone 10mm-20mm)
    ca_vol_m3 = (ca_ratio / total_parts) * dry_volume_m3
    ca_weight_tons = (ca_vol_m3 * 1500.0) / 1000.0

    # Recommended Water (w/c ratio ~0.48)
    water_liters = cement_weight_kg * 0.48

    return {
        'wet_volume_m3': round(wet_volume_m3, 3),
        'dry_volume_m3': round(dry_volume_m3, 3),
        'mix_grade': mix_grade,
        'ratio_str': f"{c_ratio}:{s_ratio}:{ca_ratio}",
        'cement': {
            'volume_m3': round(cement_vol_m3, 3),
            'weight_kg': round(cement_weight_kg, 1),
            'bags': round(cement_bags, 1),
            'exact_bags': math.ceil(cement_bags)
        },
        'fine_aggregate_sand': {
            'volume_m3': round(sand_vol_m3, 3),
            'volume_cft': round(sand_vol_m3 * 35.3147, 2),
            'weight_tons': round(sand_weight_tons, 2)
        },
        'coarse_aggregate': {
            'volume_m3': round(ca_vol_m3, 3),
            'volume_cft': round(ca_vol_m3 * 35.3147, 2),
            'weight_tons': round(ca_weight_tons, 2)
        },
        'water_liters': round(water_liters, 1),
        'admixture_kg': round(cement_weight_kg * 0.008, 2)
    }


# --- 3. BRICKWORK & BLOCKWORK CALCULATOR ---
def calculate_brickwork(
    wall_length_m: float,
    wall_height_m: float,
    wall_thickness_m: float = 0.23,
    brick_type: str = 'MODULAR',
    mortar_ratio: str = '1:6',
    deductions_m3: float = 0.0,
    wastage_pct: float = 5.0
) -> Dict[str, Any]:
    """Calculates total bricks/blocks and mortar (cement bags + sand) needed."""
    gross_volume = wall_length_m * wall_height_m * wall_thickness_m
    net_volume = max(0.0, gross_volume - deductions_m3)

    if brick_type == 'MODULAR':
        l_nom, w_nom, h_nom = 0.19, 0.09, 0.09
        l_jnt, w_jnt, h_jnt = 0.20, 0.10, 0.10
    elif brick_type == 'TRADITIONAL':
        l_nom, w_nom, h_nom = 0.23, 0.115, 0.075
        l_jnt, w_jnt, h_jnt = 0.24, 0.125, 0.085
    elif brick_type == 'AAC_BLOCK':
        l_nom, w_nom, h_nom = 0.60, 0.15, 0.20
        l_jnt, w_jnt, h_jnt = 0.603, 0.15, 0.203
    else:
        l_nom, w_nom, h_nom = 0.19, 0.09, 0.09
        l_jnt, w_jnt, h_jnt = 0.20, 0.10, 0.10

    vol_brick_with_mortar = l_jnt * w_jnt * h_jnt
    vol_brick_without_mortar = l_nom * w_nom * h_nom

    bricks_per_m3 = 1.0 / vol_brick_with_mortar
    total_bricks_theoretical = net_volume * bricks_per_m3
    total_bricks_with_waste = total_bricks_theoretical * (1.0 + (wastage_pct / 100.0))

    actual_bricks_vol = total_bricks_theoretical * vol_brick_without_mortar
    wet_mortar_vol_m3 = max(0.0, net_volume - actual_bricks_vol)
    dry_mortar_vol_m3 = wet_mortar_vol_m3 * 1.33

    parts = [int(p) for p in mortar_ratio.split(':')]
    c_part, s_part = parts[0], parts[1]
    tot_parts = c_part + s_part

    cement_vol_m3 = (c_part / tot_parts) * dry_mortar_vol_m3
    cement_kg = cement_vol_m3 * 1440.0
    cement_bags = cement_kg / 50.0

    sand_vol_m3 = (s_part / tot_parts) * dry_mortar_vol_m3
    sand_tons = (sand_vol_m3 * 1600.0) / 1000.0

    return {
        'net_volume_m3': round(net_volume, 3),
        'brick_type': brick_type,
        'mortar_ratio': mortar_ratio,
        'total_bricks_count': math.ceil(total_bricks_with_waste),
        'bricks_theoretical': round(total_bricks_theoretical, 1),
        'wet_mortar_m3': round(wet_mortar_vol_m3, 3),
        'dry_mortar_m3': round(dry_mortar_vol_m3, 3),
        'cement_bags': round(cement_bags, 2),
        'cement_kg': round(cement_kg, 1),
        'sand_m3': round(sand_vol_m3, 3),
        'sand_tons': round(sand_tons, 2),
        'sand_cft': round(sand_vol_m3 * 35.3147, 2)
    }


# --- 4. PLASTERING & FINISHES CALCULATOR ---
def calculate_plastering(
    area_m2: float,
    thickness_mm: float = 12.0,
    mortar_ratio: str = '1:4',
    wastage_pct: float = 15.0
) -> Dict[str, Any]:
    """Calculates Cement (bags) and Sand (m3) required for plastering works."""
    wet_volume_m3 = area_m2 * (thickness_mm / 1000.0)
    dry_volume_m3 = wet_volume_m3 * 1.35 * (1.0 + (wastage_pct / 100.0))

    parts = [int(p) for p in mortar_ratio.split(':')]
    c_part, s_part = parts[0], parts[1]
    tot_parts = c_part + s_part

    cement_vol_m3 = (c_part / tot_parts) * dry_volume_m3
    cement_kg = cement_vol_m3 * 1440.0
    cement_bags = cement_kg / 50.0

    sand_vol_m3 = (s_part / tot_parts) * dry_volume_m3
    sand_tons = (sand_vol_m3 * 1600.0) / 1000.0

    return {
        'area_m2': round(area_m2, 2),
        'thickness_mm': thickness_mm,
        'mortar_ratio': mortar_ratio,
        'wet_volume_m3': round(wet_volume_m3, 3),
        'dry_volume_m3': round(dry_volume_m3, 3),
        'cement_bags': round(cement_bags, 2),
        'cement_kg': round(cement_kg, 1),
        'sand_m3': round(sand_vol_m3, 3),
        'sand_tons': round(sand_tons, 2),
        'sand_cft': round(sand_vol_m3 * 35.3147, 2)
    }


# --- 5. EARTHWORK & EXCAVATION CALCULATOR ---
def calculate_earthwork(
    length_m: float,
    width_m: float,
    depth_m: float,
    side_slope_h_v: float = 0.5,
    swell_factor: float = 1.20,
    compaction_factor: float = 0.85
) -> Dict[str, Any]:
    """Calculates pit/trench excavation volume with trapezoidal side slopes."""
    a_bottom = length_m * width_m
    top_length = length_m + (2.0 * side_slope_h_v * depth_m)
    top_width = width_m + (2.0 * side_slope_h_v * depth_m)
    a_top = top_length * top_width

    mid_length = (length_m + top_length) / 2.0
    mid_width = (width_m + top_width) / 2.0
    a_mid = mid_length * mid_width

    in_situ_volume_m3 = (depth_m / 6.0) * (a_bottom + a_top + 4.0 * a_mid)
    loose_disposal_m3 = in_situ_volume_m3 * swell_factor

    return {
        'bottom_area_m2': round(a_bottom, 2),
        'top_area_m2': round(a_top, 2),
        'depth_m': depth_m,
        'in_situ_volume_m3': round(in_situ_volume_m3, 3),
        'loose_disposal_m3': round(loose_disposal_m3, 3),
        'truck_loads_10m3': math.ceil(loose_disposal_m3 / 10.0),
        'compaction_factor': compaction_factor,
        'swell_factor': swell_factor
    }


# --- 6. RATE ANALYSIS (DETAILED UNIT PRICE BREAKDOWN) ---
def compute_rate_analysis(
    materials: List[Dict[str, Any]],
    labors: List[Dict[str, Any]],
    equipment: List[Dict[str, Any]],
    subcontractor_cost: float = 0.0,
    water_and_electricity_pct: float = 1.5,
    contractor_profit_pct: float = 10.0,
    overhead_pct: float = 5.0,
    contingency_pct: float = 1.0,
    output_qty: float = 1.0,
    unit_name: str = 'm3'
) -> Dict[str, Any]:
    """Calculates detailed composite unit rate per unit of work."""
    mat_total = 0.0
    for m in materials:
        qty = float(m.get('qty', 0))
        rate = float(m.get('rate', 0))
        waste = float(m.get('waste_pct', 0))
        sub = qty * rate * (1.0 + (waste / 100.0))
        m['subtotal'] = round(sub, 2)
        mat_total += sub

    lab_total = 0.0
    for l in labors:
        qty = float(l.get('qty', 0))
        rate = float(l.get('rate', 0))
        sub = qty * rate
        l['subtotal'] = round(sub, 2)
        lab_total += sub

    eq_total = 0.0
    for e in equipment:
        qty = float(e.get('qty', 0))
        rate = float(e.get('rate', 0))
        sub = qty * rate
        e['subtotal'] = round(sub, 2)
        eq_total += sub

    direct_prime_cost = mat_total + lab_total + eq_total + subcontractor_cost
    water_cost = direct_prime_cost * (water_and_electricity_pct / 100.0)
    prime_plus_sundries = direct_prime_cost + water_cost
    overhead_cost = prime_plus_sundries * (overhead_pct / 100.0)
    profit_cost = (prime_plus_sundries + overhead_cost) * (contractor_profit_pct / 100.0)
    contingency_cost = (prime_plus_sundries + overhead_cost + profit_cost) * (contingency_pct / 100.0)

    grand_total = prime_plus_sundries + overhead_cost + profit_cost + contingency_cost
    unit_rate = grand_total / max(0.0001, output_qty)

    return {
        'output_qty': output_qty,
        'unit': unit_name,
        'material_total': round(mat_total, 2),
        'labor_total': round(lab_total, 2),
        'equipment_total': round(eq_total, 2),
        'subcontractor_cost': round(subcontractor_cost, 2),
        'direct_prime_cost': round(direct_prime_cost, 2),
        'water_and_sundries': round(water_cost, 2),
        'overhead_cost': round(overhead_cost, 2),
        'profit_cost': round(profit_cost, 2),
        'contingency_cost': round(contingency_cost, 2),
        'grand_total_batch': round(grand_total, 2),
        'calculated_unit_rate': round(unit_rate, 2),
        'materials': materials,
        'labors': labors,
        'equipment': equipment
    }


# --- 7. EARNED VALUE MANAGEMENT (EVM) CALCULATOR ---
def calculate_evm_metrics(
    planned_value: float,
    earned_value: float,
    actual_cost: float,
    budget_at_completion: float
) -> Dict[str, Any]:
    """Computes all standard Earned Value Analysis metrics."""
    cost_variance = earned_value - actual_cost
    schedule_variance = earned_value - planned_value

    cpi = (earned_value / actual_cost) if actual_cost > 0 else 1.0
    spi = (earned_value / planned_value) if planned_value > 0 else 1.0

    eac = (budget_at_completion / cpi) if cpi > 0 else budget_at_completion
    vac = budget_at_completion - eac
    
    remaining_work = budget_at_completion - earned_value
    remaining_funds = budget_at_completion - actual_cost
    tcpi = (remaining_work / remaining_funds) if remaining_funds > 0 else 1.0

    status_cost = "On Budget" if cost_variance >= 0 else "Over Budget"
    status_schedule = "On Schedule" if schedule_variance >= 0 else "Behind Schedule"

    return {
        'planned_value_pv': round(planned_value, 2),
        'earned_value_ev': round(earned_value, 2),
        'actual_cost_ac': round(actual_cost, 2),
        'budget_at_completion_bac': round(budget_at_completion, 2),
        'cost_variance_cv': round(cost_variance, 2),
        'schedule_variance_sv': round(schedule_variance, 2),
        'cpi': round(cpi, 3),
        'spi': round(spi, 3),
        'estimate_at_completion_eac': round(eac, 2),
        'variance_at_completion_vac': round(vac, 2),
        'tcpi': round(tcpi, 3),
        'cost_status': status_cost,
        'schedule_status': status_schedule,
        'cost_variance_pct': round((cost_variance / earned_value * 100.0), 2) if earned_value > 0 else 0.0,
        'schedule_variance_pct': round((schedule_variance / planned_value * 100.0), 2) if planned_value > 0 else 0.0
    }
