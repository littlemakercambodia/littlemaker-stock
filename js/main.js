// ─── Theme ────────────────────────────────────────────────────────────────────
function getTheme() { return localStorage.getItem('lm_theme') || 'light'; }
function applyTheme(theme) {
  let resolved = theme;
  if (theme === 'auto') resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', resolved);
  const btn = document.getElementById('btn-theme');
  if (btn) btn.textContent = resolved === 'dark' ? '☀️' : '🌙';
}
function toggleTheme() {
  const cur = getTheme();
  const next = cur === 'light' ? 'dark' : cur === 'dark' ? 'auto' : 'light';
  localStorage.setItem('lm_theme', next);
  applyTheme(next);
  const btn = document.getElementById('btn-theme');
  if (btn) btn.title = next === 'light' ? '☀️ Light' : next === 'dark' ? '🌙 Dark' : '🔄 Auto';
}

// ─── Format helpers ────────────────────────────────────────────────────────────
function fmtNum(n) { return Number(n || 0).toLocaleString(); }
function fmtKHR(n) { return fmtNum(n) + ' ៛'; }
function fmtDate(iso) {
  const d = new Date(iso || Date.now());
  return d.toLocaleDateString(currentLang === 'km' ? 'km-KH' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}
function fmtDateTime(iso) {
  const d = new Date(iso || Date.now());
  return d.toLocaleDateString(currentLang === 'km' ? 'km-KH' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  let toast = document.getElementById('toast');
  if (!toast) { toast = document.createElement('div'); toast.id = 'toast'; document.body.appendChild(toast); }
  toast.className = 'toast ' + type;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ─── Custom Confirm Dialog ─────────────────────────────────────────────────────
function showConfirm(msg, onConfirm, onCancel) {
  let overlay = document.getElementById('confirm-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'confirm-overlay';
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-box">
        <div class="confirm-icon">⚠️</div>
        <div class="confirm-msg" id="confirm-msg"></div>
        <div class="confirm-btns">
          <button class="btn-cancel" id="confirm-no"></button>
          <button class="btn-danger" id="confirm-yes"></button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  }
  document.getElementById('confirm-msg').textContent = msg;
  document.getElementById('confirm-yes').textContent = t('confirm_yes');
  document.getElementById('confirm-no').textContent = t('confirm_no');
  overlay.classList.add('open');
  const yes = document.getElementById('confirm-yes');
  const no = document.getElementById('confirm-no');
  const close = () => overlay.classList.remove('open');
  yes.onclick = () => { close(); if (onConfirm) onConfirm(); };
  no.onclick = () => { close(); if (onCancel) onCancel(); };
}

// ─── Modal ─────────────────────────────────────────────────────────────────────
const Modal = {
  el: null,
  open(title, bodyHTML, onSave) {
    this.el = document.getElementById('modal');
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHTML;
    document.getElementById('modal-save').onclick = onSave;
    document.getElementById('modal-cancel').textContent = t('cancel');
    document.getElementById('modal-save').textContent = t('save');
    this.el.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => { const inp = this.el.querySelector('input,select,textarea'); if (inp) inp.focus(); }, 100);
  },
  close() {
    if (this.el) this.el.classList.remove('open');
    document.body.style.overflow = '';
  },
  confirm(msg, cb) { showConfirm(msg, cb); }
};

// ─── Sidebar ───────────────────────────────────────────────────────────────────
function setActiveNav() {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === page);
  });
}

// ─── Category / Unit options ───────────────────────────────────────────────────
function getCatOptions(selected = '') {
  return ['food', 'drink', 'material', 'other'].map(c =>
    `<option value="${c}" ${selected === c ? 'selected' : ''}>${t('cat_' + c)}</option>`).join('');
}
function getUnitOptions(selected = '') {
  return ['pcs', 'kg', 'liter', 'box', 'pack', 'can', 'bottle'].map(u =>
    `<option value="${u}" ${selected === u ? 'selected' : ''}>${t('unit_' + u)}</option>`).join('');
}

// ─── Stock badge ───────────────────────────────────────────────────────────────
function stockBadge(stock) {
  if (stock === 0) return `<span class="badge badge-danger">${t('out_stock')}</span>`;
  if (stock <= 5) return `<span class="badge badge-warn">${t('low_stock')}</span>`;
  return `<span class="badge badge-success">${t('in_stock')}</span>`;
}

// ─── Date filter ───────────────────────────────────────────────────────────────
function filterByDate(items, range) {
  const now = new Date(); now.setHours(23, 59, 59);
  return items.filter(item => {
    const d = new Date(item.date);
    if (range === 'today') { const s = new Date(); s.setHours(0, 0, 0, 0); return d >= s && d <= now; }
    if (range === 'week') { const s = new Date(); s.setDate(s.getDate() - 7); s.setHours(0, 0, 0, 0); return d >= s; }
    if (range === 'month') { const s = new Date(); s.setDate(1); s.setHours(0, 0, 0, 0); return d >= s; }
    return true;
  });
}

// ─── Notifications ─────────────────────────────────────────────────────────────
function getAlerts() {
  const products = DB.getProducts();
  return products.filter(p => p.stock <= 5).map(p => ({
    type: p.stock === 0 ? 'out' : 'low',
    name: p.name,
    stock: p.stock,
    unit: p.unit,
  }));
}
function updateNotifBadge() {
  const alerts = getAlerts();
  const badge = document.getElementById('notif-count');
  if (badge) {
    badge.textContent = alerts.length;
    badge.style.display = alerts.length ? 'flex' : 'none';
  }
}
function showNotifications() {
  const alerts = getAlerts();
  let notifPanel = document.getElementById('notif-panel');
  if (notifPanel) { notifPanel.remove(); return; }
  notifPanel = document.createElement('div');
  notifPanel.id = 'notif-panel';
  notifPanel.className = 'notif-panel';
  const items = alerts.length
    ? alerts.map(a => `
        <div class="notif-item ${a.type === 'out' ? 'notif-danger' : 'notif-warn'}">
          <span class="notif-icon">${a.type === 'out' ? '🚫' : '⚠️'}</span>
          <div class="notif-text">
            <strong>${a.name}</strong>
            <span>${a.type === 'out' ? t('notif_out_stock') : t('notif_low_stock')} — ${fmtNum(a.stock)} ${t('unit_' + a.unit)}</span>
          </div>
        </div>`).join('')
    : `<div class="notif-empty">${t('no_notifications')}</div>`;
  notifPanel.innerHTML = `
    <div class="notif-header">
      <strong>${t('notifications')}</strong>
      ${alerts.length ? `<a href="products.html" class="notif-link">${t('nav_products')} →</a>` : ''}
    </div>
    ${items}`;
  document.querySelector('.header-right').appendChild(notifPanel);
  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function handler(e) {
      if (!notifPanel.contains(e.target) && e.target.id !== 'btn-notif') {
        notifPanel.remove();
        document.removeEventListener('click', handler);
      }
    });
  }, 50);
}

// ─── Print ─────────────────────────────────────────────────────────────────────
function getBizInfo() {
  const s = DB.getSettings();
  return { name: s.bizName || 'Littlemaker', phone: s.bizPhone || '', address: s.bizAddress || '', footer: s.receiptFooter || t('receipt_thank') };
}
function printPage() {
  const biz = getBizInfo();
  let ph = document.getElementById('print-header');
  if (!ph) { ph = document.createElement('div'); ph.id = 'print-header'; ph.className = 'print-header'; document.body.prepend(ph); }
  ph.innerHTML = `
    <div class="print-logo">${biz.name}</div>
    ${biz.address ? `<div>${biz.address}</div>` : ''}
    ${biz.phone ? `<div>${biz.phone}</div>` : ''}
    <div class="print-date">${t('generated_on')}: ${fmtDateTime(new Date())}</div>
    <hr>`;
  window.print();
}

// ─── Export CSV ────────────────────────────────────────────────────────────────
function downloadCSV(rows, filename) {
  const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Receipt Print ─────────────────────────────────────────────────────────────
function printReceipt(saleId) {
  const sale = DB.getSales().find(s => s.id === saleId);
  if (!sale) return;
  const biz = getBizInfo();
  const win = window.open('', '_blank', 'width=380,height=600');
  win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <title>${t('receipt_title')}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Kantumruy+Pro:wght@400;700&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Kantumruy Pro', sans-serif; padding: 20px; font-size: 14px; color: #111; max-width: 320px; margin: 0 auto; }
      .r-biz { text-align: center; font-weight: 700; font-size: 18px; margin-bottom: 4px; }
      .r-sub { text-align: center; font-size: 12px; color: #555; margin-bottom: 12px; }
      .r-title { text-align: center; font-size: 16px; font-weight: 700; border-top: 1px dashed #aaa; border-bottom: 1px dashed #aaa; padding: 6px 0; margin: 10px 0; }
      .r-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
      .r-row.total { font-weight: 700; font-size: 15px; border-top: 1px dashed #aaa; margin-top: 8px; padding-top: 8px; }
      .r-footer { text-align: center; margin-top: 18px; font-size: 12px; color: #555; border-top: 1px dashed #aaa; padding-top: 10px; }
      @media print { body { padding: 8px; } }
    </style>
  </head><body>
    <div class="r-biz">${biz.name}</div>
    <div class="r-sub">${biz.address || ''} ${biz.phone ? '| ☎ ' + biz.phone : ''}</div>
    <div class="r-title">🧾 ${t('receipt_title')}</div>
    <div class="r-row"><span>${t('receipt_no')}:</span><span>#${sale.id.slice(-6).toUpperCase()}</span></div>
    <div class="r-row"><span>${t('date')}:</span><span>${fmtDate(sale.date)}</span></div>
    ${sale.customer ? `<div class="r-row"><span>${t('customer')}:</span><span>${sale.customer}</span></div>` : ''}
    <br>
    <div class="r-row"><span>${sale.productName}</span></div>
    <div class="r-row"><span>  x ${fmtNum(sale.quantity)} × ${fmtKHR(sale.unitPrice)}</span><span>${fmtKHR(sale.total)}</span></div>
    <div class="r-row total"><span>${t('total')}:</span><span>${fmtKHR(sale.total)}</span></div>
    ${sale.note ? `<div class="r-row"><span>${t('note')}:</span><span>${sale.note}</span></div>` : ''}
    <div class="r-footer">${biz.footer}</div>
    <script>window.onload=()=>{ window.print(); }<\/script>
  </body></html>`);
  win.document.close();
}

// ─── Sidebar toggle ────────────────────────────────────────────────────────────
function initSidebar() {
  const toggleBtn = document.getElementById('sidebar-toggle');
  const sidebar = document.querySelector('.sidebar');
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.addEventListener('click', (e) => {
      if (!sidebar.contains(e.target) && !toggleBtn.contains(e.target)) sidebar.classList.remove('open');
    });
  }
}

// ─── Keyboard shortcuts ────────────────────────────────────────────────────────
function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      const btn = document.getElementById('btn-add');
      if (btn) btn.click();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault();
      printPage();
    }
  });
}

// ─── Stock adjustment modal ────────────────────────────────────────────────────
function openAdjustStock(id) {
  const p = DB.getProduct(id);
  if (!p) return;
  const body = `
    <div style="margin-bottom:14px;">
      <div style="font-size:16px;font-weight:700;">${p.name}</div>
      <div style="color:var(--text-muted);font-size:13px;">${t('stock')}: <strong>${fmtNum(p.stock)} ${t('unit_'+p.unit)}</strong></div>
    </div>
    <div class="form-grid">
      <div class="form-group full">
        <label>${t('adjust_stock')}</label>
        <div class="stock-adj-row">
          <button class="stock-adj-btn minus" onclick="adjQty(-1)">−</button>
          <input type="number" id="adj-qty" class="form-input" value="1" min="1" style="text-align:center;font-size:18px;font-weight:700;">
          <button class="stock-adj-btn plus" onclick="adjQty(1)">+</button>
        </div>
      </div>
      <div class="form-group">
        <label>${t('add_stock')} / ដក</label>
        <div style="display:flex;gap:8px;">
          <label style="display:flex;align-items:center;gap:6px;font-weight:400;cursor:pointer;">
            <input type="radio" name="adj-dir" value="add" checked> <span style="color:var(--success)">▲ ${t('add_stock')}</span>
          </label>
          <label style="display:flex;align-items:center;gap:6px;font-weight:400;cursor:pointer;">
            <input type="radio" name="adj-dir" value="sub"> <span style="color:var(--danger)">▼ ដក</span>
          </label>
        </div>
      </div>
      <div class="form-group full">
        <label>${t('reason')}</label>
        <input type="text" id="adj-reason" class="form-input" placeholder="ការបន្ថែម / ខូច / ហ...">
      </div>
    </div>`;
  Modal.open(t('adjust_stock') + ' — ' + p.name, body, () => {
    const qty = parseInt(document.getElementById('adj-qty').value) || 0;
    const dir = document.querySelector('[name="adj-dir"]:checked').value;
    if (qty < 1) { showToast(t('fill_required'), 'error'); return; }
    const change = dir === 'add' ? qty : -qty;
    DB.updateStock(id, change); DB.addHistory("adjust", { ...p, stock: (p.stock || 0) + change });
    Modal.close();
    showToast(t('saved'));
    if (typeof renderProducts === 'function') renderProducts();
  });
}
function adjQty(delta) {
  const el = document.getElementById('adj-qty');
  if (el) el.value = Math.max(1, (parseInt(el.value) || 1) + delta);
}

// ─── Init ───────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  DB.seedIfEmpty();
  applyTheme(getTheme());
  applyLang();
  setActiveNav();
  initSidebar();
  initKeyboardShortcuts();
  updateNotifBadge();

  // Modal close
  const overlay = document.getElementById('modal');
  if (overlay) {
    document.getElementById('modal-cancel').addEventListener('click', () => Modal.close());
    document.getElementById('modal-close').addEventListener('click', () => Modal.close());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) Modal.close(); });
  }

  // Lang buttons
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => switchLang(btn.dataset.lang));
  });

  // Theme toggle
  const themeBtn = document.getElementById('btn-theme');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  // Notification bell
  const notifBtn = document.getElementById('btn-notif');
  if (notifBtn) notifBtn.addEventListener('click', (e) => { e.stopPropagation(); showNotifications(); });

  // Print button
  const printBtn = document.getElementById('btn-print');
  if (printBtn) printBtn.addEventListener('click', printPage);
});
