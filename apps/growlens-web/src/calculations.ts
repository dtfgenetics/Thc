export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function saturationVaporPressureKpa(temperatureC: number): number {
  return 0.6108 * Math.exp((17.27 * temperatureC) / (temperatureC + 237.3));
}

export function calculateVpdKpa(
  airTemperatureC: number,
  relativeHumidity: number,
  leafTemperatureOffsetC = -1,
): number {
  const humidity = clamp(relativeHumidity, 0, 100) / 100;
  const leafTemperatureC = airTemperatureC + leafTemperatureOffsetC;
  const leafSvp = saturationVaporPressureKpa(leafTemperatureC);
  const airVaporPressure = saturationVaporPressureKpa(airTemperatureC) * humidity;
  return Math.max(0, leafSvp - airVaporPressure);
}

export function calculateDliMol(ppfd: number, lightHours: number): number {
  return (Math.max(0, ppfd) * Math.max(0, lightHours) * 3600) / 1_000_000;
}

export function luxToPpfd(lux: number, factor = 0.015): number {
  return Math.max(0, lux) * Math.max(0, factor);
}

export function ppfdToLux(ppfd: number, factor = 0.015): number {
  if (factor <= 0) return 0;
  return Math.max(0, ppfd) / factor;
}

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function canopyUniformityPercent(values: number[]): number {
  const valid = values.filter((value) => Number.isFinite(value) && value >= 0);
  if (valid.length === 0) return 0;
  const mean = average(valid);
  if (mean === 0) return 0;
  return (Math.min(...valid) / mean) * 100;
}

export function celsiusToFahrenheit(value: number): number {
  return value * (9 / 5) + 32;
}

export function fahrenheitToCelsius(value: number): number {
  return (value - 32) * (5 / 9);
}

export function round(value: number, precision = 2): number {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
