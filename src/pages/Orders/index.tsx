import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Filter, Download, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate, downloadCSV } from '@/lib/utils';
import { STATUS_COLORS, ORDER_STATUSES } from '@/lib/constants';
import { Order } from '@/types';

const PAGE_SIZE = 10;

export default function OrdersList() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => { setPage(1); }, [search, statusFilter]);
  useEffect(() => { loadOrders(); }, [search, statusFilter, page]);

  async function loadOrders() {
    setLoading(true);
    let q = supabase.from('orders').select('*, client:clients(name)', { count: 'exact' });
    if (statusFilter) q = q.eq('status', statusFilter);
    if (search) q = q.or(`order_number.ilike.%${search}%`);
    q = q.order('created_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    const { data, count } = await q;

    if (search && data) {
      // also try to find by client name
      const { data: byClient } = await supabase.from('orders')
        .select('*, client:clients!inner(name)')
        .ilike('clients.name', `%${search}%`)
        .order('created_at', { ascending: false }).limit(50);
      const merged = [...(data ?? [])];
      (byClient ?? []).forEach((o: Order) => { if (!merged.find(x => x.id === o.id)) merged.push(o); });
      setOrders(merged.slice(0, PAGE_SIZE));
    } else {
      setOrders(data ?? []);
    }
    setTotal(count ?? 0);
    setLoading(false);
  }

  function handleExport() {
    downloadCSV(orders.map(o => ({
      'رقم الطلب': o.order_number,
      'العميل': (o as any).client?.name ?? '',
      'تاريخ الطلب': formatDate(o.order_date),
      'تاريخ التسليم': formatDate(o.delivery_date),
      'الإجمالي': o.total,
      'المدفوع': o.total_paid,
      'المتبقي': o.remaining,
      'الحالة': o.status,
    })), 'الطلبات.csv');
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="page-title">الطلبات</h1>
        <Link to="/orders/new" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> طلب جديد
        </Link>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالرقم أو اسم العميل..."
            className="w-full bg-card border border-border rounded-lg pr-9 pl-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 min-w-[140px]">
          <option value="">كل الحالات</option>
          {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">
          <Download className="w-4 h-4" /> تصدير
        </button>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">رقم الطلب</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">العميل</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">تاريخ الطلب</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">تاريخ التسليم</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">الإجمالي</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">المدفوع</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">المتبقي</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">الحالة</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="text-center py-10 text-muted-foreground">جارٍ التحميل...</td></tr>}
            {!loading && orders.length === 0 && <tr><td colSpan={9} className="text-center py-10 text-muted-foreground">لا توجد طلبات</td></tr>}
            {orders.map(o => (
              <tr key={o.id} className="table-row">
                <td className="px-4 py-3 font-mono text-primary font-semibold">{o.order_number}</td>
                <td className="px-4 py-3 font-medium">{(o as any).client?.name ?? <span className="text-muted-foreground">—</span>}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(o.order_date)}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(o.delivery_date)}</td>
                <td className="px-4 py-3 font-semibold">{formatCurrency(o.total)}</td>
                <td className="px-4 py-3 text-green-400">{formatCurrency(o.total_paid)}</td>
                <td className="px-4 py-3">
                  <span className={o.remaining > 0 ? 'text-amber-400 font-semibold' : 'text-muted-foreground'}>{formatCurrency(o.remaining)}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`status-badge border ${STATUS_COLORS[o.status] ?? ''}`}>{o.status}</span>
                </td>
                <td className="px-4 py-3">
                  <Link to={`/orders/${o.id}`} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors inline-flex">
                    <Eye className="w-3.5 h-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-sm text-muted-foreground">{total} طلب • الصفحة {page} من {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-muted/50 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-muted/50 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
