# Cultivation Math Engine v1 — Reference Fixtures

These fixtures make unit assumptions explicit and prevent accidental formula drift.

| Calculation | Inputs | Expected |
|---|---|---|
| DLI | 700 µmol·m⁻²·s⁻¹, 12 h | 30.24 mol·m⁻²·day⁻¹ |
| Reverse PPFD | 30.24 mol·m⁻²·day⁻¹, 12 h | 700 µmol·m⁻²·s⁻¹ |
| Segmented DLI | 0×1 h + 700×10 h + 350×2 h | 27.72 mol·m⁻²·day⁻¹ |
| Saturation vapor pressure | 25 °C | ≈3.168 kPa |
| Air VPD | 25 °C, 60% RH | ≈1.27 kPa |
| Leaf VPD | 25 °C air, 60% RH, 23 °C leaf | ≈0.91 kPa |
| Dilution | C1=1000, C2=100, V2=10 | V1=1 |
| Dew point | 24 °C, 65% RH | ≈17 °C |
| ACH | 300 CFM, 800 ft³ | 22.5 h⁻¹ |
| Volume | 1 US gal | 3.785411784 L |
| Temperature | 25 °C | 77 °F |
| Length | 2.54 cm | 1 in |
| Area | 1 m² | 10.7639104167 ft² |
| Mass | 28.349523125 g | 1 oz |
| Conductivity | 1.8 mS/cm | 1800 µS/cm |
| Airflow | 100 CFM | 169.901082 m³/h |
| EC→ppm | 1.8 mS/cm, 500 scale | 900 ppm |
| ppm→EC | 900 ppm, 500 scale | 1.8 mS/cm |
| Dryback | high 5, low 2, current 4.1 | 30% of defined span |
| Rate | 30 percentage points over 6 h | 5 pp/h |
| Fertilizer mass | 150 mg/L, 100 L, 10% element | 150 g product |
| P₂O₅→P | 10% P₂O₅ | 4.364% elemental P |
| K₂O→K | 20% K₂O | 16.602% elemental K |

VPD outputs are physical vapor-pressure calculations, not cultivar-specific prescriptions. Interpretation belongs in the educational/tool layer.
