import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Search, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { logAction } from '@/lib/auditLog';
import { formatCurrency } from '@/lib/utils';
import { PriceListItem } from '@/types';
import { toast } from 'sonner';

export default function PriceList() {
  const { user } = useAuth();
  const [items, setItems] = useState<PriceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PriceListItem | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('price_list_items').select('*').order('name');
    setItems(data ?? []);
    setLoading(false);
  }

  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

  function openCreate() { setEditing(null); setName(''); setPrice(''); setShowForm(true); }
  function openEdit(i: PriceListItem) { setEditing(i); setName(i.name); setPrice(String(i.price)); setShowForm(true); }

  async function handleSave() {
    if (!name.trim()) { toast.error('يرجى إدخال اسم العنصر'); return; }
    const p = parseFloat(price);
    if (isNaN(p) || p < 0) { toast.error('يرجى إدخال سعر صحيح'); return; }
    setSaving(true);
    if (editing) {
      const { error } = await supabase.from('price_list_items').update({ name: name.trim(), price: p, updated_at: new Date().toISOString() }).eq('id', editing.id);
      if (error) { toast.error('فشل التحديث'); setSaving(false); return; }
      await logAction(user?.id, 'تعديل عنصر قائمة أسعار', 'price_list_items', editing.id, { name: name.trim(), price: p });
      toast.success('تم التحديث');
    } else {
      const { error } = await supabase.from('price_list_items').insert({ name: name.trim(), price: p });
      if (error) { toast.error('فشل الإضافة'); setSaving(false); return; }
      await logAction(user?.id, 'إضافة عنصر قائمة أسعار', 'price_list_items', undefined, { name: name.trim(), price: p });
      toast.success('تمت الإضافة');
    }
    setSaving(false); setShowForm(false); load();
  }

  async function toggleActive(item: PriceListItem) {
    await supabase.from('price_list_items').update({ is_active: !item.is_active, updated_at: new Date().toISOString() }).eq('id', item.id);
    await logAction(user?.id, item.is_active ? 'تعطيل عنصر' : 'تفعيل عنصر', 'price_list_items', item.id);
    toast.success(item.is_active ? 'تم تعطيل العنصر' : 'تم تفعيل العنصر');
    load();
  }

  async function handleDelete(item: PriceListItem) {
    if (!confirm(`هل تريد حذف "${item.name}"؟`)) return;
    const { error } = await supabase.from('price_list_items').delete().eq('id', item.id);
    if (error) { toast.error('لا يمكن الحذف، ربما مرتبط بطلبات'); return; }
    await logAction(user?.id, 'حذف عنصر قائمة أسعار', 'price_list_items', item.id, { name: item.name });
    toast.success('تم الحذف');
    load();
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="page-title">قائمة الأسعار</h1>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> إضافة عنصر</button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..."
          className="w-full bg-card border border-border rounded-lg pr-9 pl-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">اسم الخدمة / العنصر</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">السعر الحالي</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">الحالة</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} className="text-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" /></td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={4} className="text-center py-10 text-muted-foreground">لا توجد عناصر</td></tr>}
            {filtered.map(item => (
              <tr key={item.id} className="table-row">
                <td className="px-4 py-3 font-medium">{item.name}</td>
                <td className="px-4 py-3 font-semibold text-primary">{formatCurrency(item.price)}</td>
                <td className="px-4 py-3">
                  <span className={`status-badge border ${item.is_active ? 'bg-green-500/15 text-green-400 border-green-500/20' : 'bg-muted text-muted-foreground border-border'}`}>
                    {item.is_active ? 'نشط' : 'معطل'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => toggleActive(item)} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                      {item.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button onClick={() => handleDelete(item)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-bold mb-5">{editing ? 'تعديل العنصر' : 'إضافة عنصر جديد'}</h2>
            <div className="space-y-4">
              <div>
                <label className="form-label">اسم الخدمة / العنصر *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="مثال: جلسة تصوير داخلية"
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="form-label">السعر (ج.م) *</label>
                <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0" min={0}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" dir="ltr" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2 py-2.5">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} حفظ
              </button>
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
