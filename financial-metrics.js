// Financial Metrics Dashboard logic (compact, one-glance charts)
(function(){
  const now = new Date();
  function fmt(num){ return new Intl.NumberFormat('en-SG', {notation:'compact', maximumFractionDigits:1}).format(num); }
  function fmtPct(p){ return (p*100).toFixed(1) + '%'; }
  function daysInMonth(y,m){ return new Date(y, m+1, 0).getDate(); }
  function addMonths(d, n){ const dd = new Date(d); dd.setMonth(dd.getMonth()+n); return dd; }
  function startOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }

  // Seeded RNG for reproducibility
  function mulberry32(a){ return function(){ let t=a += 0x6D2B79F5; t = Math.imul(t ^ t>>>15, t | 1); t ^= t + Math.imul(t ^ t>>>7, t | 61); return ((t ^ t>>>14) >>> 0) / 4294967296; } }
  let rng = mulberry32(123456);
  function rand(a=0,b=1){ return a + (b-a) * rng(); }
  function choice(arr){ return arr[Math.floor(rand(0, arr.length))]; }

  const Countries = ["Indonesia","Malaysia","Phillipine","Thailand","Vietnam"];
  const PartnerCats = ["VC Partner","Refferal Others","AM managed Partners","Alliance Partner","Referral partner","Distribution Partner","TPI Partner","Embedded partner"];
  const Agreements = ["Revenue Sharing","Non Revenue Sharing"];
  const Industries = ["Digital Product","Entertainment","Property","Financial Service","Travel&Hospitality","Non Profit","Retail","Services","Other"];
  const CPMs = ["Charisse","OT","Hanna","Rizki"];
  const Products = ["VA","eWallet","Cards","Direct Debit","QR Code"];
  const LeadFlows = ["Self Serve","Sales","CPM"];
  const MktActs = ["Event campaign","Campaign","Non Marketing"];

  const Partners = Array.from({length: 120}).map((_,i)=>{
    const product = choice(Products);
    const industry = choice(Industries);
    const country = choice(Countries);
    const baseTPV = (
      product === 'Cards' ? rand(400000, 5000000) :
      product === 'eWallet' ? rand(250000, 3000000) :
      product === 'QR Code' ? rand(180000, 1500000) :
      product === 'Direct Debit' ? rand(120000, 900000) :
      rand(150000, 1200000)
    );
    const grossRate = rand(0.006, 0.02);
    const netRate   = Math.max(0.002, grossRate - rand(0.001, 0.006));
    const netNetRate= Math.max(0.001, netRate   - rand(0.0005, 0.004));
    const monthsAgo = Math.floor(rand(0, 16));
    const activation = new Date(now.getFullYear(), now.getMonth()-monthsAgo, 1 + Math.floor(rand(0,25)));
    return {
      id: 'P'+(i+1),
      country, partnerCat: choice(PartnerCats), agreement: choice(Agreements),
      industry, cpm: choice(CPMs), product, lead: choice(LeadFlows), mkt: choice(MktActs),
      activation, baseTPV, grossRate, netRate, netNetRate
    };
  });

  function seasonalFactor(month, industry){
    let f = 1.0;
    if(industry==='Retail'){
      if(month===10 || month===11) f += 0.18;
      if(month===0) f -= 0.05;
    }
    if(industry==='Travel&Hospitality'){
      if(month===5 || month===6) f += 0.15;
      if(month===1) f -= 0.05;
    }
    if(industry==='Entertainment'){
      if(month===11) f += 0.1;
    }
    return f;
  }

  function getFilters(){
    return {
      country: document.getElementById('f_country').value,
      partnerCat: document.getElementById('f_partnerCat').value,
      agreement: document.getElementById('f_agreement').value,
      industry: document.getElementById('f_industry').value,
      cpm: document.getElementById('f_cpm').value,
      product: document.getElementById('f_product').value,
      lead: document.getElementById('f_lead').value,
      mkt: document.getElementById('f_mkt').value,
      age: document.getElementById('f_age').value,
    };
  }

  function partnerMatches(p, f){
    if(f.country!=='All' && p.country!==f.country) return false;
    if(f.partnerCat!=='All' && p.partnerCat!==f.partnerCat) return false;
    if(f.agreement!=='All' && p.agreement!==f.agreement) return false;
    if(f.industry!=='All' && p.industry!==f.industry) return false;
    if(f.cpm!=='All' && p.cpm!==f.cpm) return false;
    if(f.product!=='All' && p.product!==f.product) return false;
    if(f.lead!=='All' && p.lead!==f.lead) return false;
    if(f.mkt!=='All' && p.mkt!==f.mkt) return false;
    const monthsActive = (now.getFullYear()-p.activation.getFullYear())*12 + (now.getMonth()-p.activation.getMonth()) - (now.getDate()<p.activation.getDate()?1:0);
    if(f.age==='Less than 6 months transacting' && monthsActive>=6) return false;
    if(f.age==='More than 6 months transacting' && monthsActive<6) return false;
    return true;
  }

  function aggregateMonthly(N=12, filters=getFilters()){
    const months = [];
    const monthly = Array.from({length:N}, ()=>({ tpv:0, gross:0, net:0, netnet:0, targetNet:0 }));
    for(let k = N-1; k>=0; k--){
      const d = addMonths(startOfMonth(now), -k);
      months.push({ y: d.getFullYear(), m: d.getMonth(), dim: daysInMonth(d.getFullYear(), d.getMonth()) });
    }
    const selected = Partners.filter(p=>partnerMatches(p, filters));
    selected.forEach(p=>{
      months.forEach((mo, idx)=>{
        const monthStart = new Date(mo.y, mo.m, 1);
        if(p.activation > new Date(mo.y, mo.m, daysInMonth(mo.y, mo.m))) return;
        const monthsActive = (monthStart.getFullYear()-p.activation.getFullYear())*12 + (monthStart.getMonth()-p.activation.getMonth());
        const growth = Math.min(1 + 0.015*monthsActive, 2.2);
        const season = seasonalFactor(mo.m, p.industry);
        const noise = 0.9 + 0.2*rand();
        const tpv = p.baseTPV * growth * season * noise;
        const gross = tpv * p.grossRate;
        const net   = tpv * p.netRate;
        const netnet= tpv * p.netNetRate;
        monthly[idx].tpv   += tpv;
        monthly[idx].gross += gross;
        monthly[idx].net   += net;
        monthly[idx].netnet+= netnet;
      });
    });

    for(let i=0;i<monthly.length;i++){
      if(i===monthly.length-1){
        const prev = monthly[i-1]?.net || 0;
        monthly[i].targetNet = prev * 1.05;
      } else {
        monthly[i].targetNet = 0;
      }
    }

    return { months, monthly };
  }

  function buildLabelDaysForMonth(y, m){
    const dim = daysInMonth(y, m);
    return Array.from({length: dim}, (_,i)=> String(i+1));
  }

  const charts = {};

  function lineOptsCurrency(){
    return {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode:'index', intersect:false },
      plugins: {
        legend: { labels: { color: '#c7d2e1' } },
        tooltip: { callbacks: { label: (c)=> `${c.dataset.label}: ${fmt(c.parsed.y)}` } }
      },
      layout: { padding: 0 },
      scales: {
        x: { ticks: { color:'#9fb1cc' }, grid: { color:'rgba(255,255,255,.06)' } },
        y: { ticks: { color:'#9fb1cc', callback:(v)=> fmt(v) }, grid: { color:'rgba(255,255,255,.06)' } }
      }
    };
  }

  function lineOptsPct(){
    const o = lineOptsCurrency();
    o.plugins.tooltip.callbacks.label = (c)=> `${c.dataset.label}: ${fmtPct(c.parsed.y)}`;
    o.scales.y.ticks.callback = (v)=> (v*100)+'%';
    return o;
  }

  function barOptsPct(){
    return {
      responsive: true, maintainAspectRatio:false,
      plugins: { legend: {display:false}, tooltip: { callbacks: { label:(c)=> fmtPct(c.parsed.y) } } },
      scales: {
        x: { ticks: { color:'#9fb1cc' }, grid: { display:false } },
        y: { ticks: { color:'#9fb1cc', callback:(v)=> (v*100)+'%' }, grid: { color:'rgba(255,255,255,.06)' } }
      }
    };
  }

  function buildCharts(){
    const ctx = (id)=> document.getElementById(id).getContext('2d');

    charts.momCumu     = new Chart(ctx('ch_mom_cumu'),     { type:'line', data:{ labels: [], datasets: [] }, options: lineOptsCurrency() });
    charts.netVsTarget = new Chart(ctx('ch_net_vs_target'), { type:'line', data:{ labels: [], datasets: [] }, options: lineOptsCurrency() });
    charts.grossTrend  = new Chart(ctx('ch_gross_trend'),  { type:'line', data:{ labels: [], datasets: [] }, options: lineOptsCurrency() });
    charts.netTrend    = new Chart(ctx('ch_net_trend'),    { type:'line', data:{ labels: [], datasets: [] }, options: lineOptsCurrency() });
    charts.netnetTrend = new Chart(ctx('ch_netnet_trend'), { type:'line', data:{ labels: [], datasets: [] }, options: lineOptsCurrency() });
    charts.tpvTrend    = new Chart(ctx('ch_tpv_trend'),    { type:'line', data:{ labels: [], datasets: [] }, options: lineOptsCurrency() });

    charts.nnmTrend    = new Chart(ctx('ch_nnm_trend'),    { type:'line', data:{ labels: [], datasets: [] }, options: lineOptsPct() });
    charts.nnmBar      = new Chart(ctx('ch_nnm_bar'),      { type:'bar',  data:{ labels: [], datasets: [{ label:'Net Net Margin', data: [] }] }, options: barOptsPct() });

    charts.nmTrend     = new Chart(ctx('ch_nm_trend'),     { type:'line', data:{ labels: [], datasets: [] }, options: lineOptsPct() });
    charts.nmBar       = new Chart(ctx('ch_nm_bar'),       { type:'bar',  data:{ labels: [], datasets: [{ label:'Net Margin', data: [] }] }, options: barOptsPct() });

    charts.gmTrend     = new Chart(ctx('ch_gm_trend'),     { type:'line', data:{ labels: [], datasets: [] }, options: lineOptsPct() });
    charts.gmBar       = new Chart(ctx('ch_gm_bar'),       { type:'bar',  data:{ labels: [], datasets: [{ label:'Gross Margin', data: [] }] }, options: barOptsPct() });
  }

  function updateCharts(){
    const { months, monthly } = aggregateMonthly(12);
    const curIdx = monthly.length-1;
    const curMonth = months[curIdx];

    // 0) MoM Cumulative Revenue (Net) for last 4 months
    {
      const count = Math.min(4, monthly.length);
      const datasets = [];
      let maxDim = 0;
      for(let j=0;j<count;j++){
        const idx = curIdx - (count-1-j);
        if(idx < 0) continue;
        const mo = months[idx];
        const dim = mo.dim;
        if(dim > maxDim) maxDim = dim;
        const perDay = (monthly[idx].net || 0) / dim;
        const arr = Array.from({length: dim}, (_,d)=> perDay*(d+1));
        datasets.push({
          label: `${mo.y}-${String(mo.m+1).padStart(2,'0')}`,
          data: arr,
          tension:.35, pointRadius:0, borderWidth:2
        });
      }
      const labels = Array.from({length: maxDim}, (_,i)=> String(i+1));
      charts.momCumu.data.labels = labels;
      charts.momCumu.data.datasets = datasets;
      charts.momCumu.update();
    }

    // 1) Net vs Target (current month only)
    {
      const idx = curIdx;
      const netMonth = monthly[idx].net;
      const targetMonth = monthly[idx].targetNet;
      const dim = months[idx].dim;
      const dayN = new Date().getDate();
      const perDayActual = netMonth / dim;
      const perDayTarget = targetMonth / dim;
      const labels = buildLabelDaysForMonth(months[idx].y, months[idx].m);
      const actual = []; const target = []; const projection = [];
      for(let d=1; d<=dim; d++){
        actual.push(d <= dayN ? perDayActual * d : null);
        target.push(perDayTarget * d);
        const runRate = perDayActual;
        projection.push(runRate * d);
      }
      charts.netVsTarget.data.labels = labels;
      charts.netVsTarget.data.datasets = [
        { label: 'Actual', data: actual, tension:.35, pointRadius:0, borderWidth:2 },
        { label: 'Target', data: target, borderDash:[6,6], tension:.35, pointRadius:0, borderWidth:2 },
        { label: 'Projection', data: projection, borderDash:[2,4], tension:.35, pointRadius:0, borderWidth:2 }
      ];

      const mtdActual = perDayActual * Math.min(dayN, dim);
      const projMonth = (mtdActual / Math.min(dayN, dim)) * dim;
      document.getElementById('kpi_mtd_net').textContent = 'S$ ' + fmt(mtdActual);
      document.getElementById('kpi_target').textContent = 'S$ ' + fmt(targetMonth);
      document.getElementById('kpi_proj').textContent = 'S$ ' + fmt(projMonth);
      const attain = targetMonth>0 ? (projMonth/targetMonth) : 0;
      document.getElementById('kpi_attain').textContent = fmtPct(attain);
      charts.netVsTarget.update();
    }

    // Helper: series for last K months as MTD lines for a given extractor key
    function buildMTDSeries(key){
      const datasets = [];
      const names = ['This month','-1 month','-2 months','-3 months'];
      const dayN = new Date().getDate();
      for(let j=0;j<4;j++){
        const idx = curIdx - j;
        if(idx < 0) continue;
        const mo = months[idx];
        const monthVal = monthly[idx][key];
        const dim = mo.dim;
        const perDay = monthVal / dim;
        const arr = [];
        const maxD = Math.min(dayN, dim);
        for(let d=1; d<=maxD; d++) arr.push(perDay * d);
        // Pad to current month length with nulls so labels align
        const labelsLen = months[curIdx].dim;
        while(arr.length < labelsLen) arr.push(null);
        datasets.push({ label: names[j], data: arr, tension:.35, pointRadius:0, borderWidth:2 });
      }
      return { datasets, labels: buildLabelDaysForMonth(months[curIdx].y, months[curIdx].m) };
    }

    // 2) Metric trends (MTD vs prior 3 months)
    (function(){
      const L = buildMTDSeries('gross');
      charts.grossTrend.data.labels = L.labels; charts.grossTrend.data.datasets = L.datasets; charts.grossTrend.update();
    })();
    (function(){
      const L = buildMTDSeries('net');
      charts.netTrend.data.labels = L.labels; charts.netTrend.data.datasets = L.datasets; charts.netTrend.update();
    })();
    (function(){
      const L = buildMTDSeries('netnet');
      charts.netnetTrend.data.labels = L.labels; charts.netnetTrend.data.datasets = L.datasets; charts.netnetTrend.update();
    })();
    (function(){
      const L = buildMTDSeries('tpv');
      charts.tpvTrend.data.labels = L.labels; charts.tpvTrend.data.datasets = L.datasets; charts.tpvTrend.update();
    })();

    // 3) Margins – trend + MoM bars (12 months)
    const mm = monthly.map((m)=> ({
      nnm: m.tpv>0 ? m.netnet/m.tpv : 0,
      nm:  m.tpv>0 ? m.net/m.tpv : 0,
      gm:  m.tpv>0 ? m.gross/m.tpv : 0,
    }));
    const monthNames = months.map(m=> new Date(m.y, m.m, 1).toLocaleString('en-US', { month:'short' }));
    function buildMarginMTDSeries(numKey){
      const datasets = [];
      const names = ['This month','-1 month','-2 months','-3 months'];
      const dayN = new Date().getDate();
      for(let j=0;j<4;j++){
        const idx = curIdx - j; if(idx<0) continue;
        const mo = months[idx];
        const dim = mo.dim;
        const maxD = Math.min(dayN, dim);
        const tpvPD = (monthly[idx].tpv || 0) / dim;
        const numPD = (monthly[idx][numKey] || 0) / dim;
        const arr = [];
        for(let d=1; d<=maxD; d++){
          const tpvCum = tpvPD * d;
          const numCum = numPD * d;
          arr.push(tpvCum>0 ? numCum/tpvCum : 0);
        }
        const labelsLen = months[curIdx].dim;
        while(arr.length < labelsLen) arr.push(null);
        datasets.push({ label:names[j], data:arr, tension:.35, pointRadius:0, borderWidth:2 });
      }
      return { datasets, labels: buildLabelDaysForMonth(months[curIdx].y, months[curIdx].m) };
    }

    (function(){
      const L = buildMarginMTDSeries('netnet');
      charts.nnmTrend.data.labels = L.labels; charts.nnmTrend.data.datasets = L.datasets; charts.nnmTrend.update();
    })();
    (function(){
      const L = buildMarginMTDSeries('net');
      charts.nmTrend.data.labels = L.labels; charts.nmTrend.data.datasets = L.datasets; charts.nmTrend.update();
    })();
    (function(){
      const L = buildMarginMTDSeries('gross');
      charts.gmTrend.data.labels = L.labels; charts.gmTrend.data.datasets = L.datasets; charts.gmTrend.update();
    })();

    charts.nnmBar.data.labels = monthNames; charts.nnmBar.data.datasets[0].data = mm.map(x=>x.nnm); charts.nnmBar.update();
    charts.nmBar.data.labels  = monthNames; charts.nmBar.data.datasets[0].data  = mm.map(x=>x.nm);  charts.nmBar.update();
    charts.gmBar.data.labels  = monthNames; charts.gmBar.data.datasets[0].data  = mm.map(x=>x.gm);  charts.gmBar.update();
  }

  function hookFilters(){
    const selIds = ['f_country','f_partnerCat','f_agreement','f_industry','f_cpm','f_product','f_lead','f_mkt','f_age'];
    selIds.forEach(id=> document.getElementById(id).addEventListener('change', updateCharts));
    document.getElementById('resetBtn').addEventListener('click', ()=>{
      selIds.forEach(id=> document.getElementById(id).value = 'All');
      updateCharts();
    });

    // Header toggles to keep the viewport clean
    const fb = document.getElementById('filtersBlock');
    fb.open = false; // collapsed by default
    document.getElementById('toggleFilters').addEventListener('click', ()=>{
      fb.open = !fb.open;
      document.getElementById('toggleFilters').textContent = fb.open ? 'Hide filters' : 'Show filters';
    });

    const compactBtn = document.getElementById('compactBtn');
    document.body.classList.add('compact');
    compactBtn.addEventListener('click', ()=>{
      if(document.body.classList.contains('compact')){
        document.body.classList.remove('compact');
        compactBtn.textContent = 'Compact off';
      } else {
        document.body.classList.add('compact');
        compactBtn.textContent = 'Compact on';
      }
    });
  }

  function init(){
    const tzDate = new Date();
    document.getElementById('asOf').textContent = `As of ${tzDate.toLocaleDateString('en-SG', { year:'numeric', month:'long', day:'numeric' })}`;
    hookFilters();
    buildCharts();
    updateCharts();
  }

  window.addEventListener('DOMContentLoaded', init);
})();