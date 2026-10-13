import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Edit2, X, Plus, Loader2, Trash2, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { logAction } from '@/lib/auditLog';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { STATUS_COLORS, PAYMENT_METHODS } from '@/lib/constants';
import { Order, Payment, PaymentMethod } from '@/types';
import { toast } from 'sonner';

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('نقدي');
  const [payNote, setPayNote] = useState('');
  const [savingPay, setSavingPay] = useState(false);

  useEffect(() => { loadOrder(); }, [id]);

  async function loadOrder() {
    setLoading(true);
    const { data } = await supabase.from('orders').select('*, client:clients(*), order_lines(*)').eq('id', id).single();
    if (!data) { toast.error('الطلب غير موجود'); navigate('/orders'); return; }
    setOrder(data);
    const { data: pays } = await supabase.from('payments').select('*').eq('order_id', id).order('created_at', { ascending: false });
    setPayments(pays ?? []);
    setLoading(false);
  }

  async function handleAddPayment() {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) { toast.error('يرجى إدخال مبلغ صحيح'); return; }
    if (!order) return;
    if (amount > order.remaining + 0.001) { toast.error(`المبلغ (${formatCurrency(amount)}) أكبر من المتبقي (${formatCurrency(order.remaining)})`); return; }
    setSavingPay(true);
    const { error } = await supabase.from('payments').insert({
      order_id: order.id, amount, payment_date: payDate, payment_method: payMethod,
      note: payNote || null, recorded_by: user?.id,
    });
    if (error) { toast.error('فشل تسجيل الدفعة'); setSavingPay(false); return; }
    const newPaid = Math.round((order.total_paid + amount) * 100) / 100;
    const newRemaining = Math.round((order.total - newPaid) * 100) / 100;
    await supabase.from('orders').update({ total_paid: newPaid, remaining: newRemaining, updated_at: new Date().toISOString() }).eq('id', order.id);
    await logAction(user?.id, 'إضافة دفعة', 'payments', order.id, { amount, method: payMethod });
    toast.success('تم تسجيل الدفعة بنجاح');
    setSavingPay(false); setShowAddPayment(false); setPayAmount(''); setPayNote('');
    loadOrder();
  }

  async function handleDeletePayment(pay: Payment) {
    if (!order) return;
    if (!confirm(`هل تريد حذف الدفعة بمبلغ ${formatCurrency(pay.amount)}؟`)) return;
    await supabase.from('payments').delete().eq('id', pay.id);
    const newPaid = Math.max(0, Math.round((order.total_paid - pay.amount) * 100) / 100);
    const newRemaining = Math.round((order.total - newPaid) * 100) / 100;
    await supabase.from('orders').update({ total_paid: newPaid, remaining: newRemaining, updated_at: new Date().toISOString() }).eq('id', order.id);
    await logAction(user?.id, 'حذف دفعة', 'payments', order.id, { amount: pay.amount });
    toast.success('تم حذف الدفعة');
    loadOrder();
  }

  async function handleCancel() {
    if (!order) return;
    if (!confirm('هل تريد إلغاء هذا الطلب؟ سيتم إرجاع المخزون المحجوز.')) return;
    // Restore stock if deducted
    if (order.stock_deducted && order.order_lines) {
      const productLines = order.order_lines.filter(l => l.item_type === 'product');
      for (const l of productLines) {
        if (!l.item_id) continue;
        const { data: prod } = await supabase.from('products').select('quantity').eq('id', l.item_id).single();
        if (prod) {
          await supabase.from('products').update({ quantity: prod.quantity + l.quantity, updated_at: new Date().toISOString() }).eq('id', l.item_id);
          await supabase.from('inventory_movements').insert({ product_id: l.item_id, movement_type: 'return', quantity: l.quantity, reason: `إلغاء طلب ${order.order_number}`, order_id: order.id, performed_by: user?.id });
        }
      }
    }
    await supabase.from('orders').update({ status: 'ملغي', stock_deducted: false, updated_at: new Date().toISOString() }).eq('id', order.id);
    await logAction(user?.id, 'إلغاء طلب', 'orders', order.id, { order_number: order.order_number });
    toast.success('تم إلغاء الطلب وإرجاع المخزون');
    loadOrder();
  }

  async function handleStatusChange(newStatus: string) {
    if (!order) return;
    const needStock = newStatus !== 'جديد' && newStatus !== 'ملغي';
    if (needStock && !order.stock_deducted && order.order_lines) {
      const productLines = order.order_lines.filter(l => l.item_type === 'product');
      for (const l of productLines) {
        if (!l.item_id) continue;
        const { data: prod } = await supabase.from('products').select('quantity').eq('id', l.item_id).single();
        if (prod && prod.quantity < l.quantity) {
          toast.error(`المخزون غير كافٍ للمنتج المرتبط بهذا الطلب`);
          return;
        }
      }
      for (const l of productLines) {
        if (!l.item_id) continue;
        const { data: prod } = await supabase.from('products').select('quantity').eq('id', l.item_id).single();
        if (prod) {
          await supabase.from('products').update({ quantity: prod.quantity - l.quantity, updated_at: new Date().toISOString() }).eq('id', l.item_id);
          await supabase.from('inventory_movements').insert({ product_id: l.item_id, movement_type: 'out', quantity: l.quantity, reason: `تحديث حالة طلب ${order.order_number}`, order_id: order.id, performed_by: user?.id });
        }
      }
      await supabase.from('orders').update({ status: newStatus, stock_deducted: true, updated_at: new Date().toISOString() }).eq('id', order.id);
    } else {
      await supabase.from('orders').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', order.id);
    }
    await logAction(user?.id, 'تغيير حالة طلب', 'orders', order.id, { from: order.status, to: newStatus });
    toast.success('تم تحديث حالة الطلب');
    loadOrder();
  }

  if (loading) return <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (!order) return null;

  return (
    <div className="space-y-5 animate-fade-in max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to="/orders" className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            <ArrowRight className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold">{order.order_number}</h1>
              <span className={`status-badge border ${STATUS_COLORS[order.status] ?? ''}`}>{order.status}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">{(order as any).client?.name ?? 'عميل محذوف'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {order.status !== 'ملغي' && order.status !== 'تم التسليم' && (
            <Link to={`/orders/${order.id}/edit`} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
              <Edit2 className="w-3.5 h-3.5" /> تعديل
            </Link>
          )}
          {order.status !== 'ملغي' && (
            <button onClick={handleCancel} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/30 text-sm text-red-400 hover:bg-red-500/10 transition-colors">
              <X className="w-3.5 h-3.5" /> إلغاء
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left */}
        <div className="lg:col-span-2 space-y-5">
          {/* Info */}
          <div className="bg-card rounded-xl border border-border p-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><p className="text-muted-foreground text-xs">تاريخ الطلب</p><p className="font-medium mt-1">{formatDate(order.order_date)}</p></div>
            <div><p className="text-muted-foreground text-xs">تاريخ التسليم</p><p className="font-medium mt-1">{formatDate(order.delivery_date)}</p></div>
            <div><p className="text-muted-foreground text-xs">رقم الهاتف</p><p className="font-medium mt-1" dir="ltr">{(order as any).client?.mobile ?? '—'}</p></div>
            <div>
              <p className="text-muted-foreground text-xs mb-1">تغيير الحالة</p>
              {order.status !== 'ملغي' && (
                <select value={order.status} onChange={e => handleStatusChange(e.target.value)}
                  className="w-full bg-muted border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50">
                  {['جديد', 'قيد التنفيذ', 'جاهز', 'تم التسليم'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* Order Lines */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border"><h3 className="font-semibold">عناصر الطلب</h3></div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">#</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">العنصر</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">الكمية</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">سعر الوحدة</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {(order.order_lines ?? []).map((l, i) => (
                  <tr key={l.id} className="border-b border-border/50">
                    <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-3 font-medium">{l.item_name}</td>
                    <td className="px-4 py-3 text-center">{l.quantity}</td>
                    <td className="px-4 py-3 text-center">{formatCurrency(l.unit_price)}</td>
                    <td className="px-4 py-3 text-center font-semibold">{formatCurrency(l.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="bg-card rounded-xl border border-border p-5">
              <p className="text-sm text-muted-foreground mb-1">ملاحظات</p>
              <p className="text-sm">{order.notes}</p>
            </div>
          )}

          {/* Payments */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-semibold">سجل المدفوعات</h3>
              {order.status !== 'ملغي' && order.remaining > 0 && (
                <button onClick={() => setShowAddPayment(!showAddPayment)}
                  className="flex items-center gap-1.5 text-sm text-primary hover:underline">
                  <Plus className="w-3.5 h-3.5" /> تسجيل دفعة
                </button>
              )}
            </div>

            {showAddPayment && (
              <div className="px-5 py-4 border-b border-border bg-muted/20">
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="form-label">المبلغ *</label>
                    <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0" min={0} max={order.remaining}
                      className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                    <p className="text-xs text-muted-foreground mt-1">الحد الأقصى: {formatCurrency(order.remaining)}</p>
                  </div>
                  <div>
                    <label className="form-label">تاريخ الدفع</label>
                    <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
                      className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  </div>
                  <div>
                    <label className="form-label">طريقة الدفع</label>
                    <select value={payMethod} onChange={e => setPayMethod(e.target.value as PaymentMethod)}
                      className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                      {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">ملاحظة</label>
                    <input value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="اختياري"
                      className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddPayment} disabled={savingPay} className="btn-primary flex items-center gap-2 py-2">
                    {savingPay && <Loader2 className="w-3.5 h-3.5 animate-spin" />} تسجيل
                  </button>
                  <button onClick={() => setShowAddPayment(false)} className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground">إلغاء</button>
                </div>
              </div>
            )}

            <div className="divide-y divide-border">
              {payments.length === 0 && <p className="text-center text-muted-foreground py-6 text-sm">لا توجد دفعات مسجلة</p>}
              {payments.map(p => (
                <div key={p.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-semibold text-green-400">{formatCurrency(p.amount)}</p>
                    <p className="text-xs text-muted-foreground">{p.payment_method} · {formatDate(p.payment_date)}{p.note ? ` · ${p.note}` : ''}</p>
                  </div>
                  <button onClick={() => handleDeletePayment(p)} className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-5 space-y-3 text-sm">
            <h3 className="font-semibold mb-2">ملخص مالي</h3>
            <div className="flex justify-between"><span className="text-muted-foreground">الإجمالي الفرعي</span><span>{formatCurrency(order.subtotal)}</span></div>
            {order.discount_percentage > 0 && (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">الخصم ({order.discount_percentage}%)</span><span className="text-amber-400">− {formatCurrency(order.discount_amount)}</span></div>
              </>
            )}
            <div className="border-t border-border pt-3 flex justify-between font-bold text-base">
              <span>الإجمالي النهائي</span><span className="text-primary">{formatCurrency(order.total)}</span>
            </div>
            <div className="flex justify-between text-green-400"><span className="text-muted-foreground">إجمالي المدفوع</span><span className="font-semibold">{formatCurrency(order.total_paid)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground font-semibold">المتبقي</span>
              <span className={`font-bold ${order.remaining > 0 ? 'text-amber-400' : 'text-green-400'}`}>{formatCurrency(order.remaining)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
