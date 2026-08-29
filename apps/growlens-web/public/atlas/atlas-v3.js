(() => {
  const state = { systems: [], query: '', category: 'All' };
  const grid = document.querySelector('[data-system-grid]');
  const empty = document.querySelector('[data-empty]');
  const search = document.querySelector('[data-atlas-search]');
  const filters = [...document.querySelectorAll('[data-category]')];
  const count = document.querySelector('[data-result-count]');

  const norm = (value) => String(value || '').toLowerCase().trim();
  const searchable = (system) => norm([
    system.title,
    system.category,
    system.summary,
    system.visual,
    ...(system.concepts || []),
    ...(system.functions || []),
    ...(system.observe || []),
    ...(system.searchTerms || [])
  ].join(' '));

  function render() {
    const q = norm(state.query);
    const filtered = state.systems.filter((system) => {
      const categoryOk = state.category === 'All' || system.category === state.category;
      const queryOk = !q || searchable(system).includes(q);
      return categoryOk && queryOk;
    });

    grid.innerHTML = filtered.map((system) => `
      <a class="system-card" href="${system.route}" data-system-id="${system.id}">
        <div class="system-top">
          <span class="system-icon" aria-hidden="true">${system.icon}</span>
          <span class="system-category">${system.category}</span>
        </div>
        <h3>${system.title}</h3>
        <p>${system.summary}</p>
        <div class="system-meta"><span><b>${system.concepts.length}</b> core concepts</span><span>Open module →</span></div>
      </a>
    `).join('');

    empty.style.display = filtered.length ? 'none' : 'block';
    if (count) count.textContent = `${filtered.length} of ${state.systems.length} systems`;
  }

  function applyUrlState() {
    const params = new URLSearchParams(location.search);
    const query = params.get('q');
    const category = params.get('category');
    if (query) {
      state.query = query;
      if (search) search.value = query;
    }
    if (category && filters.some((button) => button.dataset.category === category)) {
      state.category = category;
      filters.forEach((button) => button.classList.toggle('active', button.dataset.category === category));
    }
  }

  function syncUrl() {
    const params = new URLSearchParams();
    if (state.query) params.set('q', state.query);
    if (state.category !== 'All') params.set('category', state.category);
    const next = params.toString() ? `${location.pathname}?${params}` : location.pathname;
    history.replaceState(null, '', next);
  }

  async function boot() {
    try {
      const response = await fetch('/atlas/data/systems.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Atlas data returned HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.systems) || data.systems.length < 16) throw new Error('Atlas system data is incomplete.');
      state.systems = data.systems;
      applyUrlState();
      render();

      if (search) {
        search.addEventListener('input', () => {
          state.query = search.value;
          render();
          syncUrl();
        });
      }

      filters.forEach((button) => button.addEventListener('click', () => {
        state.category = button.dataset.category;
        filters.forEach((item) => item.classList.toggle('active', item === button));
        render();
        syncUrl();
      }));
    } catch (error) {
      console.error(error);
      grid.innerHTML = '<div class="error">The Atlas index could not load its system data. The Leaf Lab and Root Lab remain available from the links above.</div>';
      if (count) count.textContent = 'Atlas data unavailable';
    }
  }

  boot();
})();
