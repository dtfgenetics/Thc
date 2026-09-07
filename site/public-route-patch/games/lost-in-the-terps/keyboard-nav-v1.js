'use strict';

(() => {
  const VERSION = 'lost-in-the-terps-keyboard-nav-v1';
  const grid = document.querySelector('#grid');
  const complete = document.querySelector('#complete');
  if (!grid) return;

  function letters() {
    return [...grid.querySelectorAll('button.letter[data-r][data-c]')];
  }

  function makeRoving(active = null) {
    const cells = letters();
    if (!cells.length) return;
    const focusable = active && cells.includes(active) ? active : cells.find((cell) => cell.tabIndex === 0) || cells[0];
    for (const cell of cells) cell.tabIndex = cell === focusable ? 0 : -1;
  }

  function focusCell(row, col) {
    const target = grid.querySelector(`button.letter[data-r="${row}"][data-c="${col}"]`);
    if (!target) return false;
    makeRoving(target);
    target.focus({ preventScroll: true });
    target.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    return true;
  }

  grid.addEventListener('focusin', (event) => {
    const cell = event.target.closest?.('button.letter[data-r][data-c]');
    if (cell) makeRoving(cell);
  });

  grid.addEventListener('keydown', (event) => {
    const cell = event.target.closest?.('button.letter[data-r][data-c]');
    if (!cell) return;
    const row = Number(cell.dataset.r);
    const col = Number(cell.dataset.c);
    if (!Number.isInteger(row) || !Number.isInteger(col)) return;

    const moves = {
      ArrowLeft: [row, col - 1],
      ArrowRight: [row, col + 1],
      ArrowUp: [row - 1, col],
      ArrowDown: [row + 1, col]
    };
    if (event.key in moves) {
      const [nextRow, nextCol] = moves[event.key];
      if (focusCell(nextRow, nextCol)) event.preventDefault();
      return;
    }

    if (event.key === 'Home') {
      if (focusCell(row, 0)) event.preventDefault();
    } else if (event.key === 'End') {
      const size = Number.parseInt(getComputedStyle(grid).getPropertyValue('--grid-size'), 10) || 1;
      if (focusCell(row, size - 1)) event.preventDefault();
    }
  });

  const gridObserver = new MutationObserver((records) => {
    if (records.some((record) => record.type === 'childList')) makeRoving();
  });
  gridObserver.observe(grid, { childList: true });

  if (complete) {
    complete.tabIndex = -1;
    const completionObserver = new MutationObserver(() => {
      if (!complete.hidden) complete.focus({ preventScroll: true });
    });
    completionObserver.observe(complete, { attributes: true, attributeFilter: ['hidden'] });
  }

  makeRoving();
  window.__LOST_IN_THE_TERPS_KEYBOARD__ = Object.freeze({
    version: VERSION,
    arrowNavigation: true,
    homeEndNavigation: true,
    completionFocus: Boolean(complete),
    refresh: makeRoving
  });
})();