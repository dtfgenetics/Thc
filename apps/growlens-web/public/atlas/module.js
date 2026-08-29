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
