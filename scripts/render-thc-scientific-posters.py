#!/usr/bin/env python3
import html
import json
import math
import os
import re
import subprocess
import tempfile
import urllib.parse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

W, H = 2550, 3300
CREAM = '#F7F3E8'
WHITE = '#FFFFFF'
DEEP = '#0D2F1B'
GREEN = '#1F6D42'
GOLD = '#D1B45A'
INK = '#163623'
MUTED = '#52675A'
LINE = '#CAD9CE'
SOFT = '#EAF1EB'
PALE = '#F0F5F0'
ROOT = Path(os.environ.get('INFOGRAPHIC_SOURCE_DIR', 'site/wordpress/assets/infographics'))
ROOT.mkdir(parents=True, exist_ok=True)
SITE = os.environ.get('WP_SITE_URL', 'https://dtfseeds.com').rstrip('/')
USER = os.environ.get('WP_API_USERNAME', '')
PASSWORD = os.environ.get('WP_API_PASSWORD', '')

FONT_CANDIDATES = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf',
]
BOLD_CANDIDATES = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf',
]

def first_existing(paths):
    for p in paths:
        if Path(p).exists():
            return p
    raise RuntimeError(f'No usable font found from {paths}')

FONT_REG = first_existing(FONT_CANDIDATES)
FONT_BOLD = first_existing(BOLD_CANDIDATES)

def font(size, bold=False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REG, size=size)

F_TITLE = font(84, True)
F_SUB = font(36)
F_KICKER = font(25, True)
F_H2 = font(42, True)
F_H3 = font(31, True)
F_BODY = font(27)
F_SMALL = font(22)
F_TINY = font(18)
F_FORMULA = font(40, True)


def norm(s):
    s = html.unescape(str(s or '')).lower().replace('_', ' ').replace('-', ' ')
    return re.sub(r'\s+', ' ', s).strip()


def curl_bytes(url, *, auth=False):
    cmd = ['curl', '-4', '--fail', '--silent', '--show-error', '--location', '--retry', '2', '--retry-delay', '2']
    if auth and USER and PASSWORD:
        cmd += ['--user', f'{USER}:{PASSWORD}']
    cmd += [url]
    return subprocess.check_output(cmd, timeout=90)


def fetch_media_catalog():
    rows = []
    for page in range(1, 11):
        params = urllib.parse.urlencode({'context': 'edit', 'per_page': 100, 'page': page})
        try:
            raw = curl_bytes(f'{SITE}/wp-json/wp/v2/media?{params}', auth=True)
        except subprocess.CalledProcessError as exc:
            if page > 1:
                break
            raise RuntimeError(f'Could not fetch WordPress media catalog: {exc}') from exc
        batch = json.loads(raw.decode('utf-8'))
        if not isinstance(batch, list) or not batch:
            break
        rows.extend(batch)
        if len(batch) < 100:
            break
    if not rows:
        raise RuntimeError('WordPress media catalog was empty')
    return rows


def media_blob(item):
    title = item.get('title', {}).get('rendered', '') if isinstance(item.get('title'), dict) else item.get('title', '')
    return norm(' '.join([title, item.get('slug', ''), item.get('alt_text', ''), item.get('source_url', '')]))


def resolve_media(catalog, terms):
    wanted = [norm(t) for t in terms]
    scored = []
    for item in catalog:
        url = item.get('source_url') or item.get('guid', {}).get('rendered', '')
        if not url:
            continue
        blob = media_blob(item)
        score = sum(8 for t in wanted if t and t in blob)
        for t in wanted:
            for tok in t.split():
                if len(tok) >= 3 and tok in blob:
                    score += 1
        if score:
            scored.append((score, item))
    if not scored:
        raise RuntimeError(f'Could not resolve supporting media for terms: {terms}')
    scored.sort(key=lambda row: (-row[0], row[1].get('id', 0)))
    return scored[0][1]


def download_media(item, tmpdir):
    url = item.get('source_url') or item.get('guid', {}).get('rendered', '')
    if not url:
        raise RuntimeError(f'Media item {item.get("id")} has no source URL')
    target = Path(tmpdir) / f'media-{item.get("id", "x")}.img'
    target.write_bytes(curl_bytes(url))
    try:
        image = Image.open(target).convert('RGB')
        image.load()
    except Exception as exc:
        raise RuntimeError(f'Could not decode supporting media {url}: {exc}') from exc
    return image


def wrapped_lines(draw, text, fnt, max_width):
    out = []
    for paragraph in str(text).split('\n'):
        words = paragraph.split()
        if not words:
            out.append('')
            continue
        line = words[0]
        for word in words[1:]:
            probe = f'{line} {word}'
            if draw.textbbox((0, 0), probe, font=fnt)[2] <= max_width:
                line = probe
            else:
                out.append(line)
                line = word
        out.append(line)
    return out


def draw_wrapped(draw, xy, text, fnt, fill, max_width, line_gap=9, max_lines=None):
    x, y = xy
    lines = wrapped_lines(draw, text, fnt, max_width)
    if max_lines and len(lines) > max_lines:
        lines = lines[:max_lines]
        lines[-1] = lines[-1].rstrip(' .') + '…'
    line_h = draw.textbbox((0, 0), 'Ag', font=fnt)[3] + line_gap
    for line in lines:
        draw.text((x, y), line, font=fnt, fill=fill)
        y += line_h
    return y


def rounded(draw, box, radius=28, fill=WHITE, outline=None, width=2):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def paste_rounded(canvas, image, box, radius=28):
    x0, y0, x1, y1 = [int(v) for v in box]
    fitted = ImageOps.fit(image, (x1 - x0, y1 - y0), method=Image.Resampling.LANCZOS)
    mask = Image.new('L', fitted.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, fitted.width, fitted.height), radius=radius, fill=255)
    canvas.paste(fitted, (x0, y0), mask)


def panel(canvas, box, heading, body, *, fill=WHITE, accent=GREEN, bullet_items=None):
    draw = ImageDraw.Draw(canvas)
    rounded(draw, box, 26, fill=fill, outline=LINE, width=3)
    x0, y0, x1, y1 = box
    draw.rounded_rectangle((x0, y0, x0 + 18, y1), radius=9, fill=accent)
    x = x0 + 45
    y = y0 + 35
    y = draw_wrapped(draw, (x, y), heading, F_H3, INK, x1 - x - 35, line_gap=4, max_lines=2) + 14
    y = draw_wrapped(draw, (x, y), body, F_BODY, MUTED, x1 - x - 35, line_gap=8, max_lines=7) + 12
    if bullet_items:
        for item in bullet_items:
            draw.ellipse((x, y + 10, x + 11, y + 21), fill=accent)
            y = draw_wrapped(draw, (x + 28, y), item, F_SMALL, INK, x1 - x - 65, line_gap=6, max_lines=2) + 9


def header(canvas, poster):
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 0, W, 520), fill=DEEP)
    draw.rectangle((0, 500, W, 520), fill=GOLD)
    draw.text((150, 72), 'TEACHING HEALTHY CULTIVATION · SCIENTIFIC VISUAL', font=F_KICKER, fill=GOLD)
    title_font = F_TITLE
    title_lines = wrapped_lines(draw, poster['title'], title_font, W - 300)
    while len(title_lines) > 2 and title_font.size > 62:
        title_font = font(title_font.size - 4, True)
        title_lines = wrapped_lines(draw, poster['title'], title_font, W - 300)
    y = 125
    for line in title_lines[:2]:
        draw.text((150, y), line, font=title_font, fill=WHITE)
        y += draw.textbbox((0, 0), line, font=title_font)[3] + 8
    draw_wrapped(draw, (150, y + 8), poster['subtitle'], F_SUB, '#D8E5DC', W - 300, line_gap=7, max_lines=2)


def hero_area(canvas, hero_img, secondary_img, poster):
    draw = ImageDraw.Draw(canvas)
    left = (150, 590, 1260, 1320)
    paste_rounded(canvas, hero_img, left, 32)
    if secondary_img is not None:
        inset = (820, 965, 1220, 1280)
        paste_rounded(canvas, secondary_img, inset, 22)
        draw.rounded_rectangle(inset, radius=22, outline=WHITE, width=8)
    rounded(draw, (1325, 590, 2400, 1320), 30, fill=PALE, outline=LINE, width=3)
    draw.text((1380, 635), poster['fact_heading'], font=F_H2, fill=DEEP)
    y = 710
    for label, value in poster['facts']:
        draw.text((1380, y), label.upper(), font=F_KICKER, fill=GREEN)
        y += 35
        y = draw_wrapped(draw, (1380, y), value, F_BODY, INK, 935, line_gap=7, max_lines=3) + 25
    draw_wrapped(draw, (175, 1340), f"Reviewed source visual used as supporting context: {poster['source_label']}", F_TINY, MUTED, 2200, line_gap=4, max_lines=2)


def arrow(draw, p1, p2, fill=GREEN, width=10, head=22):
    draw.line((p1, p2), fill=fill, width=width)
    angle = math.atan2(p2[1] - p1[1], p2[0] - p1[0])
    a1 = angle + math.pi * 0.82
    a2 = angle - math.pi * 0.82
    draw.polygon([p2, (p2[0] + head * math.cos(a1), p2[1] + head * math.sin(a1)), (p2[0] + head * math.cos(a2), p2[1] + head * math.sin(a2))], fill=fill)


def diagram_frame(canvas, title):
    draw = ImageDraw.Draw(canvas)
    box = (150, 1430, 2400, 2130)
    rounded(draw, box, 30, fill=WHITE, outline=LINE, width=3)
    draw.text((195, 1470), title, font=F_H2, fill=DEEP)
    return draw


def diagram_dli(canvas):
    draw = diagram_frame(canvas, 'Photon delivery: local intensity → daily dose')
    y = 1660
    nodes = [(230, 'FIXTURE', 'source output'), (700, 'CROP PLANE', 'PPFD map'), (1200, 'CANOPY', 'spatial exposure'), (1690, 'TIME', 'photoperiod'), (2120, 'DLI', 'daily integral')]
    for x, label, sub in nodes:
        rounded(draw, (x - 110, y - 80, x + 110, y + 80), 22, fill=SOFT, outline=LINE, width=2)
        tw = draw.textbbox((0, 0), label, font=F_SMALL)[2]
        draw.text((x - tw / 2, y - 42), label, font=F_SMALL, fill=DEEP)
        sw = draw.textbbox((0, 0), sub, font=F_TINY)[2]
        draw.text((x - sw / 2, y + 10), sub, font=F_TINY, fill=MUTED)
    for a, b in zip(nodes, nodes[1:]):
        arrow(draw, (a[0] + 125, y), (b[0] - 125, y), GREEN, 8, 20)
    rounded(draw, (260, 1855, 2290, 2070), 22, fill=DEEP)
    draw.text((360, 1885), 'DLI = PPFD × photoperiod × 0.0036', font=F_FORMULA, fill=WHITE)
    draw.text((360, 1945), 'for constant PPFD; photoperiod in hours', font=F_SMALL, fill='#CFE0D5')
    examples = [('600 × 12 h', '25.92 mol m⁻² d⁻¹'), ('400 × 18 h', '25.92 mol m⁻² d⁻¹'), ('800 × 9 h', '25.92 mol m⁻² d⁻¹')]
    x = 360
    for expr, result in examples:
        draw.text((x, 1998), f'{expr} = {result}', font=F_TINY, fill=GOLD)
        x += 635


def diagram_grid(canvas):
    draw = diagram_frame(canvas, 'Canopy mapping: preserve the spatial pattern')
    gx, gy, cell = 290, 1600, 86
    for r in range(5):
        for c in range(5):
            x0 = gx + c * cell
            y0 = gy + r * cell
            fill = '#DCE9DF' if (r + c) % 2 == 0 else '#EEF4EF'
            draw.rounded_rectangle((x0, y0, x0 + 68, y0 + 68), radius=14, fill=fill, outline=LINE, width=2)
            draw.text((x0 + 17, y0 + 20), f'{chr(65+r)}{c+1}', font=F_TINY, fill=DEEP)
    draw.text((285, 2050), 'Measurement grid — individual readings retained', font=F_SMALL, fill=MUTED)
    facts = [('CENTER', 'Do not let one bright center point stand in for the whole canopy.'), ('EDGE', 'Edge readings expose falloff that an average can hide.'), ('OVERLAP', 'Fixture overlap can create local peaks or valleys.'), ('HEIGHT', 'Re-map when the crop plane or fixture geometry changes.')]
    for i, (h, b) in enumerate(facts):
        yy = 1600 + i * 122
        draw.text((900, yy), h, font=F_H3, fill=GREEN)
        draw_wrapped(draw, (1110, yy), b, F_SMALL, INK, 1160, line_gap=4, max_lines=2)


def diagram_sensors(canvas):
    draw = diagram_frame(canvas, 'Instrument choice follows the question')
    rounded(draw, (250, 1590, 1090, 2025), 24, fill=SOFT, outline=LINE, width=2)
    rounded(draw, (1210, 1590, 2290, 2025), 24, fill='#F8F5EA', outline=LINE, width=2)
    draw.text((310, 1635), 'QUANTUM SENSOR', font=F_H3, fill=DEEP)
    draw.text((1270, 1635), 'SPECTRORADIOMETER', font=F_H3, fill=DEEP)
    draw_wrapped(draw, (310, 1700), 'Useful for photon-flux measurements over the instrument’s defined spectral response. Record model, calibration, orientation and spectral range.', F_BODY, INK, 720, max_lines=6)
    draw_wrapped(draw, (1270, 1700), 'Used when the wavelength distribution itself matters. A spectral measurement answers a different question than one total photon-flux number.', F_BODY, INK, 930, max_lines=6)
    y = 1950
    draw.line((1380, y, 2120, y), fill=DEEP, width=6)
    for x, nm, col in [(1380, 'UV', '#6D55A6'), (1510, '400', '#4558A8'), (1780, '550', '#3D8B52'), (2070, '700', '#B3483E'), (2200, 'FR', '#7D2D2B')]:
        draw.line((x, y - 18, x, y + 18), fill=col, width=5)
        draw.text((x - 20, y + 28), nm, font=F_TINY, fill=INK)
    draw.text((1550, y - 50), 'conventional PAR / PPFD band', font=F_TINY, fill=MUTED)


def diagram_lightcurve(canvas):
    draw = diagram_frame(canvas, 'Conceptual light-response curve — not a universal threshold')
    ox, oy, x_end, y_top = 340, 2010, 2250, 1580
    draw.line((ox, oy, x_end, oy), fill=DEEP, width=6)
    draw.line((ox, oy, ox, y_top), fill=DEEP, width=6)
    pts = []
    for i in range(150):
        t = i / 149
        x = ox + t * (x_end - ox - 80)
        y = oy - 360 * (1 - math.exp(-5 * t)) + 55 * max(0, t - 0.82) ** 2 * 8
        pts.append((x, y))
    draw.line(pts, fill=GREEN, width=12)
    for label, x, y in [('COMPENSATION', 500, 1960), ('RISING RESPONSE', 840, 1760), ('SATURATION REGION', 1420, 1650), ('EXCESS-LIGHT RISK', 1900, 1730)]:
        draw.text((x, y), label, font=F_TINY, fill=DEEP)
    draw.text((930, 2060), 'Increasing PPFD →', font=F_SMALL, fill=MUTED)
    draw.text((180, 1670), 'Net photosynthesis', font=F_SMALL, fill=MUTED)
    draw_wrapped(draw, (430, 2100), 'Curve position shifts with acclimation, leaf age, CO₂, temperature, water status, nutrition, stage and genetics.', F_SMALL, INK, 1650, max_lines=2)


def diagram_evidence(canvas):
    draw = diagram_frame(canvas, 'Keep the evidence layers separate')
    stages = [('OBSERVATION', 'Older leaves are yellowing first.'), ('MEASUREMENT', 'Add location, progression, root-zone EC/pH, irrigation, temperature and pest evidence.'), ('INFERENCE', 'Nutrient stress may be plausible — but the conclusion stays conditional until alternatives are tested.')]
    x = 240
    for i, (h, b) in enumerate(stages):
        rounded(draw, (x, 1600, x + 640, 1970), 24, fill=SOFT if i < 2 else '#F8F5EA', outline=LINE, width=2)
        draw.text((x + 35, 1640), h, font=F_H3, fill=DEEP)
        draw_wrapped(draw, (x + 35, 1705), b, F_BODY, INK, 570, max_lines=6)
        if i < 2:
            arrow(draw, (x + 660, 1785), (x + 745, 1785), GREEN, 8, 20)
        x += 745
    draw_wrapped(draw, (300, 2035), 'Good diagnosis narrows alternatives with measurements and tracked response; it does not rename an observation as a cause.', F_SMALL, MUTED, 1850, max_lines=2)


def diagram_replication(canvas):
    draw = diagram_frame(canvas, 'Experimental unit ≠ number of measurements')
    rounded(draw, (230, 1570, 1120, 2045), 24, fill='#F8F5EA', outline=LINE, width=2)
    rounded(draw, (1230, 1570, 2310, 2045), 24, fill=SOFT, outline=LINE, width=2)
    draw.text((285, 1615), 'SUBSAMPLING', font=F_H3, fill=DEEP)
    draw.text((1285, 1615), 'INDEPENDENT REPLICATION', font=F_H3, fill=DEEP)
    cx, cy = 680, 1810
    draw.ellipse((cx - 70, cy - 95, cx + 70, cy + 95), fill='#6B9B63', outline=DEEP, width=5)
    for a in range(0, 360, 60):
        px = cx + int(120 * math.cos(math.radians(a)))
        py = cy + int(120 * math.sin(math.radians(a)))
        draw.ellipse((px - 18, py - 18, px + 18, py + 18), fill=GOLD, outline=DEEP, width=3)
    draw_wrapped(draw, (325, 1940), 'Six leaf readings on one treated plant improve sampling of that plant; they do not create six independent plants.', F_SMALL, INK, 730, max_lines=3)
    for r in range(2):
        for c in range(3):
            x = 1400 + c * 260
            y = 1780 + r * 150
            draw.ellipse((x - 45, y - 60, x + 45, y + 60), fill='#6B9B63', outline=DEEP, width=4)
            draw.text((x - 22, y + 70), f'P{r*3+c+1}', font=F_TINY, fill=INK)
    draw_wrapped(draw, (1320, 1940), 'Independent experimental units receive treatment independently. Replicate count follows the unit that was assigned the treatment.', F_SMALL, INK, 900, max_lines=3)


def diagram_randomization(canvas):
    draw = diagram_frame(canvas, 'Layout can create a false treatment effect')
    for title, sx in [('CONFOUNDED', 230), ('RANDOMIZED', 915), ('BLOCKED', 1600)]:
        draw.text((sx, 1590), title, font=F_H3, fill=DEEP)
        gx, gy, cell = sx, 1660, 82
        for r in range(4):
            for c in range(6):
                if title == 'CONFOUNDED':
                    val = 'T' if c >= 3 else 'C'
                elif title == 'RANDOMIZED':
                    val = 'T' if (r * 7 + c * 3) % 5 in (0, 2) else 'C'
                else:
                    val = 'T' if (r + c) % 2 else 'C'
                fill = '#D6E8DA' if val == 'T' else '#F3E6BF'
                draw.rounded_rectangle((gx + c*cell, gy + r*cell, gx + c*cell + 62, gy + r*cell + 62), radius=10, fill=fill, outline=LINE, width=2)
                draw.text((gx + c*cell + 20, gy + r*cell + 17), val, font=F_TINY, fill=DEEP)
        note = {'CONFOUNDED': 'Treatment is tied to position.', 'RANDOMIZED': 'Assignment breaks systematic placement bias.', 'BLOCKED': 'Compare within known background gradients.'}[title]
        draw_wrapped(draw, (sx, 2030), note, F_SMALL, INK, 560, max_lines=2)


def diagram_measurement(canvas):
    draw = diagram_frame(canvas, 'Measurement quality is a chain')
    stages = [('TRUE CONDITION', 250), ('SENSOR', 720), ('RECORDED VALUE', 1190), ('INTERPRETATION', 1750)]
    for i, (label, x) in enumerate(stages):
        rounded(draw, (x, 1630, x + 350, 1810), 22, fill=SOFT, outline=LINE, width=2)
        draw.text((x + 25, 1688), label, font=F_SMALL, fill=DEEP)
        if i < len(stages) - 1:
            arrow(draw, (x + 360, 1720), (stages[i+1][1] - 15, 1720), GREEN, 8, 20)
    draw.text((300, 1885), 'CHECK', font=F_H3, fill=GREEN)
    x = 520
    for item in ['Calibration & drift', 'Resolution & repeatability', 'Units & metadata', 'Sampling method', 'Raw-value preservation']:
        rounded(draw, (x, 1855, x + 315, 1985), 18, fill='#F8F5EA', outline=LINE, width=2)
        draw_wrapped(draw, (x + 20, 1890), item, F_TINY, INK, 275, max_lines=2)
        x += 350
    draw_wrapped(draw, (320, 2040), 'Extra decimal places do not create accuracy. Record what the instrument can actually support, and document corrections instead of silently overwriting raw observations.', F_SMALL, MUTED, 1880, max_lines=2)

DIAGRAMS = {'dli': diagram_dli, 'grid': diagram_grid, 'sensors': diagram_sensors, 'lightcurve': diagram_lightcurve, 'evidence': diagram_evidence, 'replication': diagram_replication, 'randomization': diagram_randomization, 'measurement': diagram_measurement}

POSTERS = [
    {
        'id': 'THC-LIGHT-01', 'filename': 'THC-LIGHT-01_PPFD_DLI_Photoperiod_Full_Sheet_Infographic.png',
        'title': 'PPFD, DLI & PHOTOPERIOD', 'subtitle': 'Light quantity is a system, not one number.',
        'media_terms': ['ppfd dli'], 'source_label': 'PPFD vs DLI reviewed support visual',
        'fact_heading': 'Three quantities, three questions',
        'facts': [('PPF', 'Photons emitted by a light source · µmol s⁻¹'), ('PPFD', 'Photons arriving at a crop area each second · µmol m⁻² s⁻¹'), ('DLI', 'Total photosynthetic photons received per square meter per day · mol m⁻² d⁻¹')],
        'diagram': 'dli',
        'panels': [('MEASURE THE CROP PLANE', 'Build a defined grid and preserve individual readings.', ['Record sensor height and orientation.', 'Record the actual photoperiod.', 'Re-map after canopy or fixture geometry changes.']), ('INTERPRET WITH CONTEXT', 'Equal daily photon totals can be delivered through different intensity and time patterns.', ['Spectrum and leaf temperature modify response.', 'Canopy geometry and crop stage matter.', 'CO₂ and the rest of the environment can become limiting.'])],
        'footer': 'Evidence notes: MSU Daily Light Integral Defined · Sustainability 2023, 15, 4645 (doi:10.3390/su15054645). Same DLI does not guarantee identical biology.'
    },
    {
        'id': 'THC-LIGHT-02', 'filename': 'THC-LIGHT-02_Lighting_Canopy_PPFD_Mapping_Full_Sheet_Infographic.png',
        'title': 'HOW TO MAP CANOPY LIGHT', 'subtitle': 'A center reading is not a canopy map.',
        'media_terms': ['light measurement instrumentation'], 'source_label': 'Light measurement instrumentation reviewed support visual',
        'fact_heading': 'The map is the measurement',
        'facts': [('GRID', 'Choose measurement positions before collecting values.'), ('METHOD', 'Keep sensor height, orientation and fixture state consistent.'), ('RECORD', 'Preserve the raw spatial readings, not only the average.')],
        'diagram': 'grid',
        'panels': [('SUMMARIZE WITHOUT ERASING SPACE', 'Mean, minimum, maximum, range and coefficient of variation can describe distribution, but none replaces the individual map.', ['Two canopies can share the same mean and have different edge falloff.', 'Local peaks can raise leaf temperature and water demand.', 'Use the same grid when comparing before vs after.']), ('COMMON MAPPING ERRORS', 'Changing the method between readings makes the comparison weaker.', ['Do not tilt the sensor differently from point to point.', 'Do not change crop-plane height mid-map.', 'Document dimming level, fixture state and reflective changes.'])],
        'footer': 'Teaching Healthy Cultivation · Lighting measurement should be repeatable, spatially explicit and tied to the actual crop plane.'
    },
    {
        'id': 'THC-LIGHT-03', 'filename': 'THC-LIGHT-03_Light_Sensors_Spectrum_Measurement_Full_Sheet_Infographic.png',
        'title': 'LIGHT SENSORS: WHAT ARE YOU ACTUALLY MEASURING?', 'subtitle': 'Instrument choice changes the question you can answer.',
        'media_terms': ['light measurement instrumentation'], 'secondary_terms': ['light spectrum photoreceptors'], 'source_label': 'Instrumentation + spectrum reviewed support visuals',
        'fact_heading': 'Do not treat every light meter as equivalent',
        'facts': [('QUANTUM SENSOR', 'Useful for photon flux over the instrument’s defined spectral response.'), ('SPECTRAL TOOL', 'Needed when wavelength distribution itself is the research question.'), ('METADATA', 'Record model, calibration, spectral range, orientation and measurement geometry.')],
        'diagram': 'sensors',
        'panels': [('MEASUREMENT LIMITS', 'Cosine response, spectral response, calibration, temperature, cleanliness and sensor age can influence readings.', ['Keep the sensing surface unobstructed.', 'Use wavelength-resolved tools for wavelength-specific claims.', 'Check instrument response before comparing meters.']), ('PAR IS NOT EVERY LIGHT QUESTION', 'Conventional PPFD commonly summarizes photons from 400–700 nm. UV and far-red questions can require additional spectral measurement.', ['State the spectral range actually measured.', 'Do not infer spectrum from one PPFD value.', 'Treat emerging extended-PAR conventions as method-specific.'])],
        'footer': 'Evidence context: wavelength-resolved measurements and broadband photon-flux measurements answer related but different questions.'
    },
    {
        'id': 'THC-LIGHT-04', 'filename': 'THC-LIGHT-04_Lighting_Response_Photoinhibition_Full_Sheet_Infographic.png',
        'title': 'LIGHT-RESPONSE CURVES, SATURATION & PHOTOINHIBITION', 'subtitle': 'More photons do not create a simple linear biological response.',
        'media_terms': ['photosynthesis light intensity curve'], 'secondary_terms': ['photoinhibition light stress'], 'source_label': 'Light-response + photoinhibition reviewed support visuals',
        'fact_heading': 'Response depends on the leaf and the environment',
        'facts': [('RISING', 'Net photosynthesis generally rises as photon flux increases from low light.'), ('SATURATION', 'Another process increasingly limits the response; the curve is not a fixed species constant.'), ('EXCESS', 'Protective energy dissipation can increase; persistent excess can contribute to photoinhibition.')],
        'diagram': 'lightcurve',
        'panels': [('WHY CURVES SHIFT', 'Leaf age, prior light environment, CO₂, temperature, water status, nutrition, crop stage and genetics can move the response.', ['Published saturation values are context-specific.', 'Compare leaf temperature and water status with high-light symptoms.', 'Acclimation changes what a leaf can use.']), ('DIAGNOSE WITH RESPONSE', 'A bright-light reading alone does not prove light injury.', ['Map where symptoms occur.', 'Document exposure timing and recent changes.', 'Make one controlled correction and track recovery/new growth.'])],
        'footer': 'Evidence note: conceptual curve only — no universal cannabis saturation threshold is asserted.'
    },
    {
        'id': 'THC-EVID-01', 'filename': 'THC-EVID-01_Observation_Measurement_Inference_Full_Sheet_Infographic.png',
        'title': 'OBSERVATION → MEASUREMENT → INFERENCE', 'subtitle': 'Describe what happened before naming why it happened.',
        'media_terms': ['observation interpretation'], 'source_label': 'Observation vs interpretation reviewed support visual',
        'fact_heading': 'Three layers of a useful diagnosis',
        'facts': [('OBSERVATION', 'What is visible, where it occurs, and how it changes through time.'), ('MEASUREMENT', 'Quantified conditions with units, method, time and location.'), ('INFERENCE', 'A proposed explanation whose certainty must match the evidence.')],
        'diagram': 'evidence',
        'panels': [('START WITH LOCATION & PATTERN', 'Plant-health observations become more useful when they identify old vs new growth, upper vs lower canopy, margins vs interveinal tissue, and rate of progression.', ['Photograph the same reference area over time.', 'Record stage and recent management changes.', 'Separate one plant from room-wide patterns.']), ('TEST ALTERNATIVES', 'Several causes can create similar visible symptoms. Add evidence that can separate the plausible explanations.', ['Root-zone conditions and irrigation history.', 'Environment and leaf temperature.', 'Pest/pathogen evidence and response after correction.'])],
        'footer': 'Teaching Healthy Cultivation · A symptom is an observation, not a diagnosis.'
    },
    {
        'id': 'THC-EVID-02', 'filename': 'THC-EVID-02_Replication_Subsampling_Research_Full_Sheet_Infographic.png',
        'title': 'REPLICATION VS SUBSAMPLING', 'subtitle': 'Repeated readings are not automatically independent replicates.',
        'media_terms': ['replication subsampling'], 'source_label': 'Replication vs subsampling reviewed support visual',
        'fact_heading': 'Identify the experimental unit first',
        'facts': [('UNIT', 'The smallest unit independently assigned to a treatment.'), ('REPLICATE', 'An independent experimental unit under the treatment.'), ('SUBSAMPLE', 'Multiple observations collected within one experimental unit.')],
        'diagram': 'replication',
        'panels': [('WHY PSEUDOREPLICATION MATTERS', 'Treating subsamples as independent units makes the apparent sample size larger than the design really supports.', ['State what received treatment independently.', 'Keep nested samples linked to their parent unit.', 'Match analysis to the design.']), ('PLAN BEFORE MEASURING', 'Replication is a design decision, not a number created after data collection.', ['Define treatment and control conditions.', 'Choose independent units before sampling.', 'Record assignment, locations and repeated-measure structure.'])],
        'footer': 'Evidence note: University of Minnesota Extension on-farm research guidance distinguishes true replicates from pseudoreplicates.'
    },
    {
        'id': 'THC-EVID-03', 'filename': 'THC-EVID-03_Controls_Randomization_Blocking_Evidence_Full_Sheet_Infographic.png',
        'title': 'CONTROLS, RANDOMIZATION & BLOCKING', 'subtitle': 'Good layout prevents position from masquerading as treatment.',
        'media_terms': ['claim evidence audit trail'], 'secondary_terms': ['replication subsampling'], 'source_label': 'Evidence audit + replication reviewed support visuals',
        'fact_heading': 'Design reduces confounding before statistics begin',
        'facts': [('CONTROL', 'Shows what happened without the tested change under the same general period.'), ('RANDOMIZE', 'Breaks systematic assignment of one treatment to the best or worst positions.'), ('BLOCK', 'Compares treatments within known gradients such as light, irrigation, bench position or slope.')],
        'diagram': 'randomization',
        'panels': [('CONFOUNDING', 'A treatment effect is difficult to isolate when treatment identity is tied to another factor that can also change the outcome.', ['Map known gradients before assignment.', 'Do not put every treatment unit on one side.', 'Record the randomization or blocking method.']), ('A CONTROL IS A COMPARISON ANCHOR', 'Before/after observations without a contemporaneous control can be confused with normal development, weather, equipment drift or other changes.', ['Keep control conditions comparable.', 'Timestamp interventions.', 'Interpret differences within the limits of the design.'])],
        'footer': 'Evidence note: University of Minnesota Extension recommends controls, randomization and replication for interpretable on-farm comparisons.'
    },
    {
        'id': 'THC-EVID-04', 'filename': 'THC-EVID-04_Measurement_Quality_Uncertainty_Full_Sheet_Infographic.png',
        'title': 'MEASUREMENT QUALITY & UNCERTAINTY', 'subtitle': 'A number is only as useful as its method, context and limits.',
        'media_terms': ['measurement quality uncertainty'], 'secondary_terms': ['claim evidence audit trail'], 'source_label': 'Measurement quality + evidence audit reviewed support visuals',
        'fact_heading': 'Preserve the measurement chain',
        'facts': [('CALIBRATION', 'Links an instrument reading to a known reference and helps reveal drift.'), ('REPEATABILITY', 'Shows how consistently the method measures the same condition.'), ('METADATA', 'Identifies instrument, units, sample, time, place, calibration and method.')],
        'diagram': 'measurement',
        'panels': [('ACCURACY ≠ EXTRA DECIMALS', 'Display precision should not imply more certainty than the instrument or method can support.', ['Keep units with every value.', 'Record resolution and calibration state.', 'Repeat suspicious values when appropriate.']), ('DATA INTEGRITY', 'Do not silently delete or overwrite a surprising observation because it looks wrong.', ['Preserve the raw value.', 'Document correction/exclusion reasons.', 'Keep transformations reproducible and auditable.'])],
        'footer': 'Teaching Healthy Cultivation · Preserve raw data, method metadata and the uncertainty needed to interpret the result.'
    },
]


def render_poster(poster, catalog, tmpdir):
    canvas = Image.new('RGB', (W, H), CREAM)
    hero_item = resolve_media(catalog, poster['media_terms'])
    hero_img = download_media(hero_item, tmpdir)
    secondary_img = None
    if poster.get('secondary_terms'):
        secondary_img = download_media(resolve_media(catalog, poster['secondary_terms']), tmpdir)
    header(canvas, poster)
    hero_area(canvas, hero_img, secondary_img, poster)
    DIAGRAMS[poster['diagram']](canvas)
    panel(canvas, (150, 2225, 1240, 3050), poster['panels'][0][0], poster['panels'][0][1], bullet_items=poster['panels'][0][2])
    panel(canvas, (1310, 2225, 2400, 3050), poster['panels'][1][0], poster['panels'][1][1], bullet_items=poster['panels'][1][2], accent=GOLD)
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 3130, W, H), fill=DEEP)
    draw.text((150, 3160), f"{poster['id']} · DTF GENETICS · DREAM THE FUTURE", font=F_KICKER, fill=GOLD)
    draw_wrapped(draw, (150, 3205), poster['footer'], F_TINY, '#D4E2D8', W - 300, line_gap=4, max_lines=3)
    path = ROOT / poster['filename']
    canvas.save(path, format='PNG', optimize=True, dpi=(300, 300))
    with Image.open(path) as check:
        if check.size != (W, H) or check.format != 'PNG':
            raise RuntimeError(f'{path} failed format/dimension validation: {check.format} {check.size}')
    if path.stat().st_size < 250_000:
        raise RuntimeError(f'{path} is unexpectedly small ({path.stat().st_size} bytes)')
    return {'id': poster['id'], 'path': str(path), 'bytes': path.stat().st_size, 'width': W, 'height': H, 'dpi': 300, 'sourceMediaId': hero_item.get('id'), 'sourceMediaTitle': html.unescape(hero_item.get('title', {}).get('rendered', ''))}


def main():
    if not USER or not PASSWORD:
        raise RuntimeError('WP_API_USERNAME and WP_API_PASSWORD are required to resolve reviewed source visuals')
    catalog = fetch_media_catalog()
    results = []
    with tempfile.TemporaryDirectory(prefix='thc-poster-render-') as tmpdir:
        for poster in POSTERS:
            print(f"Rendering {poster['id']}: {poster['title']}")
            results.append(render_poster(poster, catalog, tmpdir))
    report = {'schemaVersion': 1, 'renderer': 'deterministic-pillow-v1', 'posterCount': len(results), 'targetSize': [W, H], 'results': results}
    report_path = Path(os.environ.get('POSTER_RENDER_REPORT', '/tmp/thc-lighting-evidence-poster-render.json'))
    report_path.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2))

if __name__ == '__main__':
    main()
