document.addEventListener('DOMContentLoaded', async () => {
  await authGuard();
  const stats = DB.getStats();
  const sales = DB.getSales();
  const purchases = DB.getPurchases();
  const products = DB.getProducts();

  // Stat cards
  document.getElementById('stat-products').textContent = fmtNum(stats.productCount);
  document.getElementById('stat-sales').textContent = fmtKHR(stats.totalSales);
  document.getElementById('stat-purchases').textContent = fmtKHR(stats.totalPurchases);
  document.getElementById('stat-profit').textContent = fmtKHR(stats.profit);
  document.getElementById('stat-profit').className = stats.profit >= 0 ? 'stat-val text-success' : 'stat-val text-danger';

  // Trend indicators
  const todaySales = sales.filter(s => new Date(s.date).toDateString() === new Date().toDateString());
  const todayTotal = todaySales.reduce((a,s) => a+s.total, 0);
  const todayEl = document.getElementById('stat-today');
  if (todayEl) todayEl.textContent = fmtKHR(todayTotal);

  // Low stock alerts
  const lowProds = products.filter(p => p.stock <= 5);
  const alertEl = document.getElementById('stock-alerts');
  if (lowProds.length) {
    alertEl.innerHTML = lowProds.map(p => `
      <div class="alert-item">
        <span>${p.name}</span>
        ${stockBadge(p.stock)}
        <span class="text-muted text-sm">${fmtNum(p.stock)} ${t('unit_' + p.unit)}</span>
      </div>`).join('');
  } else {
    alertEl.innerHTML = `<div class="no-data" style="padding:20px;"><span style="font-size:24px;">✅</span><br>${t('no_data')}</div>`;
  }

  // Recent sales
  const recentSales = sales.slice(0, 5);
  document.getElementById('recent-sales-list').innerHTML = recentSales.length
    ? recentSales.map(s => `
        <tr>
          <td>${fmtDate(s.date)}</td>
          <td><strong>${s.productName}</strong></td>
          <td class="text-right">${fmtNum(s.quantity)}</td>
          <td class="text-right text-accent"><strong>${fmtKHR(s.total)}</strong></td>
        </tr>`).join('')
    : `<tr><td colspan="4" class="no-data">${t('no_data')}</td></tr>`;

  // Recent purchases
  const recentPurchases = purchases.slice(0, 5);
  document.getElementById('recent-purchases-list').innerHTML = recentPurchases.length
    ? recentPurchases.map(p => `
        <tr>
          <td>${fmtDate(p.date)}</td>
          <td><strong>${p.productName}</strong></td>
          <td class="text-right">${fmtNum(p.quantity)}</td>
          <td class="text-right text-primary"><strong>${fmtKHR(p.total)}</strong></td>
        </tr>`).join('')
    : `<tr><td colspan="4" class="no-data">${t('no_data')}</td></tr>`;

  // Chart
  const ctx = document.getElementById('chart-main');
  if (ctx && typeof Chart !== 'undefined') {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    const textColor = isDark ? '#888' : '#666';

    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d;
    });
    const dayLabels = days.map(d => d.toLocaleDateString(currentLang === 'km' ? 'km-KH' : 'en-GB', { month: 'short', day: 'numeric' }));
    const salesData = days.map(d => sales.filter(s => new Date(s.date).toDateString() === d.toDateString()).reduce((a, s) => a + s.total, 0));
    const purchasesData = days.map(d => purchases.filter(p => new Date(p.date).toDateString() === d.toDateString()).reduce((a, p) => a + p.total, 0));

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: dayLabels,
        datasets: [
          { label: t('nav_sales'), data: salesData, backgroundColor: '#d4a843cc', borderRadius: 6, borderSkipped: false },
          { label: t('nav_purchases'), data: purchasesData, backgroundColor: isDark ? '#25a06ecc' : '#1a3d2bcc', borderRadius: 6, borderSkipped: false }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { color: textColor, font: { size: 12 } } },
          tooltip: { callbacks: { label: ctx => ` ${fmtKHR(ctx.raw)}` } }
        },
        scales: {
          y: { ticks: { callback: v => fmtNum(v) + '៛', font: { size: 10 }, color: textColor }, grid: { color: gridColor } },
          x: { ticks: { font: { size: 10 }, color: textColor }, grid: { color: 'transparent' } }
        }
      }
    });
  }

  // Top products by revenue
  const prodSales = {};
  sales.forEach(s => {
    if (!prodSales[s.productId]) prodSales[s.productId] = { name: s.productName, qty: 0, total: 0 };
    prodSales[s.productId].qty += s.quantity;
    prodSales[s.productId].total += s.total;
  });
  const topProds = Object.values(prodSales).sort((a, b) => b.total - a.total).slice(0, 5);
  const topEl = document.getElementById('top-products');
  const maxVal = topProds[0]?.total || 1;
  topEl.innerHTML = topProds.length
    ? topProds.map((p, i) => `
        <div class="top-prod-row">
          <span class="rank">${i + 1}</span>
          <div class="prod-info">
            <span class="prod-name">${p.name}</span>
            <div class="prod-bar-wrap"><div class="prod-bar" style="width:${Math.round(p.total/maxVal*100)}%"></div></div>
          </div>
          <span class="prod-stat">${fmtKHR(p.total)}</span>
        </div>`).join('')
    : `<div class="no-data">${t('no_data')}</div>`;
});
