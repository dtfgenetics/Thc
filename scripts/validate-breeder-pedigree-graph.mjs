import fs from 'node:fs';

const html=fs.readFileSync('site/public-route-patch/breeder-pedigree/index.html','utf8');
const graph=fs.readFileSync('site/public-route-patch/assets/breeder-pedigree-graph-v1.js','utf8');
const vendor=fs.readFileSync('site/public-route-patch/assets/vendor/cytoscape-3.34.3.min.js','utf8');
const license=fs.readFileSync('site/public-route-patch/assets/vendor/cytoscape-3.34.3.LICENSE.txt','utf8');

function ok(value,message){ if(!value) throw new Error(message); }

for(const marker of [
  '/assets/vendor/cytoscape-3.34.3.min.js',
  '/assets/breeder-pedigree-graph-v1.js',
  'id="pedigreeGraph"',
  'Interactive lineage network',
  'Fit graph',
  'dtf:pedigree-focus'
]) ok(html.includes(marker),`breeder page missing ${marker}`);

for(const marker of [
  "version:'dtf-breeder-graph-v1'",
  "layout:{name:'breadthfirst'",
  "predecessors().nodes()",
  "successors().nodes()",
  "cy.on('tap','node'",
  "Interactive pedigree graph unavailable"
]) ok(graph.includes(marker),`graph adapter missing ${marker}`);

ok(vendor.includes('The Cytoscape Consortium'),'vendored Cytoscape copyright marker missing');
ok(license.includes('Cytoscape.js 3.34.3'),'Cytoscape version provenance missing');
ok(license.includes('Permission is hereby granted'),'Cytoscape MIT license text missing');
ok(html.includes('@media(max-width:680px)'), 'pedigree graph mobile sizing missing');

console.log('Breeder pedigree Cytoscape integration contract passed.');
