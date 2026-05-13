/* ═══════════════════════════════════════════════════════════════
   PURCHASES — with free-text + autocomplete product combobox
   ═══════════════════════════════════════════════════════════════ */

function openAddPurchase() {
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
        <input type="number" id="f-price" class="form-input" min="0" oninput="calcPurchaseTotal()">
      </div>
      <div class="form-group">
        <label>${t('quantity')} *</label>
        <div style="display:flex;gap:6px;align-items:center;">
          <button type="button" class="stock-adj-btn minus" onclick="adjPurchaseQty(-1)">−</button>
          <input type="number" id="f-qty" class="form-input" min="1" value="1"
                 oninput="calcPurchaseTotal()" style="text-align:center;">
          <button type="button" class="stock-adj-btn plus" onclick="adjPurchaseQty(1)">+</button>
        </div>
      </div>
      <div class="form-group full">
        <label>${t('total')}</label>
        <div class="total-display" id="purchase-total">0 ៛</div>
      </div>
      <div class="form-group">
        <label>${t('supplier')}</label>
        <input type="text" id="f-supplier" class="form-input">
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

  Modal.open(t('add_purchase'), body, savePurchase);

  setTimeout(() => {
    // reuse buildProductCombobox defined in sales.js (loaded first via main.js)
    buildProductCombobox({
      inputId:  'f-prod-name',
      listId:   'f-prod-list',
      hiddenId: 'f-prod-id',
      priceKey: 'buyPrice',
      onSelect(data) {
        const priceEl = document.getElementById('f-price');
        if (priceEl) { priceEl.value = data.buy; calcPurchaseTotal(); }
      }
    });
  }, 80);
}

function adjPurchaseQty(d) {
  const el = document.getElementById('f-qty');
  if (el) { el.value = Math.max(1, (parseInt(el.value) || 1) + d); calcPurchaseTotal(); }
}

function calcPurchaseTotal() {
  const price = parseFloat(document.getElementById('f-price')?.value) || 0;
  const qty   = parseFloat(document.getElementById('f-qty')?.value)   || 0;
  const el    = document.getElementById('purchase-total');
  if (el) el.textContent = fmtKHR(price * qty);
}

function savePurchase() {
  const prodName = (document.getElementById('f-prod-name')?.value || '').trim();
  const prodId   = (document.getElementById('f-prod-id')?.value   || '').trim();
  const price    = parseFloat(document.getElementById('f-price').value) || 0;
  const qty      = parseInt(document.getElementById('f-qty').value)    || 0;
  const supplier = document.getElementById('f-supplier').value.trim();
  const date     = document.getElementById('f-date').value;
  const note     = document.getElementById('f-note').value.trim();

  if (!prodName || qty < 1 || price < 1) { showToast(t('fill_required'), 'error'); return; }

  const purchase = {
    id:          DB.uid(),
    productId:   prodId   || null,
    productName: prodName,
    quantity:    qty,
    unitPrice:   price,
    total:       price * qty,
    supplier, note,
    date: date ? new Date(date).toISOString() : new Date().toISOString()
  };

  DB.savePurchase(purchase);
  if (prodId) DB.updateStock(prodId, qty);   // only update stock for known products
  Modal.close();
  showToast(t('saved'));
  renderPurchases();
}

function renderPurchases() {
  const search    = document.getElementById('search-input').value.toLowerCase();
  const dateRange = document.getElementById('date-filter').value;
  let purchases = DB.getPurchases();
  purchases = filterByDate(purchases, dateRange);
  if (search) purchases = purchases.filter(p =>
    p.productName.toLowerCase().includes(search) ||
    (p.supplier || '').toLowerCase().includes(search));

  const total = purchases.reduce((s, x) => s + x.total, 0);
  document.getElementById('purchases-total-val').textContent = fmtKHR(total);
  document.getElementById('purchases-count-val').textContent = purchases.length + ' ' + t('items');

  const tbody = document.getElementById('purchases-list');
  if (!purchases.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="no-data">${t('no_data')}</td></tr>`;
    return;
  }
  tbody.innerHTML = purchases.map((p, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${fmtDate(p.date)}</td>
      <td><strong>${p.productName}</strong>${p.supplier ? `<br><span class="text-muted text-sm">🏭 ${p.supplier}</span>` : ''}</td>
      <td class="text-right">${fmtNum(p.quantity)}</td>
      <td class="text-right">${fmtKHR(p.unitPrice)}</td>
      <td class="text-right text-primary"><strong>${fmtKHR(p.total)}</strong></td>
      <td>
        <div class="action-btns">
          <button class="btn-icon btn-del" onclick="confirmDeletePurchase('${p.id}')">✕</button>
        </div>
      </td>
    </tr>`).join('');
}

function confirmDeletePurchase(id) {
  showConfirm(t('confirm_delete'), () => {
    DB.deletePurchase(id);
    showToast(t('deleted'));
    renderPurchases();
  });
}

function exportPurchasesPage() {
  const search    = document.getElementById('search-input').value.toLowerCase();
  const dateRange = document.getElementById('date-filter').value;
  let purchases = filterByDate(DB.getPurchases(), dateRange);
  if (search) purchases = purchases.filter(p => p.productName.toLowerCase().includes(search));
  const rows = [[t('date'), t('product'), t('supplier'), t('quantity'), t('unit_price'), t('total'), t('note')]];
  purchases.forEach(p => rows.push([fmtDate(p.date), p.productName, p.supplier || '', p.quantity, p.unitPrice, p.total, p.note || '']));
  downloadCSV(rows, `purchases-${new Date().toISOString().slice(0, 10)}.csv`);
  showToast(t('saved'));
}

document.addEventListener('DOMContentLoaded', async () => {
  await authGuard();
  renderPurchases();
  document.getElementById('btn-add').addEventListener('click', openAddPurchase);
  document.getElementById('search-input').addEventListener('input', renderPurchases);
  document.getElementById('date-filter').addEventListener('change', renderPurchases);
  const csvBtn = document.getElementById('btn-csv');
  if (csvBtn) csvBtn.addEventListener('click', exportPurchasesPage);
});
