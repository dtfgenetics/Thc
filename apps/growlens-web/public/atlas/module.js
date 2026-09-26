(() => {
  const slug = location.pathname.split('/').filter(Boolean).pop() || '';
  const $ = (selector) => document.querySelector(selector);
  const list = (items = []) => items.map((item) => `<div class="bullet">${item}</div>`).join('');
  const pills = (items = []) => items.map((item) => `<span class="concept">${item}</span>`).join('');

  function setMeta(system) {
    document.title = `${system.title} | THC Living Plant Atlas | DTF Genetics`;
    const description = system.summary.slice(0, 155);
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
    }
    meta.content = description;
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = `https://dtfseeds.com${system.route}`;

    const ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'LearningResource',
      name: system.title,
      description: system.summary,
      educationalLevel: 'Intermediate',
      learningResourceType: 'Plant science atlas module',
      url: `https://dtfseeds.com${system.route}`,
      isPartOf: { '@type': 'CreativeWork', name: 'THC Living Plant Atlas', url: 'https://dtfseeds.com/atlas/' }
    });
    document.head.appendChild(ld);
  }

  function renderRelated(system, byId) {
    return (system.related || []).map((id) => {
      const related = byId.get(id);
      if (!related) return '';
      return `<a class="related-link" href="${related.route}"><strong>${related.title}</strong><br><span>${related.category} · ${related.concepts.length} concepts</span></a>`;
    }).join('');
  }

  async function boot() {
    try {
      const response = await fetch('/atlas/data/systems.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Atlas data returned HTTP ${response.status}`);
      const data = await response.json();
      const systems = Array.isArray(data.systems) ? data.systems : [];
      const byId = new Map(systems.map((system) => [system.id, system]));
      const system = byId.get(slug);
      if (!system) throw new Error(`Unknown Atlas module: ${slug}`);

      setMeta(system);
      $('[data-category]').textContent = system.category;
      $('[data-title]').textContent = system.title;
      $('[data-summary]').textContent = system.summary;
      $('[data-visual]').textContent = system.visual;
      $('[data-concepts]').innerHTML = pills(system.concepts);
      $('[data-functions]').innerHTML = list(system.functions);
      $('[data-observe]').innerHTML = list(system.observe);
      $('[data-interactions]').innerHTML = list(system.interactions);
      $('[data-cautions]').innerHTML = (system.cautions || []).map((item) => `<div class="warning">${item}</div>`).join('');
      $('[data-related]').innerHTML = renderRelated(system, byId);
      $('[data-module-count]').textContent = `${system.concepts.length} core concepts`;
      $('[data-module-id]').textContent = `Atlas system · ${system.id}`;

      const stack = document.querySelector('.content-stack');
      if (stack) {
        const context = document.createElement('section');
        context.className = 'content-card';
        context.dataset.measurementsRuntime = '';
        context.innerHTML = `<h2>Measurements & context</h2><p>Pair structure and symptoms with measurements that describe the plant's actual environment and developmental state.</p><div class="concepts">${pills(system.measurements || [])}</div>`;
        stack.appendChild(context);

        const questions = document.createElement('section');
        questions.className = 'content-card';
        questions.innerHTML = `<h2>Evidence questions</h2><div class="content-stack">${(system.evidenceQuestions || []).map(item => `<div class="warning">${item}</div>`).join('')}</div>`;
        stack.appendChild(questions);

        const depth = document.createElement('section');
        depth.className = 'content-card';
        depth.innerHTML = `<h2>Deep-dive map</h2><p><strong>Scale:</strong> ${(system.scales || []).join(' · ')}</p><div class="concepts">${pills(system.deepDiveTopics || [])}</div>`;
        stack.appendChild(depth);
      }

      const visuals = system.referenceVisuals || [];
      if (visuals.length) {
        const stack = document.querySelector('.content-stack');
        const card = document.createElement('section');
        card.className = 'content-card';
        card.dataset.referenceVisuals = '';
        card.innerHTML = `<h2>Reference visuals</h2><p>Approved educational references complement the interactive specimen and clarify structures that are difficult to resolve at whole-plant scale.</p><div class="module-visual-grid">${visuals.map(visual => `<figure class="module-visual"><a href="${visual.src}" target="_blank" rel="noopener"><img src="${visual.src}" alt="${visual.alt || ''}" loading="lazy" decoding="async"></a><figcaption>${visual.caption || ''}</figcaption></figure>`).join('')}</div>`;
        stack?.appendChild(card);
      }

      const connected = system.connectedTools || [];
      if (connected.length) {
        const asideStack = document.querySelector('aside.content-stack');
        const card = document.createElement('section');
        card.className = 'content-card';
        card.innerHTML = `<h2>Connected tools</h2><div class="related-list">${connected.map(tool => `<a class="related-link" href="${tool.route}"><strong>${tool.label}</strong><br><span>${tool.note || ''}</span></a>`).join('')}</div>`;
        asideStack?.prepend(card);
      }

      const deep = $('[data-deep-links]');
      const deepLinks = [];
      if (system.id === 'leaf-module') {
        deepLinks.push(['/atlas/leaf-module/leaf-anatomy/', 'Leaf anatomy'], ['/atlas/leaf-module/stomata/', 'Stomata'], ['/atlas/leaf-module/photosynthesis/', 'Photosynthesis'], ['/atlas/leaf-module/transpiration/', 'Transpiration'], ['/atlas/leaf-module/chlorosis/', 'Chlorosis'], ['/atlas/leaf-module/necrosis/', 'Necrosis']);
      }
      if (system.id === 'root-system') {
        deepLinks.push(['/atlas/root-system/root-anatomy/', 'Root anatomy'], ['/atlas/root-system/rhizosphere/', 'Rhizosphere'], ['/atlas/root-system/water-uptake/', 'Water uptake'], ['/atlas/root-system/nutrient-uptake/', 'Nutrient uptake'], ['/atlas/root-system/root-oxygen/', 'Root oxygen'], ['/atlas/root-system/root-zone-diagnostics/', 'Root-zone diagnostics']);
      }
      if (deep && deepLinks.length) {
        deep.innerHTML = deepLinks.map(([href, label]) => `<a class="related-link" href="${href}">${label} →</a>`).join('');
        deep.closest('[data-deep-panel]').hidden = false;
      }
    } catch (error) {
      console.error(error);
      const main = $('main');
      if (main) main.innerHTML = `<div class="error"><strong>Atlas module unavailable.</strong><br>${String(error.message || error)}<br><br><a href="/atlas/">Return to the Living Plant Atlas</a></div>`;
    }
  }

  boot();
})();
