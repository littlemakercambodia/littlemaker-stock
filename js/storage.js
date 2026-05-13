// ─── Storage (localStorage cache + Firestore sync) ────────────────────────────
const DB = {
  get(key) { try { return JSON.parse(localStorage.getItem('lm_' + key) || '[]'); } catch { return []; } },
  set(key, data) { localStorage.setItem('lm_' + key, JSON.stringify(data)); },
  uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); },

  // ─── Firestore helpers ──────────────────────────────────────────────────────
  _bizRef() {
    if (!window._lmBusinessId) return null;
    return firebase.firestore().collection('businesses').doc(window._lmBusinessId);
  },
  _cloudSet(col, id, data) {
    const ref = this._bizRef();
    if (!ref) return;
    ref.collection(col).doc(id).set(data).catch(e => console.error('[DB] cloud set:', e));
  },
  _cloudDelete(col, id) {
    const ref = this._bizRef();
    if (!ref) return;
    ref.collection(col).doc(id).delete().catch(e => console.error('[DB] cloud del:', e));
  },

  // Pull all data from Firestore into localStorage
  async syncFromCloud() {
    const ref = this._bizRef();
    if (!ref) return;
    try {
      const [pSnap, sSnap, puSnap, setSnap, binSnap, histSnap] = await Promise.all([
        ref.collection('products').get(),
        ref.collection('sales').get(),
        ref.collection('purchases').get(),
        ref.collection('settings').get(),
        ref.collection('recycle_bin').get(),
        ref.collection('product_history').get(),
      ]);
      const docs = snap => snap.docs.map(d => d.data());
      this.set('products',        docs(pSnap));
      this.set('sales',           docs(sSnap));
      this.set('purchases',       docs(puSnap));
      this.set('recycle_bin',     docs(binSnap));
      this.set('product_history', docs(histSnap));
      if (!setSnap.empty) {
        const s = setSnap.docs[0]?.data() || {};
        localStorage.setItem('lm_settings', JSON.stringify(s));
      }
    } catch (e) {
      console.error('[DB] syncFromCloud error:', e);
    }
  },

  // Push all localStorage data up to Firestore (used after importAll)
  async pushAllToCloud() {
    const ref = this._bizRef();
    if (!ref) return;
    const batch = () => firebase.firestore().batch();
    const write = async (col, items) => {
      const colRef = ref.collection(col);
      for (const item of items) {
        colRef.doc(item.id).set(item).catch(() => {});
      }
    };
    await Promise.all([
      write('products',        this.getProducts()),
      write('sales',           this.getSales()),
      write('purchases',       this.getPurchases()),
      write('recycle_bin',     this.getRecycleBin()),
      write('product_history', this.getHistory()),
    ]);
    // Settings as single doc
    const s = this.getSettings();
    if (Object.keys(s).length) {
      ref.collection('settings').doc('main').set(s).catch(() => {});
    }
  },

  // ─── Products ───────────────────────────────────────────────────────────────
  getProducts() { return this.get('products'); },
  saveProduct(p) {
    const list = this.getProducts();
    const idx = list.findIndex(x => x.id === p.id);
    if (idx >= 0) list[idx] = p; else list.push(p);
    this.set('products', list);
    this._cloudSet('products', p.id, p);
  },
  deleteProduct(id) {
    this.set('products', this.getProducts().filter(p => p.id !== id));
    this._cloudDelete('products', id);
  },
  getProduct(id) { return this.getProducts().find(p => p.id === id); },
  updateStock(id, change) {
    const list = this.getProducts();
    const p = list.find(x => x.id === id);
    if (p) {
      p.stock = Math.max(0, (p.stock || 0) + change);
      this.set('products', list);
      this._cloudSet('products', p.id, p);
    }
    return p;
  },

  // ─── Recycle Bin ────────────────────────────────────────────────────────────
  getRecycleBin() { return this.get('recycle_bin'); },
  moveToRecycleBin(id) {
    const p = this.getProduct(id);
    if (!p) return;
    const bin = this.getRecycleBin();
    const item = { ...p, deletedAt: new Date().toISOString() };
    bin.unshift(item);
    this.set('recycle_bin', bin);
    this.deleteProduct(id);
    this._cloudSet('recycle_bin', id, item);
    this.addHistory('delete', p);
  },
  restoreFromBin(id) {
    const bin = this.getRecycleBin();
    const item = bin.find(x => x.id === id);
    if (!item) return;
    const { deletedAt, ...restored } = item;
    restored.updatedAt = new Date().toISOString();
    this.saveProduct(restored);
    this.set('recycle_bin', bin.filter(x => x.id !== id));
    this._cloudDelete('recycle_bin', id);
    this.addHistory('restore', restored);
  },
  permanentDelete(id) {
    const bin = this.getRecycleBin();
    const item = bin.find(x => x.id === id);
    if (item) this.addHistory('permanent_delete', item);
    this.set('recycle_bin', bin.filter(x => x.id !== id));
    this._cloudDelete('recycle_bin', id);
  },
  emptyRecycleBin() {
    const bin = this.getRecycleBin();
    bin.forEach(item => { this.addHistory('permanent_delete', item); this._cloudDelete('recycle_bin', item.id); });
    this.set('recycle_bin', []);
  },

  // ─── History ────────────────────────────────────────────────────────────────
  getHistory() { return this.get('product_history'); },
  addHistory(action, product) {
    const history = this.getHistory();
    const entry = {
      id: this.uid(), action, productId: product.id, productName: product.name,
      snapshot: { ...product }, timestamp: new Date().toISOString(),
    };
    history.unshift(entry);
    const trimmed = history.slice(0, 200);
    this.set('product_history', trimmed);
    this._cloudSet('product_history', entry.id, entry);
  },
  clearHistory() {
    const history = this.getHistory();
    history.forEach(h => this._cloudDelete('product_history', h.id));
    this.set('product_history', []);
  },

  // ─── Sales ──────────────────────────────────────────────────────────────────
  getSales() { return this.get('sales'); },
  saveSale(s) {
    const list = this.getSales();
    list.unshift(s);
    this.set('sales', list);
    this._cloudSet('sales', s.id, s);
  },
  deleteSale(id) {
    const list = this.getSales();
    const s = list.find(x => x.id === id);
    if (s && s.productId) this.updateStock(s.productId, s.quantity);
    this.set('sales', list.filter(x => x.id !== id));
    this._cloudDelete('sales', id);
  },

  // ─── Purchases ──────────────────────────────────────────────────────────────
  getPurchases() { return this.get('purchases'); },
  savePurchase(p) {
    const list = this.getPurchases();
    list.unshift(p);
    this.set('purchases', list);
    this._cloudSet('purchases', p.id, p);
  },
  deletePurchase(id) {
    const list = this.getPurchases();
    const p = list.find(x => x.id === id);
    if (p && p.productId) this.updateStock(p.productId, -p.quantity);
    this.set('purchases', list.filter(x => x.id !== id));
    this._cloudDelete('purchases', id);
  },

  // ─── Settings ───────────────────────────────────────────────────────────────
  getSettings() {
    try { return JSON.parse(localStorage.getItem('lm_settings') || '{}'); } catch { return {}; }
  },
  saveSettings(s) {
    localStorage.setItem('lm_settings', JSON.stringify(s));
    const ref = this._bizRef();
    if (ref) ref.collection('settings').doc('main').set(s).catch(() => {});
  },
  getSetting(key, def = '') {
    const s = this.getSettings();
    return s[key] !== undefined ? s[key] : def;
  },

  // ─── Stats ──────────────────────────────────────────────────────────────────
  getStats() {
    const products  = this.getProducts();
    const sales     = this.getSales();
    const purchases = this.getPurchases();
    return {
      productCount:    products.length,
      totalSales:      sales.reduce((s, x) => s + (x.total || 0), 0),
      totalPurchases:  purchases.reduce((s, x) => s + (x.total || 0), 0),
      profit:          sales.reduce((s, x) => s + (x.total || 0), 0) - purchases.reduce((s, x) => s + (x.total || 0), 0),
      lowStock:        products.filter(p => p.stock > 0 && p.stock <= 5).length,
      outStock:        products.filter(p => p.stock === 0).length,
    };
  },

  // ─── Export / Import / Reset ────────────────────────────────────────────────
  exportAll() {
    return {
      version: '2.0', exportedAt: new Date().toISOString(),
      products: this.getProducts(), sales: this.getSales(),
      purchases: this.getPurchases(), settings: this.getSettings(),
    };
  },
  importAll(data) {
    if (!data || !data.products) throw new Error('Invalid format');
    if (data.products)  this.set('products',  data.products);
    if (data.sales)     this.set('sales',     data.sales);
    if (data.purchases) this.set('purchases', data.purchases);
    if (data.settings)  localStorage.setItem('lm_settings', JSON.stringify(data.settings));
    // Push everything to Firestore
    this.pushAllToCloud();
  },
  resetAll() {
    ['products','sales','purchases','settings','recycle_bin','product_history']
      .forEach(k => localStorage.removeItem('lm_' + k));
    // Clear Firestore
    const ref = this._bizRef();
    if (ref) {
      ['products','sales','purchases','settings','recycle_bin','product_history'].forEach(col => {
        ref.collection(col).get().then(snap => {
          snap.docs.forEach(d => d.ref.delete());
        }).catch(() => {});
      });
    }
  },

  // ─── Seed sample data (first-time use) ──────────────────────────────────────
  seedIfEmpty() {
    if (this.getProducts().length > 0) return;
    const now = new Date();
    const d = (offset) => { const x = new Date(now); x.setDate(x.getDate() - offset); return x.toISOString(); };
    const products = [
      { id: this.uid(), name: 'ទឹកដោះគោ',  category: 'drink',    buyPrice: 2500,  sellPrice: 3500,  stock: 50,  unit: 'pcs',   createdAt: d(10) },
      { id: this.uid(), name: 'នំប៉័ង',     category: 'food',     buyPrice: 1500,  sellPrice: 2500,  stock: 30,  unit: 'pcs',   createdAt: d(9)  },
      { id: this.uid(), name: 'អង្ករ',      category: 'material', buyPrice: 4000,  sellPrice: 5000,  stock: 100, unit: 'kg',    createdAt: d(8)  },
      { id: this.uid(), name: 'ទឹក',        category: 'drink',    buyPrice: 800,   sellPrice: 1200,  stock: 200, unit: 'liter', createdAt: d(7)  },
      { id: this.uid(), name: 'ស្ករ',       category: 'food',     buyPrice: 3500,  sellPrice: 4500,  stock: 3,   unit: 'kg',    createdAt: d(5)  },
      { id: this.uid(), name: 'ប្រេងឆា',   category: 'material', buyPrice: 12000, sellPrice: 15000, stock: 0,   unit: 'liter', createdAt: d(3)  },
    ];
    this.set('products', products);
    const sales = [
      { id: this.uid(), productId: products[0].id, productName: products[0].name, quantity: 5,  unitPrice: 3500, total: 17500, customer: 'ដារ៉ា', note: '', date: d(1) },
      { id: this.uid(), productId: products[1].id, productName: products[1].name, quantity: 10, unitPrice: 2500, total: 25000, customer: 'សុខា',  note: '', date: d(2) },
      { id: this.uid(), productId: products[2].id, productName: products[2].name, quantity: 2,  unitPrice: 5000, total: 10000, customer: '',      note: '', date: d(0) },
      { id: this.uid(), productId: products[3].id, productName: products[3].name, quantity: 20, unitPrice: 1200, total: 24000, customer: 'ចន្ទ',  note: '', date: d(3) },
    ];
    this.set('sales', sales);
    const purchases = [
      { id: this.uid(), productId: products[0].id, productName: products[0].name, quantity: 100, unitPrice: 2500, total: 250000, supplier: 'ផ្សារ',    note: '', date: d(5) },
      { id: this.uid(), productId: products[2].id, productName: products[2].name, quantity: 50,  unitPrice: 4000, total: 200000, supplier: 'រោងចក្រ', note: '', date: d(4) },
    ];
    this.set('purchases', purchases);
    // Push seed data to Firestore
    this.pushAllToCloud();
  },
};
