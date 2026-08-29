#!/usr/bin/env python3
"""Render the final thirteen full-sheet THC education gap posters.

This extends the reviewed deterministic Pillow system. WordPress education images
are supporting context only; explanatory diagrams and all text are source controlled.
"""
from __future__ import annotations

import importlib.util
import json
import math
import os
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

ROOT_DIR = Path(__file__).resolve().parent
ADAPTER = ROOT_DIR / 'run-thc-scientific-posters-normalized.py'
spec = importlib.util.spec_from_file_location('thc_poster_adapter', ADAPTER)
if spec is None or spec.loader is None:
    raise RuntimeError(f'Could not import poster adapter: {ADAPTER}')
adapter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(adapter)
base = adapter.base

# Reuse the reviewed visual system exactly.
W, H = base.W, base.H
DEEP, GREEN, GOLD, INK, MUTED = base.DEEP, base.GREEN, base.GOLD, base.INK, base.MUTED
LINE, SOFT, PALE, WHITE = base.LINE, base.SOFT, base.PALE, base.WHITE
F_H2, F_H3, F_BODY, F_SMALL, F_TINY = base.F_H2, base.F_H3, base.F_BODY, base.F_SMALL, base.F_TINY


def frame(canvas, title):
    draw = base.diagram_frame(canvas, title)
    return draw


def centered(draw, text, x, y, fnt=F_SMALL, fill=INK):
    box = draw.textbbox((0, 0), text, font=fnt)
    draw.text((x - (box[2] - box[0]) / 2, y), text, font=fnt, fill=fill)


def diagram_timeline(canvas):
    poster = CURRENT_POSTER
    draw = frame(canvas, poster['diagram_title'])
    steps = poster['diagram_steps']
    x0, x1, y = 285, 2250, 1745
    draw.line((x0, y, x1, y), fill=GREEN, width=11)
    gap = (x1 - x0) / max(1, len(steps) - 1)
    for i, (label, note) in enumerate(steps):
        x = int(x0 + i * gap)
        draw.ellipse((x - 28, y - 28, x + 28, y + 28), fill=GOLD if i in (0, len(steps)-1) else GREEN, outline=DEEP, width=4)
        centered(draw, label, x, y - 118, F_H3, DEEP)
        base.draw_wrapped(draw, (x - 180, y + 55), note, F_TINY, MUTED, 360, line_gap=4, max_lines=4)
    base.draw_wrapped(draw, (285, 2040), poster['diagram_note'], F_SMALL, INK, 1960, max_lines=2)


def diagram_map(canvas):
    poster = CURRENT_POSTER
    draw = frame(canvas, poster['diagram_title'])
    gx, gy, cw, ch = 300, 1605, 290, 165
    values = poster.get('map_values', [68, 74, 82, 77, 65, 71, 86, 91, 84, 70, 64, 73, 81, 76, 62])
    labels = poster.get('map_labels', ['A1','A2','A3','A4','A5','B1','B2','B3','B4','B5','C1','C2','C3','C4','C5'])
    for idx, val in enumerate(values[:15]):
        r, c = divmod(idx, 5)
        x, y = gx + c*cw, gy + r*ch
        strength = max(0, min(1, (val - min(values)) / max(1, max(values)-min(values))))
        fill = '#EEF4EF' if strength < .34 else '#D8E9DC' if strength < .67 else '#BFD9C6'
        draw.rounded_rectangle((x, y, x+240, y+125), radius=18, fill=fill, outline=LINE, width=2)
        draw.text((x+20, y+18), labels[idx], font=F_TINY, fill=MUTED)
        centered(draw, str(val), x+120, y+52, F_H3, DEEP)
    base.draw_wrapped(draw, (330, 2080), poster['diagram_note'], F_SMALL, INK, 1900, max_lines=2)


def diagram_balance(canvas):
    poster = CURRENT_POSTER
    draw = frame(canvas, poster['diagram_title'])
    left, right = poster['balance_left'], poster['balance_right']
    cx, cy = 1275, 1810
    draw.line((cx-640, cy, cx+640, cy), fill=DEEP, width=14)
    draw.polygon([(cx, cy-20),(cx-90, cy+180),(cx+90, cy+180)], fill=GOLD, outline=DEEP)
    for x, title, items, fill in [(620, left[0], left[1], SOFT), (1930, right[0], right[1], '#F8F5EA')]:
        base.rounded(draw, (x-390, 1580, x+390, 2010), 26, fill=fill, outline=LINE, width=3)
        centered(draw, title, x, 1625, F_H3, DEEP)
        yy = 1700
        for item in items:
            draw.ellipse((x-330, yy+9, x-318, yy+21), fill=GREEN)
            yy = base.draw_wrapped(draw, (x-300, yy), item, F_SMALL, INK, 580, max_lines=2) + 12
    base.draw_wrapped(draw, (330, 2070), poster['diagram_note'], F_SMALL, INK, 1900, max_lines=2)


def diagram_branch(canvas):
    poster = CURRENT_POSTER
    draw = frame(canvas, poster['diagram_title'])
    root = (1275, 1610)
    base.rounded(draw, (1030, 1570, 1520, 1690), 22, fill=SOFT, outline=LINE, width=2)
    centered(draw, poster['branch_root'], 1275, 1605, F_H3, DEEP)
    branches = poster['branches']
    for i, (head, note) in enumerate(branches):
        x = 360 + i * 635
        y = 1830
        base.arrow(draw, (1275, 1700), (x+190, y-35), GREEN, 7, 18)
        base.rounded(draw, (x, y, x+500, y+235), 22, fill=WHITE if i%2==0 else PALE, outline=LINE, width=2)
        centered(draw, head, x+250, y+28, F_H3, DEEP)
        base.draw_wrapped(draw, (x+30, y+90), note, F_TINY, MUTED, 440, max_lines=4)
    base.draw_wrapped(draw, (330, 2080), poster['diagram_note'], F_SMALL, INK, 1900, max_lines=2)


def diagram_curve(canvas):
    poster = CURRENT_POSTER
    draw = frame(canvas, poster['diagram_title'])
    ox, oy, xe, yt = 360, 2020, 2260, 1600
    draw.line((ox, oy, xe, oy), fill=DEEP, width=6)
    draw.line((ox, oy, ox, yt), fill=DEEP, width=6)
    pts = []
    for i in range(140):
        t = i/139
        x = ox + t*(xe-ox-70)
        y = oy - poster.get('curve_height', 300)*(1-math.exp(-poster.get('curve_rate',4)*t))
        if poster.get('curve_drop'):
            y += poster['curve_drop'] * max(0, t-.78)**2 * 8
        pts.append((x,y))
    draw.line(pts, fill=GREEN, width=12)
    for label, tx, ty in poster.get('curve_labels', []):
        draw.text((tx,ty), label, font=F_TINY, fill=DEEP)
    draw.text((940, 2060), poster.get('x_label','Increasing input →'), font=F_SMALL, fill=MUTED)
    draw.text((185, 1680), poster.get('y_label','Measured response'), font=F_SMALL, fill=MUTED)
    base.draw_wrapped(draw, (420, 2110), poster['diagram_note'], F_SMALL, INK, 1650, max_lines=2)


def diagram_layers(canvas):
    poster = CURRENT_POSTER
    draw = frame(canvas, poster['diagram_title'])
    layers = poster['layers']
    y = 1600
    for i, (head, note) in enumerate(layers):
        x0 = 270 + i*455
        base.rounded(draw, (x0, y, x0+395, y+380), 24, fill=SOFT if i%2==0 else '#F8F5EA', outline=LINE, width=2)
        centered(draw, head, x0+198, y+35, F_H3, DEEP)
        base.draw_wrapped(draw, (x0+30, y+105), note, F_SMALL, INK, 335, max_lines=6)
        if i < len(layers)-1:
            base.arrow(draw, (x0+405, y+190), (x0+445, y+190), GREEN, 6, 16)
    base.draw_wrapped(draw, (330, 2040), poster['diagram_note'], F_SMALL, MUTED, 1900, max_lines=2)


def diagram_risk(canvas):
    poster = CURRENT_POSTER
    draw = frame(canvas, poster['diagram_title'])
    x0, y0 = 360, 1605
    headers = poster['risk_headers']
    for c, h in enumerate(headers):
        centered(draw, h, x0+330+c*520, y0, F_H3, DEEP)
    rows = poster['risk_rows']
    for r, row in enumerate(rows):
        yy = y0+85+r*105
        draw.text((235, yy+18), row[0], font=F_SMALL, fill=GREEN)
        for c, text in enumerate(row[1:]):
            xx = x0+70+c*520
            base.rounded(draw, (xx, yy, xx+430, yy+78), 16, fill=SOFT if (r+c)%2==0 else '#F8F5EA', outline=LINE, width=2)
            centered(draw, text, xx+215, yy+22, F_TINY, INK)
    base.draw_wrapped(draw, (330, 2070), poster['diagram_note'], F_SMALL, INK, 1900, max_lines=2)


base.DIAGRAMS.update({
    'timeline2': diagram_timeline,
    'map2': diagram_map,
    'balance2': diagram_balance,
    'branch2': diagram_branch,
    'curve2': diagram_curve,
    'layers2': diagram_layers,
    'risk2': diagram_risk,
})

POSTERS = [
    {
      'id':'THC-LIFE-01','filename':'THC-LIFE-01_Seed_Vigor_Storage_Germination_Testing_Full_Sheet_Infographic.png',
      'title':'SEED VIGOR, STORAGE & GERMINATION TESTING','subtitle':'Viability answers “can it germinate?” Vigor asks how strongly and uniformly the lot establishes.',
      'media_terms':['seed anatomy germination'],'source_label':'Seed anatomy / germination reviewed education visual',
      'fact_heading':'Keep the seed lot traceable','facts':[('VIABILITY','Final germination under a defined test.'),('VIGOR','Speed, uniformity and performance across conditions.'),('STORAGE','Moisture, temperature, oxygen exposure, damage and original seed maturity shape deterioration.')],
      'diagram':'timeline2','diagram_title':'A useful seed-lot test preserves time, not only the final percentage','diagram_steps':[('SAMPLE','Representative seeds; stable lot ID.'),('START','Same method, media, moisture and temperature.'),('COUNT','Record daily emergence, abnormal seedlings and losses.'),('COMPARE','Use repeated lot tests to detect change.')],
      'diagram_note':'A seed lot can remain partly viable while vigor declines. Keep emergence timing and seedling quality with the final germination percentage.',
      'panels':[('STORAGE RECORD','A calendar age is not enough to describe seed condition.',['Lot harvest date and parent IDs.','Storage temperature/moisture history.','Container/opening history and test dates.']),('INTERPRET THE TEST','A small nonrepresentative sample can give false confidence.',['Define the sample size before testing.','Separate no-germination from post-emergence loss.','Repeat suspicious results with a new random subsample.'])],
      'footer':'Evidence context: seed science distinguishes viability from vigor; storage conditions and sampling method must remain attached to the result.'
    },
    {
      'id':'THC-LIFE-02','filename':'THC-LIFE-02_Cutting_Rooting_Hardening_Establishment_Full_Sheet_Infographic.png',
      'title':'CUTTING ROOTING → HARDENING → ESTABLISHMENT','subtitle':'The first visible root is the beginning of acclimation, not the end of propagation.',
      'media_terms':['cloning guide clone propagation'],'source_label':'Cloning / propagation reviewed education visual',
      'fact_heading':'The cutting must rebuild water balance','facts':[('CUTTING','Leaves lose water before a new root system can replace it.'),('ROOTING','Adventitious roots require oxygen, moisture, suitable temperature and healthy donor tissue.'),('HARDENING','Humidity and light are changed gradually as root uptake capacity grows.')],
      'diagram':'timeline2','diagram_title':'Propagation is a staged change in water-supply capacity','diagram_steps':[('CUT','Sanitary cut; identify donor and date.'),('INITIATE','High humidity limits water loss while roots form.'),('ROOT','Confirm root mass, not one root tip.'),('HARDEN','Increase evaporative demand gradually.'),('ESTABLISH','New shoot growth + normal water use.')],
      'diagram_note':'Sudden low humidity, strong light or dry media can overwhelm a small new root system even after roots are visible.',
      'panels':[('ROOT-ZONE CONDITIONS','More water is not always safer. Saturated media can reduce oxygen.',['Keep media moist but aerated.','Record propagation temperature and humidity.','Remove weak or symptomatic material from the clean cohort.']),('ESTABLISHMENT EVIDENCE','Use plant response instead of a fixed-day calendar.',['Expanding new growth.','Increasing water use without wilt.','Roots occupying the intended transplant plug or container.'])],
      'footer':'Teaching Healthy Cultivation · Propagation records should preserve donor ID, cutting date, environment, first roots, hardening changes and establishment evidence.'
    },
    {
      'id':'THC-ENV-01','filename':'THC-ENV-01_Sensor_Placement_Dew_Point_Canopy_Microclimates_Full_Sheet_Infographic.png',
      'title':'SENSOR PLACEMENT, DEW POINT & CANOPY MICROCLIMATES','subtitle':'A sensor can be accurate at its location and still misrepresent the crop.',
      'media_terms':['vpd temperature humidity'],'source_label':'VPD / environment reviewed education visual',
      'fact_heading':'Measure the crop environment','facts':[('PLACEMENT','Walls, outlets, humidifiers, lights and doors create local bias.'),('CANOPY','Dense foliage can hold a different temperature/humidity than exposed room air.'),('DEW POINT','Condensation risk rises when a surface approaches the air’s dew-point temperature.')],
      'diagram':'map2','diagram_title':'Map environmental sensors like a measurement network','map_values':[72,74,76,75,71,74,78,82,79,73,70,75,80,76,69],
      'diagram_note':'Compare multiple positions and heights through irrigation and lights-off transitions. A room average can hide a humid canopy interior or a hot exposed edge.',
      'panels':[('SENSOR QA','Treat sensors as instruments, not permanent truth.',['Record make/model and location.','Cross-check side-by-side periodically.','Document calibration, offsets and replacement dates.']),('TRANSITIONS REVEAL RISK','Steady averages hide short high-risk periods.',['Timestamp lights on/off.','Timestamp irrigation and humidification.','Track recovery time after disturbances.'])],
      'footer':'Environmental interpretation should preserve sensor position, time, crop-plane height and instrument state with each reading.'
    },
    {
      'id':'THC-LIGHT-05','filename':'THC-LIGHT-05_Fixture_Height_Uniformity_Edge_Loss_Full_Sheet_Infographic.png',
      'title':'FIXTURE HEIGHT, UNIFORMITY & EDGE LOSS','subtitle':'Light management is a spatial geometry problem, not a center-reading contest.',
      'media_terms':['light measurement instrumentation'],'source_label':'Light measurement instrumentation reviewed support visual',
      'fact_heading':'Geometry changes distribution','facts':[('HEIGHT','Distance changes intensity distribution and overlap.'),('EDGE','Canopy borders often receive less light than central zones.'),('OVERLAP','Multiple fixtures can create valleys or peaks depending on spacing and height.')],
      'diagram':'map2','diagram_title':'Uniformity is visible only when the whole crop plane is mapped','map_values':[420,510,555,505,415,515,650,710,645,500,545,700,760,695,535],
      'diagram_note':'Preserve each PPFD reading plus mean, minimum, maximum and variability. Re-map when fixture height, dimming, canopy height or reflective geometry changes.',
      'panels':[('HEIGHT IS NOT A UNIVERSAL TARGET','The useful height depends on fixture optics, power, crop plane and desired distribution.',['Follow manufacturer safety/thermal guidance.','Map the actual installation.','Check leaf temperature and plant response.']),('EDGE LOSS IS ACTIONABLE','A high center point can hide underlit perimeter tissue.',['Compare center and perimeter zones.','Adjust spacing before simply adding intensity.','Keep measurement geometry unchanged for before/after maps.'])],
      'footer':'Teaching Healthy Cultivation · Use crop-plane maps to evaluate fixture geometry; do not infer uniformity from one center PPFD reading.'
    },
    {
      'id':'THC-WATER-01','filename':'THC-WATER-01_pH_vs_Alkalinity_Buffering_Full_Sheet_Infographic.png',
      'title':'pH VS ALKALINITY: WHY BUFFERING MATTERS','subtitle':'Similar pH readings can hide very different acid-neutralizing capacity.',
      'media_terms':['ph water quality alkalinity'],'source_label':'pH / water-quality reviewed education visual',
      'fact_heading':'Two different water properties','facts':[('pH','Hydrogen-ion activity at the measurement moment.'),('ALKALINITY','Capacity to neutralize acid; often influenced by bicarbonate/carbonate.'),('TREND','Repeated irrigation can shift root-zone chemistry even when source-water pH looks acceptable.')],
      'diagram':'balance2','diagram_title':'pH is a state reading; alkalinity helps describe resistance to change','balance_left':('LOW BUFFER',['Little acid-neutralizing reserve.','pH can move with relatively small additions.','Verify meter + mixing consistency.']),'balance_right':('HIGH BUFFER',['More acid-neutralizing load.','Repeated irrigation can push substrate trends.','Measure alkalinity rather than guessing from pH.']),
      'diagram_note':'Do not infer alkalinity from EC or pH alone. When buffering drives management, use a validated water analysis and follow the root-zone trend over time.',
      'panels':[('SOURCE WATER RECORD','Keep chemistry variables separate.',['pH with calibration state.','EC with units.','Alkalinity as a separate validated result.']),('ROOT-ZONE RESPONSE','Management is about the system, not one reservoir number.',['Track repeated irrigation inputs.','Measure substrate/root-zone pH consistently.','Change acid strategy only with evidence of the buffering load.'])],
      'footer':'Greenhouse water-quality principle: pH and alkalinity answer different questions. Buffer capacity must be measured, not assumed.'
    },
    {
      'id':'THC-WATER-02','filename':'THC-WATER-02_EC_PPM_TDS_Irrigation_Dryback_Full_Sheet_Infographic.png',
      'title':'EC, PPM/TDS & IRRIGATION DRYBACK MEASUREMENT','subtitle':'Keep the original conductivity measurement and the irrigation timeline together.',
      'media_terms':['ec ppm tds water irrigation dryback'],'source_label':'EC / irrigation reviewed education visual',
      'fact_heading':'Do not lose the measurement method','facts':[('EC','Electrical conductivity reflects ionic conduction; record units.'),('PPM/TDS','Many handheld meters calculate this from EC using a conversion factor.'),('DRYBACK','A measured change in water content or container mass over time—not one universal percentage.')],
      'diagram':'curve2','diagram_title':'Root-zone water status changes between irrigation events','curve_height':300,'curve_rate':3.2,'x_label':'Time after irrigation →','y_label':'Cumulative dryback','curve_labels':[('IRRIGATION',390,1940),('RAPID USE / DRAINAGE',720,1770),('SLOWER CHANGE',1500,1690)],
      'diagram_note':'Event size, frequency, media, roots, container geometry and environmental demand all change the curve. Define how water status was measured.',
      'panels':[('METER DISCIPLINE','Numbers without method metadata are hard to compare.',['Record EC and units even if PPM is displayed.','Record the meter’s PPM conversion scale.','Calibrate, rinse and preserve raw readings.']),('IRRIGATION DISCIPLINE','Daily total volume does not describe event pattern.',['Record event size and time.','Record drainage/runoff method when used.','Compare dryback with PPFD, temperature and humidity.'])],
      'footer':'Teaching Healthy Cultivation · EC, PPM/TDS and dryback become comparable only when units, conversion, instrument and irrigation method are preserved.'
    },
    {
      'id':'THC-IPM-01','filename':'THC-IPM-01_Scouting_Differential_Diagnosis_Action_Threshold_Full_Sheet_Infographic.png',
      'title':'SCOUTING MAP → DIFFERENTIAL DIAGNOSIS → ACTION THRESHOLD','subtitle':'A repeatable scouting system finds change before a close-up photo becomes the whole diagnosis.',
      'media_terms':['ipm pest scouting beneficial insect'],'source_label':'IPM / scouting reviewed education visual',
      'fact_heading':'Three decisions, not one symptom','facts':[('SCOUT','Use the same route and sampling unit over time.'),('DIFFERENTIAL','Compare plausible biotic and abiotic causes using spatial and physical evidence.'),('THRESHOLD','Define the decision trigger from risk, crop stage, rate of increase and available controls.')],
      'diagram':'branch2','diagram_title':'Use pattern evidence to narrow the cause before treatment','branch_root':'REPEATED OBSERVATION','branches':[('BIOTIC?','Organisms, signs, lesions, webbing, frass or spreading clusters.'),('ABIOTIC?','Irrigation zones, lamp footprints, airflow, sprays, root stress or mechanical pattern.'),('UNCERTAIN?','Collect magnification, samples, environmental/root-zone data and follow progression.')],
      'diagram_note':'Record zero detections as well as positives. Distribution and change through time are often more diagnostic than one damaged leaf.',
      'panels':[('ACTION THRESHOLDS','Detection and intervention are related but not identical.',['Crop stage changes risk.','Rate of population increase matters.','Available biological/physical/chemical controls change the decision.']),('RESISTANCE & COMPATIBILITY','Control history is part of IPM evidence.',['Record active ingredient and mode-of-action group.','Follow all pesticide labels and legal crop restrictions.','Check compatibility with beneficial organisms.'])],
      'footer':'IPM principle: scout consistently, preserve spatial evidence, rank alternatives, and measure the post-treatment response.'
    },
    {
      'id':'THC-TRAIN-01','filename':'THC-TRAIN-01_Apical_Dominance_Branch_Response_Full_Sheet_Infographic.png',
      'title':'APICAL DOMINANCE & BRANCH RESPONSE','subtitle':'Training changes resource allocation and branch competition—not just plant shape.',
      'media_terms':['training topping lst canopy'],'source_label':'Training / canopy reviewed education visual',
      'fact_heading':'Start with an architectural objective','facts':[('APEX','The main shoot influences axillary-bud growth through interacting light and hormonal signals.'),('BEND','Changing orientation and exposure can redistribute branch growth without removing the apex.'),('REMOVE','Topping removes the dominant tip and can shift growth toward remaining branches.')],
      'diagram':'branch2','diagram_title':'One intervention can redistribute growth across the whole shoot system','branch_root':'MAIN APEX / CANOPY OBJECTIVE','branches':[('BEND','Lower height; expose laterals; preserve tissue.'),('TOP','Remove apex; redistribute growth; create a wound.'),('OBSERVE','Track branch extension, canopy height and recovery before the next major stress.')],
      'diagram_note':'Cultivars and developmental stages can respond differently. Measure the architecture before and after instead of assuming a named technique has one outcome.',
      'panels':[('DEFINE SUCCESS','A technique is not the objective.',['Target canopy height or occupied area.','Desired branch distribution and access.','Light/airflow goal after recovery.']),('TRACK RESPONSE','Training becomes testable when geometry is recorded.',['Branch/node positions before intervention.','New branch extension after intervention.','PPFD and canopy-height map after recovery.'])],
      'footer':'Teaching Healthy Cultivation · Training decisions should connect intervention → recovery → measurable canopy architecture.'
    },
    {
      'id':'THC-TRAIN-02','filename':'THC-TRAIN-02_Wound_Recovery_Stress_Stacking_Full_Sheet_Infographic.png',
      'title':'WOUND RECOVERY & STRESS STACKING','subtitle':'Topping, pruning and breakage create biological work that should be allowed to recover before another major stress.',
      'media_terms':['training pruning topping plant wound'],'source_label':'Pruning / training reviewed education visual',
      'fact_heading':'Recovery is observed, not scheduled','facts':[('WOUND','Tissue is removed or damaged; sanitation and structural integrity matter.'),('RESPONSE','Defense signaling, sealing, redistribution and new growth follow.'),('RECOVERY','New growth rate, leaf posture and stable water use provide evidence that the plant is rebalancing.')],
      'diagram':'timeline2','diagram_title':'Separate major interventions enough to preserve diagnostic clarity','diagram_steps':[('CUT / BEND','Document severity and clean-tool method.'),('EARLY RESPONSE','Inspect wounds; avoid new mechanical injury.'),('RECOVERY','Look for stable posture and new extension.'),('NEXT CHANGE','Only then stack transplant, light or stage changes when possible.')],
      'diagram_note':'Heavy pruning + transplant + large light change + reproductive transition on the same day makes cause-and-effect difficult to interpret.',
      'panels':[('SANITATION & STRUCTURE','Wounds are also access points and mechanical weak spots.',['Use clean tools.','Inspect splitting/crushing.','Support damaged branches before loading increases.']),('STRESS LOG','Record interventions like environmental events.',['Date and severity.','Other changes within the same period.','Recovery observations and abnormal progression.'])],
      'footer':'A fixed number of recovery days is not universal. Use plant response and root/environment context before the next high-impact intervention.'
    },
    {
      'id':'THC-TRAIN-03','filename':'THC-TRAIN-03_Canopy_Geometry_Support_Airflow_PPFD_Full_Sheet_Infographic.png',
      'title':'CANOPY GEOMETRY, SUPPORT, AIRFLOW & PPFD','subtitle':'A flat-looking canopy can still contain hidden light valleys, hot edges and humid interior pockets.',
      'media_terms':['scrog canopy training airflow'],'source_label':'Canopy training reviewed education visual',
      'fact_heading':'Measure the 3-D crop plane','facts':[('HEIGHT','Record canopy height at multiple positions.'),('LIGHT','Map PPFD after structural changes.'),('AIR','Inspect internal foliage zones, not only aisle air or visible fan movement.')],
      'diagram':'map2','diagram_title':'Combine a crop-plane map with structural measurements','map_values':[58,66,72,65,56,64,78,88,77,62,60,73,84,72,59],
      'diagram_note':'Map values can represent PPFD, normalized airflow checks or another defined spatial metric—but units and method must be explicit. One map cannot stand in for all three.',
      'panels':[('SUPPORT BEFORE FAILURE','Structural support is part of canopy design.',['Install support before branch loading becomes severe.','Keep access lanes for inspection and sanitation.','Avoid support geometry that traps dense stagnant foliage.']),('UNIFORMITY IS MULTI-VARIABLE','A useful canopy balances more than height.',['Height range and occupied area.','Light distribution at the crop plane.','Air movement / humidity inside dense foliage.'])],
      'footer':'Teaching Healthy Cultivation · Re-measure canopy geometry after major training; do not treat visual flatness as proof of uniform light or airflow.'
    },
    {
      'id':'THC-OUT-01','filename':'THC-OUT-01_Outdoor_Site_Microclimate_Mapping_Full_Sheet_Infographic.png',
      'title':'OUTDOOR SITE MICROCLIMATE MAPPING','subtitle':'Regional weather is background; the plant experiences slope, shade, wind, drainage and nearby structures.',
      'media_terms':['outdoor microclimate site selection'],'source_label':'Outdoor cultivation reviewed education visual',
      'fact_heading':'Map the place before prescribing the crop','facts':[('SUN','Track shade and solar exposure across the day and season.'),('AIR','Windward edges, sheltered corners and low areas behave differently.'),('WATER','Slope, soil structure and drainage can create persistent wet or dry zones.')],
      'diagram':'map2','diagram_title':'A site map turns “outdoor” into measured zones','map_values':[82,88,91,78,61,80,86,76,64,55,72,68,60,53,49],'map_labels':['SUN','SUN','SUN','EDGE','SHADE','WIND','CROP','CROP','LOW','LOW','DRY','CROP','CROP','WET','SHADE'],
      'diagram_note':'Add sensor positions, irrigation zones, low spots, tree/building shade, prevailing winds and nearby pollen/pest sources. Update the map as the season changes.',
      'panels':[('SENSOR LOCATION','Convenience is not representativeness.',['Record height and shielding.','Avoid walls/roofs unless that surface is the measurement target.','Compare crop-zone readings with regional station data.']),('SOIL & IRRIGATION ZONES','One sample rarely represents an entire outdoor root zone.',['Use multiple representative observation points.','Check emitter distribution.','Record rainfall separately from irrigation.'])],
      'footer':'Outdoor cultivation benefits from spatial records: sun, shade, wind, drainage, soil/root-zone observations, irrigation and sensor locations.'
    },
    {
      'id':'THC-OUT-02','filename':'THC-OUT-02_Weather_Risk_Wind_Rain_Drainage_Pollen_Full_Sheet_Infographic.png',
      'title':'WEATHER RISK: WIND, RAIN, DRAINAGE & POLLEN/PARTICULATES','subtitle':'Outdoor risk arrives as events. Record the event before assigning the later symptom to one cause.',
      'media_terms':['outdoor rain wind pollen drift'],'source_label':'Outdoor weather-risk reviewed education visual',
      'fact_heading':'Event records preserve causality','facts':[('WIND','Mechanical load + higher evaporative demand can occur together.'),('RAIN','Wet flowers, saturated roots and delayed drying can overlap.'),('POLLEN / PARTICLES','External pollen, smoke and dust can move onto a crop; deposition alone does not prove internal chemical change.')],
      'diagram':'risk2','diagram_title':'Prepare → observe → document → respond','risk_headers':['BEFORE EVENT','DURING / AFTER','EVIDENCE TO KEEP'],'risk_rows':[['WIND','Support / tie points','Breaks, lean, wilt','gusts + damage map'],['RAIN','Drainage + spacing','wetness / ponding','rain + saturation time'],['POLLEN','source awareness','seed-set uncertainty','date + nearby flowering'],['SMOKE/DUST','clean access','surface deposits','photos + exposure source']],
      'diagram_note':'Severe-weather injury can combine mechanical damage, root stress, pathogen risk and environmental change. Preserve uncertainty when the source is unknown.',
      'panels':[('PRE-EVENT READINESS','Risk reduction begins before the forecast peak.',['Inspect support and drainage.','Keep weather alerts and crop access current.','Avoid creating new wounds immediately before severe conditions when possible.']),('POST-EVENT TRIAGE','Separate what was observed from what is inferred.',['Photograph distribution.','Record rainfall/wind/timing.','Monitor progression before treating every symptom as the same problem.'])],
      'footer':'Teaching Healthy Cultivation · Weather-event records improve diagnosis because they preserve timing, distribution and overlapping stressors.'
    },
    {
      'id':'THC-EVID-05','filename':'THC-EVID-05_Metadata_Time_Series_Reproducibility_Full_Sheet_Infographic.png',
      'title':'METADATA, TIME SERIES & REPRODUCIBILITY','subtitle':'A cultivation number without identity, method, time and context cannot reliably become evidence.',
      'media_terms':['measurement quality uncertainty'],'secondary_terms':['claim evidence audit trail'],'source_label':'Measurement-quality + evidence-audit reviewed support visuals',
      'fact_heading':'Preserve enough context to repeat the observation','facts':[('IDENTITY','Plant/batch/sample/room/instrument IDs keep records linked.'),('TIME','Repeated observations reveal baseline, trend, disturbance and recovery.'),('METHOD','Instrument, units, calibration, sampling and transformations make a result reproducible.')],
      'diagram':'layers2','diagram_title':'A reproducible record is a chain, not one spreadsheet cell','layers':[('IDENTITY','Stable plant, batch, sample, room and instrument IDs.'),('TIME','Timestamp measurements and interventions on the same timeline.'),('RAW DATA','Preserve original values, units and missing/zero observations.'),('METHOD','Calibration, sampling, exclusions and transformations.'),('INFERENCE','State what the evidence supports and what remains uncertain.')],
      'diagram_note':'When interpretation changes, preserve the old record and document the correction. Silent overwrites destroy the audit trail.',
      'panels':[('TIME-SERIES THINKING','A before/after pair can miss normal variability.',['Establish a baseline when possible.','Timestamp management changes.','Track recovery or continued progression after intervention.']),('REPRODUCIBILITY','Another person should be able to understand what was done.',['Keep units and instrument identity.','Document exclusions/corrections.','Store code or calculation rules for derived values.'])],
      'footer':'Teaching Healthy Cultivation · Use observed, measured, suspected, consistent with and confirmed by as different certainty levels.'
    }
]

# Some support visuals use slightly different naming over time. If a precise subject
# phrase does not resolve, progressively broaden within reviewed education media.
_original_resolve = base.resolve_media
FALLBACKS = [
    ['plant anatomy'], ['observation interpretation'], ['measurement quality uncertainty'],
    ['claim evidence audit trail'], ['vpd'], ['light measurement instrumentation']
]

def resolve_with_fallback(catalog, terms):
    attempts = [terms] + FALLBACKS
    last = None
    for candidate in attempts:
        try:
            return _original_resolve(catalog, candidate)
        except Exception as exc:
            last = exc
    raise RuntimeError(f'Could not resolve reviewed support media for {terms}: {last}')

base.resolve_media = resolve_with_fallback
CURRENT_POSTER = POSTERS[0]


def main():
    global CURRENT_POSTER
    if not base.USER or not base.PASSWORD:
        raise RuntimeError('WP_API_USERNAME and WP_API_PASSWORD are required')
    catalog = base.fetch_media_catalog()
    results = []
    with tempfile.TemporaryDirectory(prefix='thc-core-gap-poster-render-') as tmpdir:
        for poster in POSTERS:
            CURRENT_POSTER = poster
            print(f"Rendering {poster['id']}: {poster['title']}")
            results.append(base.render_poster(poster, catalog, tmpdir))
    report = {
        'schemaVersion': 1,
        'renderer': 'deterministic-pillow-core-gap-v1',
        'posterCount': len(results),
        'targetSize': [W, H],
        'results': results
    }
    report_path = Path(os.environ.get('POSTER_RENDER_REPORT', '/tmp/thc-core-gap-poster-render.json'))
    report_path.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2))

if __name__ == '__main__':
    main()
