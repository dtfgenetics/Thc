(() => {
  const root = document.querySelector('#app');
  if (!root) return;

  const DRAG_THRESHOLD = 7;
  let gesture = null;
  let suppressClickUntil = 0;
  let syntheticPlacement = false;

  function placementActive() {
    return Boolean(
      typeof state !== 'undefined' &&
      state &&
      ['waiting', 'placement'].includes(state.status) &&
      !state.me?.ready &&
      typeof placement !== 'undefined' &&
      Array.isArray(placement.fleet)
    );
  }

  function selectedSpec() {
    if (typeof FORMATIONS === 'undefined' || typeof placement === 'undefined') return null;
    return FORMATIONS.find((item) => item.id === placement.selected) || null;
  }

  function cellFromPoint(x, y) {
    return document.elementFromPoint?.(x, y)?.closest?.('.cell[data-place]') || null;
  }

  function dispatchPreview(cell) {
    if (!cell) return;
    cell.dispatchEvent(new PointerEvent('pointerover', {
      bubbles: true,
      pointerType: gesture?.pointerType || 'mouse',
      clientX: gesture?.lastX || 0,
      clientY: gesture?.lastY || 0,
    }));
    cell.focus?.({ preventScroll: true });
  }

  function markDragging(active) {
    document.body.classList.toggle('burn-placement-dragging', active);
    root.querySelectorAll('.plant-pick[data-dragging="true"]').forEach((button) => {
      if (!active) button.removeAttribute('data-dragging');
    });
  }

  function beginGesture(event, source) {
    if (!placementActive() || event.button > 0) return;
    const spec = selectedSpec();
    if (!spec) return;

    gesture = {
      pointerId: event.pointerId,
      pointerType: event.pointerType || 'mouse',
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      source,
      moved: false,
      target: source.matches?.('.cell[data-place]') ? source : null,
    };

    source.setPointerCapture?.(event.pointerId);
  }

  function moveGesture(event) {
    if (!gesture || event.pointerId !== gesture.pointerId || !placementActive()) return;
    gesture.lastX = event.clientX;
    gesture.lastY = event.clientY;

    const distance = Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY);
    if (!gesture.moved && distance >= DRAG_THRESHOLD) {
      gesture.moved = true;
      markDragging(true);
      gesture.source.dataset.dragging = 'true';
    }
    if (!gesture.moved) return;

    event.preventDefault();
    const cell = cellFromPoint(event.clientX, event.clientY);
    if (cell) {
      gesture.target = cell;
      dispatchPreview(cell);
    }
  }

  function finishGesture(event) {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const current = gesture;
    gesture = null;
    current.source.releasePointerCapture?.(event.pointerId);

    if (!current.moved) return;

    event.preventDefault();
    markDragging(false);
    const target = cellFromPoint(event.clientX, event.clientY) || current.target;
    if (!target?.dataset.place) return;

    suppressClickUntil = performance.now() + 450;
    syntheticPlacement = true;
    try {
      target.click();
    } finally {
      syntheticPlacement = false;
    }
  }

  root.addEventListener('pointerdown', (event) => {
    const picker = event.target.closest?.('.plant-pick[data-plant]');
    if (picker && placementActive()) {
      placement.selected = picker.dataset.plant;
      beginGesture(event, picker);
      return;
    }

    const cell = event.target.closest?.('.cell[data-place]');
    if (cell) beginGesture(event, cell);
  });

  root.addEventListener('pointermove', moveGesture, { passive: false });
  root.addEventListener('pointerup', finishGesture);
  root.addEventListener('pointercancel', (event) => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    gesture = null;
    markDragging(false);
  });

  root.addEventListener('click', (event) => {
    if (syntheticPlacement || performance.now() > suppressClickUntil) return;
    if (event.target.closest?.('.cell[data-place]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      suppressClickUntil = 0;
    }
  }, true);

  root.addEventListener('keydown', (event) => {
    const picker = event.target.closest?.('.plant-pick[data-plant]');
    if (!picker || !placementActive()) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    placement.selected = picker.dataset.plant;
  });
})();
