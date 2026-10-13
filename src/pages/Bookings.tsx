import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Search, Loader2, CalendarDays } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { logAction } from '@/lib/auditLog';
import { formatCurrency, formatDate, todayInputDate, normalizePhone } from '@/lib/utils';
import { STATUS_COLORS, BOOKING_STATUSES, EVENT_TYPES } from '@/lib/constants';
import { Booking, BookingStatus } from '@/types';
import { toast } from 'sonner';

const EMPTY: Partial<Booking> = { client_name: '', client_mobile: '', event_type: EVENT_TYPES[0], booking_date: '', booking_time: '10:00', agreed_price: 0, deposit_paid: 0, status: 'جديد', notes: '' };

export default function Bookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [form, setForm] = useState<Partial<Booking>>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, [statusFilter]);

  async function load() {
    setLoading(true);
    let q = supabase.from('bookings').select('*').order('booking_date', { ascending: false });
    if (statusFilter) q = q.eq('status', statusFilter);
    const { data } = await q;
    setBookings(data ?? []);
    setLoading(false);
  }

  const filtered = bookings.filter(b =>
    !search || b.client_name.toLowerCase().includes(search.toLowerCase()) || b.client_mobile.includes(search) || b.event_type.toLowerCase().includes(search.toLowerCase())
  );

  const today = todayInputDate();
  const upcoming = bookings.filter(b => b.booking_date >= today && b.status !== 'ملغي').length;

  function openCreate() { setEditing(null); setForm({ ...EMPTY, booking_date: todayInputDate() }); setShowForm(true); }
  function openEdit(b: Booking) { setEditing(b); setForm({ ...b }); setShowForm(true); }

  const remaining = Math.max(0, (form.agreed_price ?? 0) - (form.deposit_paid ?? 0));

  async function handleSave() {
    if (!form.client_name?.trim()) { toast.error('يرجى إدخال اسم العميل'); return; }
    if (!form.client_mobile?.trim()) { toast.error('يرجى إدخال رقم الهاتف'); return; }
    if (!form.booking_date) { toast.error('يرجى تحديد تاريخ الحجز'); return; }
    if (!form.booking_time) { toast.error('يرجى تحديد وقت الحجز'); return; }
    if ((form.agreed_price ?? 0) < 0) { toast.error('السعر يجب أن يكون أكبر من أو يساوي صفر'); return; }
    if ((form.deposit_paid ?? 0) > (form.agreed_price ?? 0)) { toast.error('الدفعة المقدمة أكبر من السعر المتفق عليه'); return; }
    setSaving(true);
    const payload = {
      client_name: form.client_name!.trim(),
      client_mobile: form.client_mobile!.trim(),
      event_type: form.event_type!,
      booking_date: form.booking_date!,
      booking_time: form.booking_time!,
      agreed_price: form.agreed_price ?? 0,
      deposit_paid: form.deposit_paid ?? 0,
      status: form.status as BookingStatus,
      notes: form.notes || null,
      updated_at: new Date().toISOString(),
    };
    if (editing) {
      const { error } = await supabase.from('bookings').update(payload).eq('id', editing.id);
      if (error) { toast.error('فشل التحديث'); setSaving(false); return; }
      await logAction(user?.id, 'تعديل حجز', 'bookings', editing.id);
      toast.success('تم تحديث الحجز');
    } else {
      const { error } = await supabase.from('bookings').insert({ ...payload, created_by: user?.id });
      if (error) { toast.error('فشل إضافة الحجز'); setSaving(false); return; }
      await logAction(user?.id, 'إضافة حجز', 'bookings');
      toast.success('تمت إضافة الحجز');
    }
    setSaving(false); setShowForm(false); load();
  }

  async function handleDelete(b: Booking) {
    if (!confirm(`هل تريد حذف حجز "${b.client_name}"؟`)) return;
    await supabase.from('bookings').delete().eq('id', b.id);
    await logAction(user?.id, 'حذف حجز', 'bookings', b.id);
    toast.success('تم الحذف'); load();
  }

  async function handleStatusChange(b: Booking, s: BookingStatus) {
    await supabase.from('bookings').update({ status: s, updated_at: new Date().toISOString() }).eq('id', b.id);
    toast.success('تم تحديث الحالة'); load();
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">الحجوزات</h1>
          {upcoming > 0 && <p className="text-sm text-blue-400 mt-0.5">{upcoming} حجز قادم</p>}
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> حجز جديد</button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الحدث..."
            className="w-full bg-card border border-border rounded-lg pr-9 pl-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
          <option value="">كل الحالات</option>
          {BOOKING_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">العميل</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">نوع الحدث</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">التاريخ والوقت</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">السعر</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">المقدم</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">المتبقي</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">الحالة</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="text-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" /></td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">لا توجد حجوزات</td></tr>}
            {filtered.map(b => {
              const rem = Math.max(0, b.agreed_price - b.deposit_paid);
              const isUpcoming = b.booking_date >= today && b.status !== 'ملغي';
              return (
                <tr key={b.id} className={`table-row ${isUpcoming ? 'bg-blue-500/5' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{b.client_name}</p>
                    <p className="text-xs text-muted-foreground" dir="ltr">{b.client_mobile}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{b.event_type}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{formatDate(b.booking_date)}</p>
                    <p className="text-xs text-muted-foreground">{b.booking_time}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold">{formatCurrency(b.agreed_price)}</td>
                  <td className="px-4 py-3 text-green-400">{formatCurrency(b.deposit_paid)}</td>
                  <td className="px-4 py-3">
                    <span className={rem > 0 ? 'text-amber-400 font-semibold' : 'text-muted-foreground'}>{formatCurrency(rem)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <select value={b.status} onChange={e => handleStatusChange(b, e.target.value as BookingStatus)}
                      className={`text-xs rounded-md px-2 py-1 border font-medium bg-transparent focus:outline-none ${STATUS_COLORS[b.status] ?? ''}`}>
                      {BOOKING_STATUSES.map(s => <option key={s} value={s} className="bg-card text-foreground">{s}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => openEdit(b)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(b)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
            <h2 className="text-lg font-bold mb-5">{editing ? 'تعديل الحجز' : 'حجز جديد'}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="form-label">اسم العميل *</label>
                <input value={form.client_name ?? ''} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} placeholder="الاسم الكامل"
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="form-label">رقم الهاتف *</label>
                <input value={form.client_mobile ?? ''} onChange={e => setForm(f => ({ ...f, client_mobile: e.target.value }))} dir="ltr"
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="form-label">نوع الحدث *</label>
                <select value={form.event_type} onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                  {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">تاريخ الحجز *</label>
                <input type="date" value={form.booking_date ?? ''} onChange={e => setForm(f => ({ ...f, booking_date: e.target.value }))}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="form-label">الوقت *</label>
                <input type="time" value={form.booking_time ?? '10:00'} onChange={e => setForm(f => ({ ...f, booking_time: e.target.value }))}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="form-label">السعر المتفق عليه (ج.م)</label>
                <input type="number" value={form.agreed_price ?? 0} min={0} onChange={e => setForm(f => ({ ...f, agreed_price: parseFloat(e.target.value) || 0 }))} dir="ltr"
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="form-label">الدفعة المقدمة (ج.م)</label>
                <input type="number" value={form.deposit_paid ?? 0} min={0} onChange={e => setForm(f => ({ ...f, deposit_paid: parseFloat(e.target.value) || 0 }))} dir="ltr"
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="form-label">الحالة</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as BookingStatus }))}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                  {BOOKING_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-2 bg-muted/30 rounded-lg p-3 text-sm flex justify-between">
                <span className="text-muted-foreground">المتبقي</span>
                <span className={`font-bold ${remaining > 0 ? 'text-amber-400' : 'text-green-400'}`}>{formatCurrency(remaining)}</span>
              </div>
              <div className="col-span-2">
                <label className="form-label">ملاحظات</label>
                <textarea value={form.notes ?? ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50" />
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
