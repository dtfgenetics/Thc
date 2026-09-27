import fs from 'node:fs';

const html=fs.readFileSync('site/public-route-patch/ipm-scout/index.html','utf8');

function ok(value,message){ if(!value) throw new Error(message); }

for(const marker of [
  '/assets/vendor/uplot-1.6.32.min.js',
  '/assets/vendor/uplot-1.6.32.min.css',
  'id="ipmTrendChart"',
  'Observed count',
  'User threshold',
  'function drawTrendChart(rows)',
  'window.uPlot',
  'fallbackTrendTable',
  "cursor:{drag:{x:true,y:false,setScale:true}}",
  'A rising trend is descriptive evidence, not an organism diagnosis.'
]) ok(html.includes(marker),`IPM Scout trend missing: ${marker}`);

ok(html.includes("rows.length<2"),'IPM chart must require repeated observations before drawing a trend');
ok(html.includes("Date.parse(x.date+'T12:00:00')/1000"),'IPM chart must preserve date-based x-axis values');
ok(html.includes("ipmChart.destroy()"),'IPM chart must destroy prior instances before redraw');
ok(html.includes("window.addEventListener('resize'"),'IPM chart must resize with the viewport');

console.log('IPM Scout trend-chart contract passed.');
