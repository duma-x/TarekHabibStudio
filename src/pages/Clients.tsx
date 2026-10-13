import { useEffect, useState } from 'react';
import { Search, Plus, Edit2, Archive, Trash2, Loader2, Phone, ShoppingCart } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { logAction } from '@/lib/auditLog';
import { normalizePhone, formatCurrency, formatDate } from '@/lib/utils';
import { Client } from '@/types';
import { toast } from 'sonner';

interface ClientWithStats extends Client { order_count: number; total_balance: number; }

export default function Clients() {
  const { user } = useAuth();
  const [clients, setClients] = useState<ClientWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadClients(); }, [showArchived]);

  async function loadClients() {
    setLoading(true);
    const { data } = await supabase.from('clients').select('*, orders(count, remaining)')
      .eq('is_archived', showArchived).order('name');
    if (data) {
      const withStats = data.map((c: any) => ({
        ...c,
        order_count: c.orders?.length ?? 0,
        total_balance: c.orders?.reduce((s: number, o: any) => s + Number(o.remaining ?? 0), 0) ?? 0,
      }));
      setClients(withStats);
    }
    setLoading(false);
  }

  async function loadClientsWithCounts() {
    setLoading(true);
    const { data: clientsData } = await supabase.from('clients').select('*').eq('is_archived', showArchived).order('name');
    if (!clientsData) { setLoading(false); return; }
    const { data: ordersData } = await supabase.from('orders').select('client_id, remaining').neq('status', 'ملغي');
    const statsMap: Record<string, { count: number; balance: number }> = {};
    (ordersData ?? []).forEach((o: any) => {
      if (!o.client_id) return;
      if (!statsMap[o.client_id]) statsMap[o.client_id] = { count: 0, balance: 0 };
      statsMap[o.client_id].count++;
      statsMap[o.client_id].balance += Number(o.remaining ?? 0);
    });
    setClients(clientsData.map(c => ({ ...c, order_count: statsMap[c.id]?.count ?? 0, total_balance: statsMap[c.id]?.balance ?? 0 })));
    setLoading(false);
  }

  useEffect(() => { loadClientsWithCounts(); }, [showArchived]);

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.mobile.includes(search)
  );

  function openCreate() {
    setEditing(null); setName(''); setMobile('');
    setShowForm(true);
  }

  function openEdit(c: Client) {
    setEditing(c); setName(c.name); setMobile(c.mobile);
    setShowForm(true);
  }

  async function handleSave() {
    if (!name.trim()) { toast.error('يرجى إدخال اسم العميل'); return; }
    if (!mobile.trim()) { toast.error('يرجى إدخال رقم الهاتف'); return; }
    const normalized = normalizePhone(mobile.trim());
    setSaving(true);

    if (editing) {
      const { error } = await supabase.from('clients').update({ name: name.trim(), mobile: mobile.trim(), mobile_normalized: normalized, updated_at: new Date().toISOString() }).eq('id', editing.id);
      if (error) {
        if (error.code === '23505') toast.error('رقم الهاتف مستخدم مسبقاً لعميل آخر');
        else toast.error('حدث خطأ أثناء التحديث');
        setSaving(false); return;
      }
      await logAction(user?.id, 'تعديل عميل', 'clients', editing.id, { name: name.trim(), mobile });
      toast.success('تم تحديث بيانات العميل');
    } else {
      const { data: existing } = await supabase.from('clients').select('id,name').eq('mobile_normalized', normalized).maybeSingle();
      if (existing) { toast.error(`رقم الهاتف مستخدم بالفعل للعميل: ${existing.name}`); setSaving(false); return; }
      const { error } = await supabase.from('clients').insert({ name: name.trim(), mobile: mobile.trim(), mobile_normalized: normalized });
      if (error) { toast.error('حدث خطأ أثناء الإضافة'); setSaving(false); return; }
      await logAction(user?.id, 'إضافة عميل', 'clients', undefined, { name: name.trim(), mobile });
      toast.success('تمت إضافة العميل بنجاح');
    }
    setSaving(false); setShowForm(false); loadClientsWithCounts();
  }

  async function handleArchive(c: ClientWithStats) {
    if (!confirm(`هل تريد ${c.is_archived ? 'إلغاء أرشفة' : 'أرشفة'} العميل "${c.name}"؟`)) return;
    await supabase.from('clients').update({ is_archived: !c.is_archived }).eq('id', c.id);
    await logAction(user?.id, c.is_archived ? 'إلغاء أرشفة عميل' : 'أرشفة عميل', 'clients', c.id);
    toast.success(c.is_archived ? 'تم إلغاء الأرشفة' : 'تم أرشفة العميل');
    loadClientsWithCounts();
  }

  async function handleDelete(c: ClientWithStats) {
    if (c.order_count > 0) { toast.error('لا يمكن حذف عميل لديه طلبات. يرجى أرشفته بدلاً من ذلك.'); return; }
    if (!confirm(`هل أنت متأكد من حذف العميل "${c.name}" نهائياً؟`)) return;
    await supabase.from('clients').delete().eq('id', c.id);
    await logAction(user?.id, 'حذف عميل', 'clients', c.id, { name: c.name });
    toast.success('تم حذف العميل');
    loadClientsWithCounts();
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="page-title">العملاء</h1>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> عميل جديد
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث بالاسم أو الهاتف..."
            className="w-full bg-card border border-border rounded-lg pr-9 pl-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary" />
        </div>
        <button onClick={() => setShowArchived(!showArchived)}
          className={`px-4 py-2.5 rounded-lg text-sm border transition-colors ${showArchived ? 'bg-primary/15 text-primary border-primary/30' : 'border-border text-muted-foreground hover:text-foreground'}`}>
          {showArchived ? 'المؤرشفون' : 'النشطون'}
        </button>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">الاسم</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">رقم الهاتف</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">عدد الطلبات</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">الرصيد المستحق</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="text-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" /></td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">لا يوجد عملاء</td></tr>
            )}
            {filtered.map(c => (
              <tr key={c.id} className="table-row">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-muted-foreground" dir="ltr">{c.mobile}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <ShoppingCart className="w-3.5 h-3.5" />{c.order_count}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={c.total_balance > 0 ? 'text-amber-400 font-semibold' : 'text-muted-foreground'}>
                    {formatCurrency(c.total_balance)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleArchive(c)} className="p-1.5 rounded-lg text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10 transition-colors">
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(c)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Form Dialog */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-bold mb-5">{editing ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}</h2>
            <div className="space-y-4">
              <div>
                <label className="form-label">اسم العميل *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="الاسم الكامل"
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary" />
              </div>
              <div>
                <label className="form-label">رقم الهاتف *</label>
                <input value={mobile} onChange={e => setMobile(e.target.value)} placeholder="01xxxxxxxxx" dir="ltr"
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2 py-2.5">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} حفظ
              </button>
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
