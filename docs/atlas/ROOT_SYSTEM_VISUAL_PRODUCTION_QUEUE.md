# THC Living Plant Atlas — Root System Visual Production Queue

Updated: 2026-08-25

This queue tracks the first high-quality visuals needed to make the Root System module feel finished, useful, and visually consistent with the Leaf Module.

## Visual quality standard

Every Root System visual must meet this bar:

- Academic studio quality
- Clean cream / soil brown / green palette
- No yellow tint
- No clip-art look
- Readable labels on mobile and print
- Accurate root-zone terminology
- One clear teaching purpose per visual
- Easy to place inside field-card pages and lesson pages

## First production order

### 1. Root Anatomy Reference Plate

Target route: `/atlas/root-system/root-anatomy/`

Asset path:

```txt
/assets/images/atlas/root-system/root-anatomy-reference-plate.png
```

Purpose: teach the parts of a healthy root system.

Must show:

- primary root
- lateral roots
- root hairs
- root tips
- healthy white root color
- clean label hierarchy

### 2. Dryback Timeline Field Card

Target routes:

```txt
/atlas/root-system/dryback/
/atlas/downloads/watering-dryback-field-card/
```

Asset path:

```txt
/assets/images/atlas/root-system/dryback-timeline-field-card.png
```

Purpose: teach wet-to-dry cycling, container weight, oxygen, EC concentration, and leaf posture response.

Must show:

- freshly watered / heavy
- active uptake range
- approaching dryback
- too dry / stress risk
- container weight and leaf posture cues

### 3. pH & EC Troubleshooting Decision Card

Target routes:

```txt
/atlas/downloads/ph-ec-troubleshooting-card/
/atlas/root-system/nutrient-uptake/
/atlas/root-system/root-zone-diagnostics/
```

Asset path:

```txt
/assets/images/atlas/root-system/ph-ec-troubleshooting-decision-card.png
```

Purpose: help separate feed strength, pH drift, salt buildup, and uptake restriction.

Must show:

- input/feed reading
- root-zone reading
- runoff/slurry trend
- pH drift
- EC buildup
- uptake issue clues

### 4. Deficiency vs Lockout Decision Chart

Target routes:

```txt
/atlas/downloads/deficiency-vs-lockout-comparison-card/
/atlas/root-system/nutrient-uptake/
/atlas/leaf-module/nutrient-symptoms/
```

Asset path:

```txt
/assets/images/atlas/root-system/deficiency-vs-lockout-decision-chart.png
```

Purpose: prevent growers from feeding more when the plant cannot access what is already present.

Must compare:

- true deficiency
- pH lockout
- EC buildup
- low oxygen / saturation
- root damage
- environmental limitation

### 5. Root-Zone Diagnostic Flowchart

Target routes:

```txt
/atlas/root-system/root-zone-diagnostics/
/atlas/downloads/root-zone-problem-card/
```

Asset path:

```txt
/assets/images/atlas/root-system/root-zone-diagnostic-flowchart.png
```

Purpose: provide the main field workflow connecting leaf symptoms to root-zone checks.

Must include:

- leaf symptom pattern
- container weight / moisture
- pH
- EC
- oxygen/aeration risk
- media behavior
- root appearance
- recent changes

## QA checklist

Before approval, each visual must pass:

- [ ] Labels are botanically accurate.
- [ ] Text is readable at normal website size.
- [ ] Text is readable when printed.
- [ ] The visual teaches one clear concept.
- [ ] The palette matches the THC Atlas.
- [ ] There is no yellow tint or muddy color cast.
- [ ] It does not imply a diagnosis without context.
- [ ] Alt text exists in the asset map.
- [ ] Target page and target card are defined.
- [ ] Placement path is defined.

## Implementation notes

The canonical asset map lives at:

```txt
data/atlas/root-system-visual-assets-v1.json
```

After visuals are created, update each asset from `needed` to `draft`, then `approved`, then `published` once placed on the website.
