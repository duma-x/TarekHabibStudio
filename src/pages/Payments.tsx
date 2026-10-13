import { useEffect, useState } from 'react';
import { Search, Loader2, Trash2, Filter, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { logAction } from '@/lib/auditLog';
import { formatCurrency, formatDate, downloadCSV } from '@/lib/utils';
import { PAYMENT_METHODS } from '@/lib/constants';
import { Payment } from '@/types';
import { toast } from 'sonner';

export default function Payments() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<(Payment & { order?: { order_number: string; client?: { name: string } } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [totals, setTotals] = useState({ count: 0, amount: 0 });

  useEffect(() => { load(); }, [methodFilter, dateFrom, dateTo]);

  async function load() {
    setLoading(true);
    let q = supabase.from('payments').select('*, order:orders(order_number, client:clients(name))').order('created_at', { ascending: false });
    if (methodFilter) q = q.eq('payment_method', methodFilter);
    if (dateFrom) q = q.gte('payment_date', dateFrom);
    if (dateTo) q = q.lte('payment_date', dateTo);
    const { data } = await q.limit(200);
    const pays = data ?? [];
    setPayments(pays);
    setTotals({ count: pays.length, amount: pays.reduce((s: number, p: Payment) => s + Number(p.amount), 0) });
    setLoading(false);
  }

  const filtered = payments.filter(p =>
    !search ||
    (p.order as any)?.order_number?.includes(search) ||
    (p.order as any)?.client?.name?.toLowerCase().includes(search.toLowerCase())
  );

  async function handleDelete(p: Payment) {
    if (!confirm(`هل تريد حذف الدفعة بمبلغ ${formatCurrency(p.amount)}؟ سيتم تحديث رصيد الطلب.`)) return;
    await supabase.from('payments').delete().eq('id', p.id);
    const { data: order } = await supabase.from('orders').select('total_paid, total').eq('id', p.order_id).single();
    if (order) {
      const newPaid = Math.max(0, Math.round((order.total_paid - p.amount) * 100) / 100);
      const newRemaining = Math.round((order.total - newPaid) * 100) / 100;
      await supabase.from('orders').update({ total_paid: newPaid, remaining: newRemaining, updated_at: new Date().toISOString() }).eq('id', p.order_id);
    }
    await logAction(user?.id, 'حذف دفعة', 'payments', p.id, { amount: p.amount, order_id: p.order_id });
    toast.success('تم حذف الدفعة وتحديث الرصيد');
    load();
  }

  function handleExport() {
    downloadCSV(filtered.map(p => ({
      'رقم الطلب': (p.order as any)?.order_number ?? '',
      'العميل': (p.order as any)?.client?.name ?? '',
      'المبلغ': p.amount,
      'طريقة الدفع': p.payment_method,
      'تاريخ الدفع': formatDate(p.payment_date),
      'ملاحظة': p.note ?? '',
    })), 'المدفوعات.csv');
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="page-title">المدفوعات</h1>
        <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
          <Download className="w-4 h-4" /> تصدير
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-1">عدد الدفعات</p>
          <p className="text-2xl font-bold">{totals.count}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-1">إجمالي المحصّل</p>
          <p className="text-2xl font-bold text-green-400">{formatCurrency(totals.amount)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالرقم أو العميل..."
            className="w-full bg-card border border-border rounded-lg pr-9 pl-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <select value={methodFilter} onChange={e => setMethodFilter(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
          <option value="">كل طرق الدفع</option>
          {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder="من تاريخ"
          className="bg-card border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder="إلى تاريخ"
          className="bg-card border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        {(methodFilter || dateFrom || dateTo) && (
          <button onClick={() => { setMethodFilter(''); setDateFrom(''); setDateTo(''); }} className="text-sm text-red-400 hover:underline">مسح الفلاتر</button>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">رقم الطلب</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">العميل</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">المبلغ</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">طريقة الدفع</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">تاريخ الدفع</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">ملاحظة</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="text-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" /></td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">لا توجد دفعات</td></tr>}
            {filtered.map(p => (
              <tr key={p.id} className="table-row">
                <td className="px-4 py-3 font-mono text-primary">{(p.order as any)?.order_number ?? '—'}</td>
                <td className="px-4 py-3">{(p.order as any)?.client?.name ?? '—'}</td>
                <td className="px-4 py-3 font-bold text-green-400">{formatCurrency(p.amount)}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.payment_method}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(p.payment_date)}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{p.note ?? '—'}</td>
                <td className="px-4 py-3">
                  <button onClick={() => handleDelete(p)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
