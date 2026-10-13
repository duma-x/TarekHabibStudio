import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Search, Loader2, UserCheck, UserX } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { logAction } from '@/lib/auditLog';
import { Employee } from '@/types';
import { JOB_ROLES } from '@/lib/constants';
import { toast } from 'sonner';

const EMPTY = { name: '', mobile: '', job_role: JOB_ROLES[0], is_active: true };

export default function Employees() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<typeof EMPTY>({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('employees').select('*').order('name');
    setEmployees(data ?? []);
    setLoading(false);
  }

  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.mobile.includes(search) ||
    e.job_role.toLowerCase().includes(search.toLowerCase())
  );

  const active = employees.filter(e => e.is_active).length;

  function openCreate() { setEditing(null); setForm({ ...EMPTY }); setShowForm(true); }
  function openEdit(e: Employee) { setEditing(e); setForm({ name: e.name, mobile: e.mobile, job_role: e.job_role, is_active: e.is_active }); setShowForm(true); }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('يرجى إدخال الاسم'); return; }
    if (!form.mobile.trim()) { toast.error('يرجى إدخال رقم الهاتف'); return; }
    setSaving(true);
    const payload = { name: form.name.trim(), mobile: form.mobile.trim(), job_role: form.job_role, is_active: form.is_active, updated_at: new Date().toISOString() };
    if (editing) {
      const { error } = await supabase.from('employees').update(payload).eq('id', editing.id);
      if (error) { toast.error('فشل التحديث'); setSaving(false); return; }
      await logAction(user?.id, 'تعديل موظف', 'employees', editing.id);
      toast.success('تم التحديث');
    } else {
      const { error } = await supabase.from('employees').insert({ ...payload });
      if (error) { toast.error('فشل الإضافة'); setSaving(false); return; }
      await logAction(user?.id, 'إضافة موظف', 'employees');
      toast.success('تمت الإضافة');
    }
    setSaving(false); setShowForm(false); load();
  }

  async function toggleActive(e: Employee) {
    await supabase.from('employees').update({ is_active: !e.is_active, updated_at: new Date().toISOString() }).eq('id', e.id);
    await logAction(user?.id, e.is_active ? 'تعطيل موظف' : 'تفعيل موظف', 'employees', e.id);
    toast.success(e.is_active ? 'تم تعطيل الموظف' : 'تم تفعيل الموظف');
    load();
  }

  async function handleDelete(e: Employee) {
    if (!confirm(`هل تريد حذف الموظف "${e.name}"؟`)) return;
    const { error } = await supabase.from('employees').delete().eq('id', e.id);
    if (error) { toast.error('لا يمكن الحذف'); return; }
    await logAction(user?.id, 'حذف موظف', 'employees', e.id, { name: e.name });
    toast.success('تم الحذف'); load();
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">الموظفون</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{active} موظف نشط من {employees.length}</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> إضافة موظف</button>
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
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">الاسم</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">الوظيفة</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">رقم الهاتف</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">الحالة</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="text-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" /></td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">لا يوجد موظفون</td></tr>}
            {filtered.map(e => (
              <tr key={e.id} className="table-row">
                <td className="px-4 py-3 font-medium">{e.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{e.job_role}</td>
                <td className="px-4 py-3 text-muted-foreground" dir="ltr">{e.mobile}</td>
                <td className="px-4 py-3">
                  <span className={`status-badge border ${e.is_active ? 'bg-green-500/15 text-green-400 border-green-500/20' : 'bg-muted text-muted-foreground border-border'}`}>
                    {e.is_active ? 'نشط' : 'غير نشط'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => openEdit(e)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => toggleActive(e)} className={`p-1.5 rounded-lg transition-colors ${e.is_active ? 'text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10' : 'text-muted-foreground hover:text-green-400 hover:bg-green-500/10'}`}>
                      {e.is_active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => handleDelete(e)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
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
            <h2 className="text-lg font-bold mb-5">{editing ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}</h2>
            <div className="space-y-4">
              <div>
                <label className="form-label">الاسم *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="الاسم الكامل"
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="form-label">رقم الهاتف *</label>
                <input value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} dir="ltr"
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="form-label">المسمى الوظيفي *</label>
                <select value={form.job_role} onChange={e => setForm(f => ({ ...f, job_role: e.target.value }))}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                  {JOB_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="isActive" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4 accent-primary" />
                <label htmlFor="isActive" className="text-sm text-foreground">موظف نشط</label>
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
    </div>
  );
}
