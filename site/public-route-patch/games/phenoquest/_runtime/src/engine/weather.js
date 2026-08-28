export function getWeather(weatherStates, weatherId) {
  return weatherStates.find((weather) => weather.id === weatherId) ?? null;
}

export function pickWeightedWeather(weatherStates, random = Math.random) {
  const totalWeight = weatherStates.reduce((sum, weather) => sum + Math.max(0, weather.weight ?? 0), 0);
  if (totalWeight <= 0) return weatherStates[0] ?? null;

  let roll = random() * totalWeight;
  for (const weather of weatherStates) {
    roll -= Math.max(0, weather.weight ?? 0);
    if (roll <= 0) return weather;
  }

  return weatherStates.at(-1) ?? null;
}

export function applyWeatherModifiers(stats, weather) {
  if (!weather?.modifiers) return { ...stats };

  const output = { ...stats };
  for (const [stat, value] of Object.entries(weather.modifiers)) {
    output[stat] = Math.max(1, (output[stat] ?? 1) + value);
  }
  return output;
}

export function getWeatherCueBias(weather) {
  return weather?.cueBias ?? [];
}

export function describeWeather(weather) {
  if (!weather) return 'Unknown weather';
  return `${weather.displayName}: ${weather.description}`;
}
