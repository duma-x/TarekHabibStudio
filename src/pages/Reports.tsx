import { useEffect, useState } from 'react';
import { Download, Loader2, BarChart3 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate, downloadCSV, getCurrentMonthRange, getCurrentYearRange } from '@/lib/utils';
import { ARABIC_MONTHS } from '@/lib/constants';

type Period = 'today' | 'month' | 'year' | 'custom';

interface ReportData {
  ordersCount: number; ordersValue: number; discounts: number;
  collected: number; outstanding: number; canceledCount: number;
  paymentsByMethod: Record<string, number>;
  topClients: { name: string; orders: number; value: number }[];
  ordersByStatus: Record<string, number>;
}

export default function Reports() {
  const [period, setPeriod] = useState<Period>('month');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadReport(); }, [period, dateFrom, dateTo]);

  function getRange(): { start: string; end: string } {
    const today = new Date().toISOString().split('T')[0];
    if (period === 'today') return { start: today, end: today };
    if (period === 'month') return getCurrentMonthRange();
    if (period === 'year') return getCurrentYearRange();
    return { start: dateFrom || today, end: dateTo || today };
  }

  async function loadReport() {
    if (period === 'custom' && (!dateFrom || !dateTo)) return;
    setLoading(true);
    const { start, end } = getRange();

    const [ordersRes, paymentsRes] = await Promise.all([
      supabase.from('orders').select('*, client:clients(name), order_lines(*)').gte('order_date', start).lte('order_date', end),
      supabase.from('payments').select('amount, payment_method').gte('payment_date', start).lte('payment_date', end),
    ]);

    const orders = ordersRes.data ?? [];
    const pays = paymentsRes.data ?? [];
    const activeOrders = orders.filter((o: any) => o.status !== 'ملغي');
    const canceledOrders = orders.filter((o: any) => o.status === 'ملغي');

    const paysByMethod: Record<string, number> = {};
    pays.forEach((p: any) => { paysByMethod[p.payment_method] = (paysByMethod[p.payment_method] ?? 0) + Number(p.amount); });

    const clientMap: Record<string, { name: string; orders: number; value: number }> = {};
    activeOrders.forEach((o: any) => {
      const cId = o.client_id ?? 'unknown';
      const cName = o.client?.name ?? 'غير محدد';
      if (!clientMap[cId]) clientMap[cId] = { name: cName, orders: 0, value: 0 };
      clientMap[cId].orders++;
      clientMap[cId].value += Number(o.total);
    });

    const statusMap: Record<string, number> = {};
    orders.forEach((o: any) => { statusMap[o.status] = (statusMap[o.status] ?? 0) + 1; });

    setData({
      ordersCount: activeOrders.length,
      ordersValue: activeOrders.reduce((s: number, o: any) => s + Number(o.total), 0),
      discounts: activeOrders.reduce((s: number, o: any) => s + Number(o.discount_amount), 0),
      collected: pays.reduce((s: number, p: any) => s + Number(p.amount), 0),
      outstanding: activeOrders.reduce((s: number, o: any) => s + Number(o.remaining), 0),
      canceledCount: canceledOrders.length,
      paymentsByMethod: paysByMethod,
      topClients: Object.values(clientMap).sort((a, b) => b.orders - a.orders).slice(0, 10),
      ordersByStatus: statusMap,
    });
    setLoading(false);
  }

  function exportReport() {
    if (!data) return;
    downloadCSV([
      { 'المقياس': 'عدد الطلبات', 'القيمة': data.ordersCount },
      { 'المقياس': 'قيمة الطلبات', 'القيمة': data.ordersValue },
      { 'المقياس': 'الخصومات', 'القيمة': data.discounts },
      { 'المقياس': 'المحصّل', 'القيمة': data.collected },
      { 'المقياس': 'المستحق', 'القيمة': data.outstanding },
      { 'المقياس': 'طلبات ملغاة', 'القيمة': data.canceledCount },
    ], 'تقرير.csv');
  }

  const now = new Date();
  const periodLabel = period === 'today' ? 'اليوم' : period === 'month' ? `${ARABIC_MONTHS[now.getMonth()]} ${now.getFullYear()}` : period === 'year' ? `سنة ${now.getFullYear()}` : 'فترة مخصصة';

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">التقارير</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{periodLabel}</p>
        </div>
        <button onClick={exportReport} disabled={!data} className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors">
          <Download className="w-4 h-4" /> تصدير CSV
        </button>
      </div>

      {/* Period Selector */}
      <div className="flex gap-2 flex-wrap">
        {([['today', 'اليوم'], ['month', 'هذا الشهر'], ['year', 'هذا العام'], ['custom', 'فترة مخصصة']] as const).map(([v, l]) => (
          <button key={v} onClick={() => setPeriod(v)}
            className={`px-4 py-2 rounded-lg text-sm border transition-colors ${period === v ? 'bg-primary/15 text-primary border-primary/30 font-semibold' : 'border-border text-muted-foreground hover:text-foreground'}`}>
            {l}
          </button>
        ))}
        {period === 'custom' && (
          <div className="flex gap-2 items-center">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <span className="text-muted-foreground">إلى</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
        )}
      </div>

      {loading && <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}

      {!loading && data && (
        <div className="space-y-5">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { label: 'عدد الطلبات', value: data.ordersCount, isNum: true, color: '' },
              { label: 'قيمة الطلبات', value: formatCurrency(data.ordersValue), isNum: false, color: 'text-foreground' },
              { label: 'الخصومات', value: formatCurrency(data.discounts), isNum: false, color: 'text-amber-400' },
              { label: 'المحصّل فعلياً', value: formatCurrency(data.collected), isNum: false, color: 'text-green-400' },
              { label: 'الأرصدة المستحقة', value: formatCurrency(data.outstanding), isNum: false, color: 'text-amber-400' },
            ].map(item => (
              <div key={item.label} className="stat-card">
                <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                <p className={`text-xl font-bold ${item.color}`}>{item.isNum ? item.value : item.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Orders by Status */}
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="font-semibold mb-4">توزيع الطلبات حسب الحالة</h3>
              <div className="space-y-3">
                {Object.entries(data.ordersByStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <span className="text-sm">{status}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, (count / (data.ordersCount + data.canceledCount)) * 100)}%` }} />
                      </div>
                      <span className="text-sm font-semibold w-6 text-left">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payments by Method */}
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="font-semibold mb-4">المدفوعات حسب الطريقة</h3>
              <div className="space-y-3">
                {Object.entries(data.paymentsByMethod).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">لا توجد مدفوعات في هذه الفترة</p>
                )}
                {Object.entries(data.paymentsByMethod).map(([method, amount]) => (
                  <div key={method} className="flex items-center justify-between">
                    <span className="text-sm">{method}</span>
                    <span className="font-semibold text-green-400">{formatCurrency(amount)}</span>
                  </div>
                ))}
                {Object.keys(data.paymentsByMethod).length > 0 && (
                  <div className="border-t border-border pt-2 flex justify-between">
                    <span className="text-sm font-semibold">الإجمالي</span>
                    <span className="font-bold text-primary">{formatCurrency(data.collected)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Top Clients */}
          {data.topClients.length > 0 && (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="font-semibold">أكثر العملاء طلباً</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">#</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">العميل</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">عدد الطلبات</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">إجمالي القيمة</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topClients.map((c, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="px-4 py-3 text-muted-foreground font-bold">{i + 1}</td>
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3">{c.orders}</td>
                      <td className="px-4 py-3 font-semibold text-primary">{formatCurrency(c.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
