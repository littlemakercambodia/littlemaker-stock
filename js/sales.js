/* ═══════════════════════════════════════════════════════════════
   SALES — with free-text + autocomplete product combobox
   ═══════════════════════════════════════════════════════════════ */

// ── Combobox helper ──────────────────────────────────────────────────────────
function buildProductCombobox({ inputId, listId, hiddenId, priceKey, stockInfoId, onSelect }) {
  const products = DB.getProducts();

  function renderDropdown(filter) {
    const list = document.getElementById(listId);
    if (!list) return;
    const q = (filter || '').toLowerCase();
    const matches = q ? products.filter(p => p.name.toLowerCase().includes(q)) : products;
    if (!matches.length) { list.style.display = 'none'; return; }
    list.innerHTML = matches.map(p => `
      <div class="combo-item"
           data-id="${p.id}"
           data-sell="${p.sellPrice}"
           data-buy="${p.buyPrice}"
           data-stock="${p.stock}"
           data-unit="${p.unit}">
        <span class="combo-name">${p.name}</span>
        <span class="combo-meta">${t('stock')}: ${fmtNum(p.stock)} · ${fmtKHR(p[priceKey] || p.sellPrice)}</span>
      </div>`).join('');
    list.style.display = 'block';

    list.querySelectorAll('.combo-item').forEach(item => {
      item.addEventListener('mousedown', e => {
        e.preventDefault();
        const inp    = document.getElementById(inputId);
        const hidden = document.getElementById(hiddenId);
        if (inp)    inp.value    = item.querySelector('.combo-name').textContent;
        if (hidden) hidden.value = item.dataset.id;
        list.style.display = 'none';
        if (onSelect) onSelect(item.dataset);
      });
    });
  }

  const inp = document.getElementById(inputId);
  if (!inp) return;

  inp.addEventListener('focus', () => renderDropdown(inp.value));
  inp.addEventListener('input', () => {
    const hidden = document.getElementById(hiddenId);
    if (hidden) hidden.value = '';       // user is typing freely → no product ID
    if (stockInfoId) {
      const si = document.getElementById(stockInfoId);
      if (si) si.textContent = '';
    }
    renderDropdown(inp.value);
  });
  inp.addEventListener('blur', () => {
    setTimeout(() => {
      const list = document.getElementById(listId);
      if (list) list.style.display = 'none';
    }, 150);
  });
}

// ── OPEN MODAL ───────────────────────────────────────────────────────────────
function openAddSale() {
  const body = `
    <div class="form-grid">
      <div class="form-group full" style="position:relative;">
        <label>${t('product')} *</label>
        <input type="text" id="f-prod-name" class="form-input"
               placeholder="វាយឈ្មោះ ឬ ជ្រើសរើស..."
               autocomplete="off">
        <input type="hidden" id="f-prod-id">
        <div id="f-prod-list" class="combo-dropdown" style="display:none;"></div>
      </div>
      <div class="form-group">
        <label>${t('unit_price')} (រៀល) *</label>
        <input type="number" id="f-price" class="form-input" min="0" oninput="calcSaleTotal()">
      </div>
      <div class="form-group">
        <label>${t('quantity')} *</label>
        <div style="display:flex;gap:6px;align-items:center;">
          <button type="button" class="stock-adj-btn minus" onclick="adjSaleQty(-1)">−</button>
          <input type="number" id="f-qty" class="form-input" min="1" value="1"
                 oninput="calcSaleTotal()" style="text-align:center;">
          <button type="button" class="stock-adj-btn plus" onclick="adjSaleQty(1)">+</button>
        </div>
        <small id="f-stock-info" class="text-muted text-sm"></small>
      </div>
      <div class="form-group full">
        <label>${t('total')}</label>
        <div class="total-display" id="sale-total">0 ៛</div>
      </div>
      <div class="form-group">
        <label>${t('customer')}</label>
        <input type="text" id="f-cust" class="form-input">
      </div>
      <div class="form-group">
        <label>${t('date')}</label>
        <input type="date" id="f-date" class="form-input" value="${new Date().toISOString().slice(0, 10)}">
      </div>
      <div class="form-group full">
        <label>${t('note')}</label>
        <textarea id="f-note" class="form-input" rows="2"></textarea>
      </div>
    </div>`;

  Modal.open(t('add_sale'), body, saveSale);

  setTimeout(() => {
    buildProductCombobox({
      inputId:     'f-prod-name',
      listId:      'f-prod-list',
      hiddenId:    'f-prod-id',
      priceKey:    'sellPrice',
      stockInfoId: 'f-stock-info',
      onSelect(data) {
        const priceEl = document.getElementById('f-price');
        if (priceEl) { priceEl.value = data.sell; calcSaleTotal(); }
        const si = document.getElementById('f-stock-info');
        if (si) si.textContent = `${t('stock')}: ${fmtNum(data.stock)} ${t('unit_' + (data.unit || 'pcs'))}`;
      }
    });
  }, 80);
}

function adjSaleQty(d) {
  const el = document.getElementById('f-qty');
  if (el) { el.value = Math.max(1, (parseInt(el.value) || 1) + d); calcSaleTotal(); }
}

function calcSaleTotal() {
  const price = parseFloat(document.getElementById('f-price')?.value) || 0;
  const qty   = parseFloat(document.getElementById('f-qty')?.value)   || 0;
  const el    = document.getElementById('sale-total');
  if (el) el.textContent = fmtKHR(price * qty);
}

// ── SAVE ─────────────────────────────────────────────────────────────────────
function saveSale() {
  const prodName = (document.getElementById('f-prod-name')?.value || '').trim();
  const prodId   = (document.getElementById('f-prod-id')?.value   || '').trim();
  const price    = parseFloat(document.getElementById('f-price').value) || 0;
  const qty      = parseInt(document.getElementById('f-qty').value)    || 0;
  const customer = document.getElementById('f-cust').value.trim();
  const date     = document.getElementById('f-date').value;
  const note     = document.getElementById('f-note').value.trim();

  if (!prodName || qty < 1 || price < 1) { showToast(t('fill_required'), 'error'); return; }

  // Stock check only for known products
  if (prodId) {
    const prod = DB.getProduct(prodId);
    if (prod && prod.stock < qty) { showToast(t('insufficient_stock'), 'error'); return; }
  }

  const sale = {
    id:          DB.uid(),
    productId:   prodId   || null,
    productName: prodName,
    quantity:    qty,
    unitPrice:   price,
    total:       price * qty,
    customer, note,
    date: date ? new Date(date).toISOString() : new Date().toISOString()
  };

  DB.saveSale(sale);
  if (prodId) DB.updateStock(prodId, -qty);
  Modal.close();
  showToast(t('saved'));
  renderSales();
  updateNotifBadge();
}

// ── RENDER ───────────────────────────────────────────────────────────────────
function renderSales() {
  const search    = document.getElementById('search-input').value.toLowerCase();
  const dateRange = document.getElementById('date-filter').value;
  let sales = DB.getSales();
  sales = filterByDate(sales, dateRange);
  if (search) sales = sales.filter(s =>
    s.productName.toLowerCase().includes(search) ||
    (s.customer || '').toLowerCase().includes(search));

  const total = sales.reduce((s, x) => s + x.total, 0);
  document.getElementById('sales-total-val').textContent = fmtKHR(total);
  document.getElementById('sales-count-val').textContent = sales.length + ' ' + t('items');

  const tbody = document.getElementById('sales-list');
  if (!sales.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="no-data">${t('no_data')}</td></tr>`;
    return;
  }
  tbody.innerHTML = sales.map((s, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${fmtDate(s.date)}</td>
      <td><strong>${s.productName}</strong>${s.customer ? `<br><span class="text-muted text-sm">👤 ${s.customer}</span>` : ''}</td>
      <td class="text-right">${fmtNum(s.quantity)}</td>
      <td class="text-right">${fmtKHR(s.unitPrice)}</td>
      <td class="text-right text-accent"><strong>${fmtKHR(s.total)}</strong></td>
      <td>
        <div class="action-btns">
          <button class="btn-icon btn-receipt" title="${t('print_receipt')}" onclick="printReceipt('${s.id}')">🧾</button>
          <button class="btn-icon btn-del" onclick="confirmDeleteSale('${s.id}')">✕</button>
        </div>
      </td>
    </tr>`).join('');
}

function confirmDeleteSale(id) {
  showConfirm(t('confirm_delete'), () => {
    DB.deleteSale(id);
    showToast(t('deleted'));
    renderSales();
    updateNotifBadge();
  });
}

function exportSalesPage() {
  const search    = document.getElementById('search-input').value.toLowerCase();
  const dateRange = document.getElementById('date-filter').value;
  let sales = filterByDate(DB.getSales(), dateRange);
  if (search) sales = sales.filter(s => s.productName.toLowerCase().includes(search));
  const rows = [[t('date'), t('product'), t('customer'), t('quantity'), t('unit_price'), t('total'), t('note')]];
  sales.forEach(s => rows.push([fmtDate(s.date), s.productName, s.customer || '', s.quantity, s.unitPrice, s.total, s.note || '']));
  downloadCSV(rows, `sales-${new Date().toISOString().slice(0, 10)}.csv`);
  showToast(t('saved'));
}

document.addEventListener('DOMContentLoaded', async () => {
  await authGuard();
  renderSales();
  document.getElementById('btn-add').addEventListener('click', openAddSale);
  document.getElementById('search-input').addEventListener('input', renderSales);
  document.getElementById('date-filter').addEventListener('change', renderSales);
  const csvBtn = document.getElementById('btn-csv');
  if (csvBtn) csvBtn.addEventListener('click', exportSalesPage);
});
