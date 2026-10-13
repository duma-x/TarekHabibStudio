import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Users, TrendingUp, AlertTriangle, CalendarDays, Plus, CreditCard, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatCurrency, formatDate, getCurrentMonthRange } from '@/lib/utils';
import { STATUS_COLORS, ARABIC_MONTHS } from '@/lib/constants';
import { Order, Product, Booking } from '@/types';

interface Stats {
  new: number; inProgress: number; ready: number; delivered: number;
  totalValue: number; totalCollected: number; totalOutstanding: number;
  upcomingBookings: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [lowStock, setLowStock] = useState<Product[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [goalProgress, setGoalProgress] = useState<{ goal: number; collected: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadDashboard(); }, []);

  async function loadDashboard() {
    setLoading(true);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const { start: monthStart, end: monthEnd } = getCurrentMonthRange();

    const [ordersRes, recentRes, stockRes, bookingsRes, goalRes, paymentsRes] = await Promise.all([
      supabase.from('orders').select('status, total, total_paid, remaining').neq('status', 'ملغي'),
      supabase.from('orders').select('*, client:clients(name)').order('created_at', { ascending: false }).limit(6),
      supabase.from('products').select('*').lte('quantity', supabase.rpc ? 0 : 999).order('quantity', { ascending: true }).limit(10),
      supabase.from('bookings').select('*').gte('booking_date', todayStr).neq('status', 'ملغي').order('booking_date', { ascending: true }).limit(5),
      supabase.from('financial_goals').select('*').eq('goal_type', 'monthly').eq('year', now.getFullYear()).eq('month', now.getMonth() + 1).maybeSingle(),
      supabase.from('payments').select('amount').gte('payment_date', monthStart).lte('payment_date', monthEnd),
    ]);

    if (ordersRes.data) {
      const orders = ordersRes.data;
      setStats({
        new: orders.filter(o => o.status === 'جديد').length,
        inProgress: orders.filter(o => o.status === 'قيد التنفيذ').length,
        ready: orders.filter(o => o.status === 'جاهز').length,
        delivered: orders.filter(o => o.status === 'تم التسليم').length,
        totalValue: orders.reduce((s, o) => s + Number(o.total), 0),
        totalCollected: orders.reduce((s, o) => s + Number(o.total_paid), 0),
        totalOutstanding: orders.reduce((s, o) => s + Number(o.remaining), 0),
        upcomingBookings: (bookingsRes.data ?? []).length,
      });
    }

    // Low stock: products where quantity <= threshold
    const allProducts = stockRes.data ?? [];
    const lowStockProducts = allProducts.filter((p: Product) => p.quantity <= p.low_stock_threshold);
    setLowStock(lowStockProducts.slice(0, 5));
    setRecentOrders(recentRes.data ?? []);
    setUpcomingBookings(bookingsRes.data ?? []);

    if (goalRes.data) {
      const monthCollected = (paymentsRes.data ?? []).reduce((s: number, p: { amount: number }) => s + Number(p.amount), 0);
      setGoalProgress({ goal: Number(goalRes.data.goal_amount), collected: monthCollected });
    }

    setLoading(false);
  }

  const month = ARABIC_MONTHS[new Date().getMonth()];
  const year = new Date().getFullYear();

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">لوحة التحكم</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{month} {year}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/orders/new" className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> طلب جديد
          </Link>
          <Link to="/bookings" className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors flex items-center gap-2">
            <CalendarDays className="w-4 h-4" /> حجز جديد
          </Link>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'طلبات جديدة', value: stats?.new ?? 0, icon: ShoppingCart, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'قيد التنفيذ', value: stats?.inProgress ?? 0, icon: TrendingUp, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: 'جاهزة للتسليم', value: stats?.ready ?? 0, icon: ShoppingCart, color: 'text-purple-400', bg: 'bg-purple-500/10' },
          { label: 'تم التسليم', value: stats?.delivered ?? 0, icon: Users, color: 'text-green-400', bg: 'bg-green-500/10' },
        ].map(item => (
          <div key={item.label} className="stat-card flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center flex-shrink-0`}>
              <item.icon className={`w-5 h-5 ${item.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold">{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Financial Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-1">إجمالي قيمة الطلبات</p>
          <p className="text-xl font-bold text-foreground">{formatCurrency(stats?.totalValue)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-1">المدفوعات المحصّلة</p>
          <p className="text-xl font-bold text-green-400">{formatCurrency(stats?.totalCollected)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground mb-1">الأرصدة المستحقة</p>
          <p className="text-xl font-bold text-amber-400">{formatCurrency(stats?.totalOutstanding)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Orders */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-semibold">آخر الطلبات</h2>
            <Link to="/orders" className="text-sm text-primary hover:underline">عرض الكل</Link>
          </div>
          <div className="divide-y divide-border">
            {recentOrders.length === 0 && (
              <p className="text-center text-muted-foreground py-8 text-sm">لا توجد طلبات بعد</p>
            )}
            {recentOrders.map(order => (
              <Link key={order.id} to={`/orders/${order.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-primary">{order.order_number}</span>
                  <span className="text-sm text-muted-foreground">{(order as any).client?.name ?? 'عميل محذوف'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{formatCurrency(order.total)}</span>
                  <span className={`status-badge border ${STATUS_COLORS[order.status] ?? ''}`}>{order.status}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Monthly Goal */}
          {goalProgress && (
            <div className="stat-card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">تقدم الهدف الشهري</h3>
                <Link to="/goals" className="text-xs text-primary hover:underline">تفاصيل</Link>
              </div>
              <div className="mb-2">
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span>{formatCurrency(goalProgress.collected)}</span>
                  <span>{formatCurrency(goalProgress.goal)}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${Math.min(100, (goalProgress.collected / goalProgress.goal) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {Math.round((goalProgress.collected / goalProgress.goal) * 100)}% من الهدف
                </p>
              </div>
            </div>
          )}

          {/* Low Stock */}
          {lowStock.length > 0 && (
            <div className="stat-card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  تنبيهات المخزون
                </h3>
                <Link to="/products" className="text-xs text-primary hover:underline">عرض الكل</Link>
              </div>
              <div className="space-y-2">
                {lowStock.map(p => (
                  <div key={p.id} className="flex items-center justify-between">
                    <span className="text-sm truncate">{p.name}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${p.quantity === 0 ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}`}>
                      {p.quantity === 0 ? 'نفد' : `${p.quantity} متبقي`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Bookings */}
          {upcomingBookings.length > 0 && (
            <div className="stat-card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-blue-400" />
                  الحجوزات القادمة
                </h3>
                <Link to="/bookings" className="text-xs text-primary hover:underline">عرض الكل</Link>
              </div>
              <div className="space-y-2">
                {upcomingBookings.slice(0, 3).map(b => (
                  <div key={b.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{b.client_name}</p>
                      <p className="text-xs text-muted-foreground">{b.event_type}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(b.booking_date)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
