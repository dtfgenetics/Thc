# Cultivation Math Engine v1 — Reference Fixtures

These fixtures make unit assumptions explicit and prevent accidental formula drift.

| Calculation | Inputs | Expected |
|---|---|---|
| DLI | 700 µmol·m⁻²·s⁻¹, 12 h | 30.24 mol·m⁻²·day⁻¹ |
| Reverse PPFD | 30.24 mol·m⁻²·day⁻¹, 12 h | 700 µmol·m⁻²·s⁻¹ |
| Segmented DLI | 0×1 h + 700×10 h + 350×2 h | 27.72 mol·m⁻²·day⁻¹ |
| Saturation vapor pressure | 25 °C | ≈3.168 kPa |
| Air VPD | 25 °C, 60% RH | ≈1.27 kPa |
| Leaf VPD | 25 °C air, 60% RH, 23 °C leaf | ≈1.00 kPa |
| Dilution | C1=1000, C2=100, V2=10 | V1=1 |
| Dew point | 24 °C, 65% RH | ≈17 °C |
| ACH | 300 CFM, 800 ft³ | 22.5 h⁻¹ |
| Volume | 1 US gal | 3.785411784 L |

VPD outputs are physical vapor-pressure calculations, not cultivar-specific prescriptions. Interpretation belongs in the educational/tool layer.
