import { useEffect, useState } from 'react';
import { Search, Loader2, ClipboardList } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDateTime } from '@/lib/utils';
import { AuditLog } from '@/types';

const ENTITY_LABELS: Record<string, string> = {
  clients: 'العملاء', orders: 'الطلبات', payments: 'المدفوعات',
  products: 'المنتجات', bookings: 'الحجوزات', employees: 'الموظفون',
  price_list_items: 'قائمة الأسعار', financial_goals: 'الأهداف',
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  useEffect(() => { load(); }, [entityFilter, page]);

  async function load() {
    setLoading(true);
    let q = supabase.from('audit_logs').select('*, user:user_profiles(username, email)').order('created_at', { ascending: false });
    if (entityFilter) q = q.eq('entity_type', entityFilter);
    q = q.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    const { data } = await q;
    setLogs(data ?? []);
    setLoading(false);
  }

  const filtered = logs.filter(l =>
    !search ||
    l.action.includes(search) ||
    (l.entity_id ?? '').includes(search) ||
    ((l as any).user?.username ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <h1 className="page-title">سجل العمليات</h1>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث في السجل..."
            className="w-full bg-card border border-border rounded-lg pr-9 pl-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <select value={entityFilter} onChange={e => { setEntityFilter(e.target.value); setPage(1); }}
          className="bg-card border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
          <option value="">كل الأقسام</option>
          {Object.entries(ENTITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading && <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>لا توجد عمليات مسجلة</p>
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">الإجراء</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">القسم</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">المستخدم</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">التاريخ والوقت</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(log => (
                <tr key={log.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{log.action}</td>
                  <td className="px-4 py-3 text-muted-foreground">{ENTITY_LABELS[log.entity_type] ?? log.entity_type}</td>
                  <td className="px-4 py-3 text-muted-foreground">{(log as any).user?.username ?? 'نظام'}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{formatDateTime(log.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 rounded-lg border border-border text-sm disabled:opacity-40 hover:bg-muted/50 transition-colors">السابق</button>
          <span className="text-sm text-muted-foreground">الصفحة {page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={logs.length < PAGE_SIZE}
            className="px-3 py-1.5 rounded-lg border border-border text-sm disabled:opacity-40 hover:bg-muted/50 transition-colors">التالي</button>
        </div>
      </div>
    </div>
  );
}
