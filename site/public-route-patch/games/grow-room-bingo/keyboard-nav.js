'use strict';

(() => {
  const SIZE = 5;
  const board = document.querySelector('#board');
  if (!board) return;

  function cells() {
    return [...board.querySelectorAll('button.cell')];
  }

  function playableCells() {
    return cells().filter((cell) => !cell.disabled);
  }

  function makeRoving(active = null) {
    const enabled = playableCells();
    if (!enabled.length) return;
    const focusable = active && enabled.includes(active)
      ? active
      : enabled.find((cell) => cell.tabIndex === 0) || enabled[0];
    for (const cell of cells()) cell.tabIndex = cell === focusable ? 0 : -1;
  }

  function indexFor(cell) {
    return cells().indexOf(cell);
  }

  function focusIndex(index) {
    const target = cells()[index];
    if (!target || target.disabled) return false;
    makeRoving(target);
    target.focus({ preventScroll: true });
    target.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    return true;
  }

  function focusInDirection(startIndex, delta) {
    let index = startIndex + delta;
    while (index >= 0 && index < SIZE * SIZE) {
      const previousRow = Math.floor((index - delta) / SIZE);
      const row = Math.floor(index / SIZE);
      if ((delta === 1 || delta === -1) && row !== previousRow) return false;
      if (focusIndex(index)) return true;
      index += delta;
    }
    return false;
  }

  board.addEventListener('focusin', (event) => {
    const cell = event.target.closest?.('button.cell');
    if (cell && !cell.disabled) makeRoving(cell);
  });

  board.addEventListener('keydown', (event) => {
    const cell = event.target.closest?.('button.cell');
    if (!cell || cell.disabled) return;
    const index = indexFor(cell);
    if (index < 0) return;

    const movement = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -SIZE,
      ArrowDown: SIZE
    };
    if (event.key in movement) {
      if (focusInDirection(index, movement[event.key])) event.preventDefault();
      return;
    }

    const rowStart = Math.floor(index / SIZE) * SIZE;
    if (event.key === 'Home') {
      for (let candidate = rowStart; candidate < rowStart + SIZE; candidate += 1) {
        if (focusIndex(candidate)) {
          event.preventDefault();
          break;
        }
      }
    } else if (event.key === 'End') {
      for (let candidate = rowStart + SIZE - 1; candidate >= rowStart; candidate -= 1) {
        if (focusIndex(candidate)) {
          event.preventDefault();
          break;
        }
      }
    }
  });

  const observer = new MutationObserver((records) => {
    if (records.some((record) => record.type === 'childList')) makeRoving();
  });
  observer.observe(board, { childList: true });
  makeRoving();
})();
