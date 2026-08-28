export function renderWeatherPanel({ container, weatherStates, currentWeatherId, onSelect }) {
  if (!container) return;

  const buttons = weatherStates.map((weather) => `
    <button type="button" data-weather-id="${weather.id}" ${weather.id === currentWeatherId ? 'aria-current="true"' : ''}>
      ${weather.displayName}
    </button>
  `).join('');

  const current = weatherStates.find((weather) => weather.id === currentWeatherId);

  container.innerHTML = `
    <div class="result-card">
      <strong>Weather</strong>
      <span>Current: ${current?.displayName ?? currentWeatherId}</span>
      <div class="action-row">${buttons}</div>
    </div>
  `;

  container.querySelectorAll('[data-weather-id]').forEach((button) => {
    button.addEventListener('click', () => onSelect?.(button.dataset.weatherId));
  });
}
