(() => {
  const state = { systems: [], query: '', category: 'All' };
  const grid = document.querySelector('[data-system-grid]');
  const empty = document.querySelector('[data-empty]');
  const search = document.querySelector('[data-atlas-search]');
  const filters = [...document.querySelectorAll('[data-category]')];
  const count = document.querySelector('[data-result-count]');
  const featuredSystems = new Set(['root-system', 'leaf-module', 'flower-anatomy']);
  const compareA = document.querySelector('[data-compare-system-a]');
  const compareB = document.querySelector('[data-compare-system-b]');
  const compareGrid = document.querySelector('[data-system-compare]');
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

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
      <a class="system-card${featuredSystems.has(system.id) ? ' system-card--featured' : ''}" href="${system.route}" data-system-id="${system.id}"${featuredSystems.has(system.id) ? ' data-featured="true"' : ''}>
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

  function renderSystemTree() {
    const root = document.querySelector('[data-system-tree]');
    if (!root || !state.systems.length) return;
    const categoryOrder=['Development','Anatomy','Physiology','Reproduction','Genetics','Environment','Diagnostics'];
    const byId=new Map(state.systems.map(system=>[system.id,system]));
    root.innerHTML=categoryOrder.map(category=>{
      const systems=state.systems.filter(system=>system.category===category);
      if(!systems.length)return '';
      return '<section class="atlas-tree-category"><h3>'+esc(category)+'</h3>'+systems.map(system=>{
        const related=(system.related||[]).map(id=>byId.get(id)).filter(Boolean);
        return '<details class="atlas-tree-item"><summary><span>'+esc(system.title)+'</span><small>'+esc(system.category)+'</small></summary><div class="atlas-tree-body"><p>'+esc(system.summary)+'</p><div class="atlas-tree-links"><a href="'+esc(system.route)+'">Open '+esc(system.title)+' →</a>'+(related.length?'<span>Related: '+related.map(item=>'<a href="'+esc(item.route)+'">'+esc(item.title)+'</a>').join(' · ')+'</span>':'<span>No related-system links recorded.</span>')+'</div><details class="atlas-tree-evidence"><summary>Measurements & evidence questions</summary><div class="atlas-tree-columns"><div><strong>Measure</strong>'+list(system.measurements)+'</div><div><strong>Ask</strong>'+list(system.evidenceQuestions)+'</div></div></details></div></details>';
      }).join('')+'</section>';
    }).join('');
    const items=[...root.querySelectorAll('.atlas-tree-item')];
    document.querySelector('[data-tree-expand]')?.addEventListener('click',()=>items.forEach(item=>item.open=true));
    document.querySelector('[data-tree-collapse]')?.addEventListener('click',()=>items.forEach(item=>item.open=false));
  }

  function systemLabel(id) {
    return state.systems.find((item) => item.id === id)?.title || id;
  }

  function list(items = []) {
    return items.length ? '<ul>'+items.map((item) => '<li>'+esc(item)+'</li>').join('')+'</ul>' : '<p class="atlas-compare-empty">No entries recorded.</p>';
  }

  function connectedTools(system) {
    const tools = Array.isArray(system?.connectedTools) ? system.connectedTools : [];
    return tools.length ? '<ul>'+tools.map((tool) => '<li><a href="'+esc(tool.route)+'">'+esc(tool.label)+'</a><span>'+esc(tool.note || '')+'</span></li>').join('')+'</ul>' : '<p class="atlas-compare-empty">No dedicated tool links recorded.</p>';
  }

  function compareCard(system) {
    if (!system) return '<article class="atlas-compare-card"><p class="atlas-compare-empty">Choose a system.</p></article>';
    return '<article class="atlas-compare-card">'+
      '<div class="atlas-compare-card-head"><span>'+esc(system.category)+'</span><h3>'+esc(system.title)+'</h3><p>'+esc(system.summary)+'</p><a href="'+esc(system.route)+'">Open full system →</a></div>'+
      '<section><h4>Core concepts</h4>'+list(system.concepts)+'</section>'+
      '<section><h4>What to measure</h4>'+list(system.measurements)+'</section>'+
      '<section><h4>Evidence questions</h4>'+list(system.evidenceQuestions)+'</section>'+
      '<section><h4>Cautions</h4>'+list(system.cautions)+'</section>'+
      '<section><h4>Related systems</h4>'+list((system.related || []).map(systemLabel))+'</section>'+
      '<section><h4>Connected tools</h4>'+connectedTools(system)+'</section>'+
    '</article>';
  }

  function renderCompare() {
    if (!compareA || !compareB || !compareGrid || !state.systems.length) return;
    const a = state.systems.find((system) => system.id === compareA.value) || state.systems[0];
    const b = state.systems.find((system) => system.id === compareB.value) || state.systems[1] || state.systems[0];
    compareGrid.innerHTML = compareCard(a) + compareCard(b);
  }

  function populateCompare() {
    if (!compareA || !compareB) return;
    const options = state.systems.map((system) => '<option value="'+esc(system.id)+'">'+esc(system.title)+'</option>').join('');
    compareA.innerHTML = options;
    compareB.innerHTML = options;
    const params = new URLSearchParams(location.search);
    const requestedA = params.get('compareA');
    const requestedB = params.get('compareB');
    compareA.value = state.systems.some((system) => system.id === requestedA) ? requestedA : 'root-system';
    compareB.value = state.systems.some((system) => system.id === requestedB) ? requestedB : 'leaf-module';
    if (compareA.value === compareB.value && state.systems.length > 1) compareB.value = state.systems.find((system) => system.id !== compareA.value)?.id || compareB.value;
    for (const select of [compareA, compareB]) select.addEventListener('change', () => {
      renderCompare();
      syncUrl();
    });
    renderCompare();
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
    if (compareA?.value) params.set('compareA', compareA.value);
    if (compareB?.value) params.set('compareB', compareB.value);
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
      populateCompare();
      renderSystemTree();

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