const PLAYER_NAME_KEY = 'dtf-bud-or-bluff-player-name-v1';

window.addEventListener('DOMContentLoaded', () => {
  const createName = document.querySelector('#createName');
  const joinName = document.querySelector('#joinName');
  const inputs = [createName, joinName].filter(Boolean);
  const savedName = (localStorage.getItem(PLAYER_NAME_KEY) || '').trim().slice(0, 24);

  if (savedName) inputs.forEach((input) => { if (!input.value) input.value = savedName; });

  const remember = (source) => {
    const name = source.value.trim().slice(0, 24);
    if (name) localStorage.setItem(PLAYER_NAME_KEY, name);
    inputs.forEach((input) => {
      if (input !== source && document.activeElement !== input) input.value = source.value.slice(0, 24);
    });
  };

  inputs.forEach((input) => {
    input.addEventListener('change', () => remember(input));
    input.addEventListener('blur', () => remember(input));
  });

  document.querySelector('#createForm')?.addEventListener('submit', () => remember(createName));
  document.querySelector('#joinForm')?.addEventListener('submit', () => remember(joinName));
});
