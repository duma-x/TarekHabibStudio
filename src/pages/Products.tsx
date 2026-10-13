import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Search, AlertTriangle, Loader2, ArrowUp, ArrowDown, History } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { logAction } from '@/lib/auditLog';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Product, InventoryMovement } from '@/types';
import { MOVEMENT_TYPE_LABELS, MOVEMENT_TYPE_COLORS } from '@/lib/constants';
import { toast } from 'sonner';

export default function Products() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('');
  const [threshold, setThreshold] = useState('5');
  const [saving, setSaving] = useState(false);
  const [showAdjust, setShowAdjust] = useState<Product | null>(null);
  const [adjType, setAdjType] = useState<'in' | 'out' | 'adjustment'>('in');
  const [adjQty, setAdjQty] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [showHistory, setShowHistory] = useState<Product | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('products').select('*').order('name');
    setProducts(data ?? []);
    setLoading(false);
  }

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  const lowStock = products.filter(p => p.quantity <= p.low_stock_threshold);

  function openCreate() { setEditing(null); setName(''); setPrice(''); setQty('0'); setThreshold('5'); setShowForm(true); }
  function openEdit(p: Product) { setEditing(p); setName(p.name); setPrice(String(p.selling_price)); setQty(String(p.quantity)); setThreshold(String(p.low_stock_threshold)); setShowForm(true); }

  async function handleSave() {
    if (!name.trim()) { toast.error('يرجى إدخال اسم المنتج'); return; }
    const p = parseFloat(price); const q = parseInt(qty); const t = parseInt(threshold);
    if (isNaN(p) || p < 0) { toast.error('يرجى إدخال سعر صحيح'); return; }
    if (isNaN(q) || q < 0) { toast.error('يرجى إدخال كمية صحيحة'); return; }
    setSaving(true);
    if (editing) {
      const { error } = await supabase.from('products').update({ name: name.trim(), selling_price: p, quantity: q, low_stock_threshold: t || 5, updated_at: new Date().toISOString() }).eq('id', editing.id);
      if (error) { toast.error('فشل التحديث'); setSaving(false); return; }
      await logAction(user?.id, 'تعديل منتج', 'products', editing.id, { name: name.trim() });
      toast.success('تم التحديث');
    } else {
      const { data, error } = await supabase.from('products').insert({ name: name.trim(), selling_price: p, quantity: q, low_stock_threshold: t || 5 }).select().single();
      if (error) { toast.error('فشل الإضافة'); setSaving(false); return; }
      if (q > 0) await supabase.from('inventory_movements').insert({ product_id: data.id, movement_type: 'in', quantity: q, reason: 'رصيد افتتاحي', performed_by: user?.id });
      await logAction(user?.id, 'إضافة منتج', 'products', data.id, { name: name.trim() });
      toast.success('تمت الإضافة');
    }
    setSaving(false); setShowForm(false); load();
  }

  async function handleDelete(p: Product) {
    if (!confirm(`هل تريد حذف "${p.name}"؟`)) return;
    const { error } = await supabase.from('products').delete().eq('id', p.id);
    if (error) { toast.error('لا يمكن الحذف، ربما مرتبط بطلبات'); return; }
    await logAction(user?.id, 'حذف منتج', 'products', p.id, { name: p.name });
    toast.success('تم الحذف'); load();
  }

  async function handleAdjust() {
    if (!showAdjust) return;
    const q = parseInt(adjQty);
    if (isNaN(q) || q <= 0) { toast.error('يرجى إدخال كمية صحيحة'); return; }
    if (!adjReason.trim()) { toast.error('يرجى إدخال سبب التعديل'); return; }
    const product = showAdjust;
    let newQty = product.quantity;
    if (adjType === 'in') newQty += q;
    else if (adjType === 'out') {
      if (q > product.quantity) { toast.error(`لا يوجد مخزون كافٍ. المتاح: ${product.quantity}`); return; }
      newQty -= q;
    } else newQty = q;
    await supabase.from('products').update({ quantity: newQty, updated_at: new Date().toISOString() }).eq('id', product.id);
    await supabase.from('inventory_movements').insert({ product_id: product.id, movement_type: adjType, quantity: adjType === 'adjustment' ? newQty - product.quantity : q, reason: adjReason.trim(), performed_by: user?.id });
    await logAction(user?.id, 'تعديل مخزون', 'products', product.id, { type: adjType, qty: q, reason: adjReason });
    toast.success('تم تعديل المخزون'); setShowAdjust(null); setAdjQty(''); setAdjReason(''); load();
  }

  async function openHistory(p: Product) {
    setShowHistory(p);
    const { data } = await supabase.from('inventory_movements').select('*').eq('product_id', p.id).order('created_at', { ascending: false }).limit(50);
    setMovements(data ?? []);
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="page-title">المنتجات والمخزون</h1>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> إضافة منتج</button>
      </div>

      {lowStock.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-400 text-sm mb-1">تنبيه مخزون منخفض ({lowStock.length} منتج)</p>
            <p className="text-xs text-muted-foreground">{lowStock.map(p => p.name).join(' · ')}</p>
          </div>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث عن منتج..."
          className="w-full bg-card border border-border rounded-lg pr-9 pl-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">المنتج</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">سعر البيع</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">الكمية المتاحة</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">الحالة</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="text-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" /></td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">لا توجد منتجات</td></tr>}
            {filtered.map(p => {
              const isLow = p.quantity <= p.low_stock_threshold;
              return (
                <tr key={p.id} className="table-row">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 font-semibold text-primary">{formatCurrency(p.selling_price)}</td>
                  <td className="px-4 py-3 font-bold">{p.quantity}</td>
                  <td className="px-4 py-3">
                    <span className={`status-badge border ${p.quantity === 0 ? 'bg-red-500/15 text-red-400 border-red-500/20' : isLow ? 'bg-amber-500/15 text-amber-400 border-amber-500/20' : 'bg-green-500/15 text-green-400 border-green-500/20'}`}>
                      {p.quantity === 0 ? 'نفد' : isLow ? 'منخفض' : 'متوفر'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => setShowAdjust(p)} className="p-1.5 rounded-lg text-muted-foreground hover:text-green-400 hover:bg-green-500/10 transition-colors" title="تعديل مخزون">
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => openHistory(p)} className="p-1.5 rounded-lg text-muted-foreground hover:text-blue-400 hover:bg-blue-500/10 transition-colors" title="سجل الحركات">
                        <History className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(p)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Product Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-bold mb-5">{editing ? 'تعديل المنتج' : 'إضافة منتج جديد'}</h2>
            <div className="space-y-4">
              <div>
                <label className="form-label">اسم المنتج *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="مثال: ألبوم جلد فاخر 30×30"
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">سعر البيع (ج.م) *</label>
                  <input type="number" value={price} onChange={e => setPrice(e.target.value)} min={0} dir="ltr"
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <div>
                  <label className="form-label">الكمية *</label>
                  <input type="number" value={qty} onChange={e => setQty(e.target.value)} min={0} dir="ltr"
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
              </div>
              <div>
                <label className="form-label">حد التنبيه المنخفض</label>
                <input type="number" value={threshold} onChange={e => setThreshold(e.target.value)} min={0} dir="ltr"
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2 py-2.5">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} حفظ
              </button>
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm text-muted-foreground">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Adjustment */}
      {showAdjust && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-bold mb-1">تعديل مخزون</h2>
            <p className="text-muted-foreground text-sm mb-5">{showAdjust.name} — الكمية الحالية: <strong>{showAdjust.quantity}</strong></p>
            <div className="space-y-4">
              <div>
                <label className="form-label">نوع التعديل</label>
                <div className="flex gap-2">
                  {([['in', 'إضافة', 'bg-green-500/15 text-green-400 border-green-500/30'], ['out', 'خصم', 'bg-red-500/15 text-red-400 border-red-500/30'], ['adjustment', 'تعيين', 'bg-blue-500/15 text-blue-400 border-blue-500/30']] as const).map(([v, l, cls]) => (
                    <button key={v} onClick={() => setAdjType(v as any)}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${adjType === v ? cls : 'border-border text-muted-foreground'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="form-label">الكمية *</label>
                <input type="number" value={adjQty} onChange={e => setAdjQty(e.target.value)} min={1} dir="ltr"
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="form-label">السبب *</label>
                <input value={adjReason} onChange={e => setAdjReason(e.target.value)} placeholder="سبب التعديل"
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleAdjust} className="btn-primary flex-1 py-2.5">تأكيد</button>
              <button onClick={() => { setShowAdjust(null); setAdjQty(''); setAdjReason(''); }} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm text-muted-foreground">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-lg shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">سجل حركات: {showHistory.name}</h2>
              <button onClick={() => setShowHistory(null)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-2">
              {movements.length === 0 && <p className="text-center text-muted-foreground py-6 text-sm">لا توجد حركات مسجلة</p>}
              {movements.map(m => (
                <div key={m.id} className="flex items-center justify-between bg-muted/30 rounded-lg px-4 py-3">
                  <div>
                    <span className={`text-sm font-semibold ${MOVEMENT_TYPE_COLORS[m.movement_type]}`}>{MOVEMENT_TYPE_LABELS[m.movement_type]}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{m.reason}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(m.created_at)}</p>
                  </div>
                  <span className={`text-lg font-bold ${m.quantity > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {m.movement_type === 'out' ? '−' : '+'}{Math.abs(m.quantity)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
