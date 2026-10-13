import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Plus, Trash2, Search, X, Loader2, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { logAction } from '@/lib/auditLog';
import { calcOrderTotals, formatCurrency, todayInputDate, normalizePhone } from '@/lib/utils';
import { ORDER_STATUSES, PAYMENT_METHODS } from '@/lib/constants';
import { Client, PriceListItem, Product, OrderLine, OrderStatus, PaymentMethod } from '@/types';
import { toast } from 'sonner';

interface LineItem extends OrderLine { _key: string; }

export default function OrderForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { user } = useAuth();

  const [clients, setClients] = useState<Client[]>([]);
  const [priceItems, setPriceItems] = useState<PriceListItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientSearch, setShowClientSearch] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [orderDate, setOrderDate] = useState(todayInputDate());
  const [deliveryDate, setDeliveryDate] = useState('');
  const [status, setStatus] = useState<OrderStatus>('جديد');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineItem[]>([]);
  const [discountPct, setDiscountPct] = useState(0);
  const [initPayment, setInitPayment] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('نقدي');
  const [showPriceList, setShowPriceList] = useState(false);
  const [showProducts, setShowProducts] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientMobile, setNewClientMobile] = useState('');
  const [saving, setSaving] = useState(false);
  const [oldStockDeducted, setOldStockDeducted] = useState(false);
  const [oldLines, setOldLines] = useState<OrderLine[]>([]);

  const { subtotal, discountAmount, total } = calcOrderTotals(lines, discountPct);
  const initPayNum = parseFloat(initPayment) || 0;
  const totalPaidCalc = isEdit ? 0 : initPayNum;
  const remainingCalc = total - totalPaidCalc;

  useEffect(() => {
    loadData();
    if (isEdit) loadOrder();
  }, [id]);

  async function loadData() {
    const [cl, pl, pr] = await Promise.all([
      supabase.from('clients').select('*').eq('is_archived', false).order('name'),
      supabase.from('price_list_items').select('*').eq('is_active', true).order('name'),
      supabase.from('products').select('*').order('name'),
    ]);
    setClients(cl.data ?? []);
    setPriceItems(pl.data ?? []);
    setProducts(pr.data ?? []);
  }

  async function loadOrder() {
    const { data: order } = await supabase.from('orders').select('*, client:clients(*), order_lines(*)').eq('id', id).single();
    if (!order) { toast.error('الطلب غير موجود'); navigate('/orders'); return; }
    setSelectedClient(order.client ?? null);
    setOrderDate(order.order_date);
    setDeliveryDate(order.delivery_date ?? '');
    setStatus(order.status);
    setNotes(order.notes ?? '');
    setDiscountPct(Number(order.discount_percentage));
    setOldStockDeducted(order.stock_deducted);
    const loadedLines: LineItem[] = (order.order_lines ?? []).map((l: OrderLine) => ({
      ...l, _key: l.id ?? Math.random().toString(),
    }));
    setLines(loadedLines);
    setOldLines(order.order_lines ?? []);
  }

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) || c.mobile.includes(clientSearch)
  );

  function addLineFromPrice(item: PriceListItem) {
    setLines(l => [...l, { _key: Date.now().toString(), item_type: 'price_list', item_id: item.id, item_name: item.name, quantity: 1, unit_price: item.price, subtotal: item.price }]);
    setShowPriceList(false);
  }

  function addLineFromProduct(p: Product) {
    if (p.quantity <= 0) { toast.error(`المنتج "${p.name}" غير متوفر في المخزون`); return; }
    setLines(l => [...l, { _key: Date.now().toString(), item_type: 'product', item_id: p.id, item_name: p.name, quantity: 1, unit_price: p.selling_price, subtotal: p.selling_price }]);
    setShowProducts(false);
  }

  function addCustomLine() {
    setLines(l => [...l, { _key: Date.now().toString(), item_type: 'custom', item_name: '', quantity: 1, unit_price: 0, subtotal: 0 }]);
  }

  function updateLine(key: string, field: keyof LineItem, value: string | number) {
    setLines(prev => prev.map(l => {
      if (l._key !== key) return l;
      const updated = { ...l, [field]: value };
      updated.subtotal = Number(updated.quantity) * Number(updated.unit_price);
      return updated;
    }));
  }

  function removeLine(key: string) { setLines(l => l.filter(x => x._key !== key)); }

  async function createNewClient() {
    if (!newClientName.trim() || !newClientMobile.trim()) { toast.error('يرجى إدخال الاسم والهاتف'); return; }
    const normalized = normalizePhone(newClientMobile.trim());
    const { data: ex } = await supabase.from('clients').select('id,name').eq('mobile_normalized', normalized).maybeSingle();
    if (ex) { toast.error(`رقم الهاتف مستخدم بالفعل: ${ex.name}`); return; }
    const { data, error } = await supabase.from('clients').insert({ name: newClientName.trim(), mobile: newClientMobile.trim(), mobile_normalized: normalized }).select().single();
    if (error) { toast.error('فشل إنشاء العميل'); return; }
    setSelectedClient(data); setClients(c => [...c, data]);
    setShowNewClient(false); setNewClientName(''); setNewClientMobile('');
    toast.success('تم إنشاء العميل');
  }

  async function handleSave(asDraft = false) {
    if (!selectedClient) { toast.error('يرجى اختيار عميل'); return; }
    if (lines.length === 0) { toast.error('يرجى إضافة عنصر واحد على الأقل'); return; }
    if (lines.some(l => !l.item_name.trim())) { toast.error('يرجى ملء اسم كل عنصر'); return; }
    if (lines.some(l => l.quantity <= 0)) { toast.error('الكميات يجب أن تكون أكبر من صفر'); return; }
    if (discountPct < 0 || discountPct > 100) { toast.error('نسبة الخصم يجب أن تكون بين 0 و 100'); return; }
    if (!isEdit && initPayNum > total) { toast.error('الدفعة الأولية أكبر من إجمالي الطلب'); return; }

    const finalStatus: OrderStatus = asDraft ? 'جديد' : status;

    // Stock validation
    const productLines = lines.filter(l => l.item_type === 'product');
    for (const pl of productLines) {
      const product = products.find(p => p.id === pl.item_id);
      if (!product) continue;
      let availableQty = product.quantity;
      if (isEdit && oldStockDeducted) {
        const oldLine = oldLines.find(ol => ol.item_id === pl.item_id && ol.item_type === 'product');
        if (oldLine) availableQty += oldLine.quantity;
      }
      if (finalStatus !== 'جديد' && finalStatus !== 'ملغي' && pl.quantity > availableQty) {
        toast.error(`الكمية المطلوبة من "${product.name}" (${pl.quantity}) تتجاوز المخزون المتاح (${availableQty})`);
        return;
      }
    }

    setSaving(true);

    const orderPayload = {
      client_id: selectedClient.id,
      order_date: orderDate,
      delivery_date: deliveryDate || null,
      status: finalStatus,
      subtotal, discount_percentage: discountPct, discount_amount: discountAmount, total,
      total_paid: isEdit ? undefined : initPayNum,
      remaining: isEdit ? undefined : total - initPayNum,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    };

    let orderId = id;
    let orderNumber = '';

    if (isEdit) {
      const { error } = await supabase.from('orders').update(orderPayload).eq('id', id);
      if (error) { toast.error('فشل تحديث الطلب: ' + error.message); setSaving(false); return; }

      // Delete old lines, insert new ones
      await supabase.from('order_lines').delete().eq('order_id', id);
      await supabase.from('order_lines').insert(lines.map(l => ({
        order_id: id, item_type: l.item_type, item_id: l.item_id ?? null,
        item_name: l.item_name, quantity: l.quantity, unit_price: l.unit_price, subtotal: l.subtotal,
      })));

      // Handle stock adjustments
      if (finalStatus !== 'جديد' && finalStatus !== 'ملغي') {
        const wasDeducted = oldStockDeducted;
        for (const pl of productLines) {
          const product = products.find(p => p.id === pl.item_id);
          if (!product) continue;
          const oldLine = oldLines.find(ol => ol.item_id === pl.item_id && ol.item_type === 'product');
          const oldQty = wasDeducted ? (oldLine?.quantity ?? 0) : 0;
          const diff = pl.quantity - oldQty;
          if (diff !== 0) {
            await supabase.from('products').update({ quantity: Math.max(0, product.quantity - diff), updated_at: new Date().toISOString() }).eq('id', product.id);
            await supabase.from('inventory_movements').insert({ product_id: product.id, movement_type: diff > 0 ? 'out' : 'return', quantity: Math.abs(diff), reason: `تعديل طلب ${orderId}`, order_id: orderId, performed_by: user?.id });
          }
        }
        if (!wasDeducted) await supabase.from('orders').update({ stock_deducted: true }).eq('id', id);
      }
      await logAction(user?.id, 'تعديل طلب', 'orders', id, { status: finalStatus });
      toast.success('تم تحديث الطلب');
    } else {
      // Generate order number
      const { data: seqData } = await supabase.rpc ? await supabase.rpc('nextval', { seq: 'order_number_seq' }).catch(() => ({ data: null })) : { data: null };
      const { data: lastOrder } = await supabase.from('orders').select('order_number').order('created_at', { ascending: false }).limit(1).maybeSingle();
      const lastNum = lastOrder ? parseInt(lastOrder.order_number.replace('#', '')) || 1000 : 1000;
      orderNumber = `#${lastNum + 1}`;

      const shouldDeductStock = finalStatus !== 'جديد' && finalStatus !== 'ملغي';
      const { data: newOrder, error } = await supabase.from('orders').insert({
        ...orderPayload,
        order_number: orderNumber,
        total_paid: initPayNum,
        remaining: total - initPayNum,
        stock_deducted: shouldDeductStock,
        created_by: user?.id,
      }).select().single();

      if (error) { toast.error('فشل إنشاء الطلب: ' + error.message); setSaving(false); return; }
      orderId = newOrder.id;

      await supabase.from('order_lines').insert(lines.map(l => ({
        order_id: orderId, item_type: l.item_type, item_id: l.item_id ?? null,
        item_name: l.item_name, quantity: l.quantity, unit_price: l.unit_price, subtotal: l.subtotal,
      })));

      if (initPayNum > 0) {
        await supabase.from('payments').insert({ order_id: orderId, amount: initPayNum, payment_date: orderDate, payment_method: payMethod, note: 'دفعة أولية', recorded_by: user?.id });
      }

      if (shouldDeductStock) {
        for (const pl of productLines) {
          const product = products.find(p => p.id === pl.item_id);
          if (!product) continue;
          await supabase.from('products').update({ quantity: Math.max(0, product.quantity - pl.quantity), updated_at: new Date().toISOString() }).eq('id', product.id);
          await supabase.from('inventory_movements').insert({ product_id: product.id, movement_type: 'out', quantity: pl.quantity, reason: `طلب جديد ${orderNumber}`, order_id: orderId, performed_by: user?.id });
        }
      }

      await logAction(user?.id, 'إنشاء طلب', 'orders', orderId, { order_number: orderNumber, status: finalStatus });
      toast.success(`تم إنشاء الطلب ${orderNumber}`);
    }

    setSaving(false);
    navigate(`/orders/${orderId}`);
  }

  return (
    <div className="space-y-5 animate-fade-in max-w-5xl">
      <div className="flex items-center gap-3">
        <Link to="/orders" className="text-muted-foreground hover:text-foreground text-sm">الطلبات</Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="page-title">{isEdit ? 'تعديل الطلب' : 'إنشاء طلب جديد'}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main */}
        <div className="lg:col-span-2 space-y-5">
          {/* Client & Dates */}
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Client */}
              <div className="col-span-2">
                <label className="form-label">العميل *</label>
                {selectedClient ? (
                  <div className="flex items-center justify-between bg-muted border border-border rounded-lg px-3 py-2.5">
                    <span className="font-medium">{selectedClient.name} — <span className="text-muted-foreground text-sm" dir="ltr">{selectedClient.mobile}</span></span>
                    <button onClick={() => { setSelectedClient(null); setShowClientSearch(true); }}>
                      <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input value={clientSearch} onChange={e => { setClientSearch(e.target.value); setShowClientSearch(true); }}
                        onFocus={() => setShowClientSearch(true)} placeholder="ابحث عن عميل..."
                        className="w-full bg-muted border border-border rounded-lg pr-9 pl-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary" />
                    </div>
                    {showClientSearch && (
                      <div className="bg-popover border border-border rounded-lg shadow-xl max-h-40 overflow-y-auto">
                        {filteredClients.slice(0, 8).map(c => (
                          <button key={c.id} onClick={() => { setSelectedClient(c); setClientSearch(''); setShowClientSearch(false); }}
                            className="w-full text-right px-3 py-2 text-sm hover:bg-muted/50 transition-colors flex justify-between">
                            <span>{c.name}</span>
                            <span className="text-muted-foreground" dir="ltr">{c.mobile}</span>
                          </button>
                        ))}
                        <button onClick={() => { setShowNewClient(true); setShowClientSearch(false); }}
                          className="w-full text-right px-3 py-2 text-sm text-primary hover:bg-primary/10 transition-colors flex items-center gap-2">
                          <Plus className="w-3.5 h-3.5" /> إضافة عميل جديد
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="form-label">تاريخ الطلب</label>
                <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="form-label">تاريخ التسليم المتوقع</label>
                <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
            </div>
          </div>

          {/* Order Lines */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-semibold mb-4">عناصر الطلب</h3>
            {lines.length > 0 && (
              <div className="mb-4 space-y-2">
                <div className="grid grid-cols-12 gap-2 text-xs text-muted-foreground px-1 mb-1">
                  <span className="col-span-5">العنصر</span>
                  <span className="col-span-2 text-center">الكمية</span>
                  <span className="col-span-2 text-center">سعر الوحدة</span>
                  <span className="col-span-2 text-center">الإجمالي</span>
                  <span className="col-span-1"></span>
                </div>
                {lines.map(l => (
                  <div key={l._key} className="grid grid-cols-12 gap-2 items-center bg-muted/30 rounded-lg px-2 py-2">
                    <input value={l.item_name} onChange={e => updateLine(l._key, 'item_name', e.target.value)}
                      placeholder="اسم العنصر" readOnly={l.item_type !== 'custom'}
                      className={`col-span-5 bg-transparent border-0 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 rounded px-2 py-1 ${l.item_type !== 'custom' ? 'text-foreground cursor-default' : 'bg-muted/50'}`} />
                    <div className="col-span-2 flex items-center justify-center gap-1">
                      <button onClick={() => updateLine(l._key, 'quantity', Math.max(1, l.quantity - 1))}
                        className="w-6 h-6 rounded bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center text-xs">−</button>
                      <input type="number" value={l.quantity} min={1}
                        onChange={e => updateLine(l._key, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-10 bg-transparent text-center text-sm focus:outline-none" />
                      <button onClick={() => updateLine(l._key, 'quantity', l.quantity + 1)}
                        className="w-6 h-6 rounded bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center text-xs">+</button>
                    </div>
                    <input type="number" value={l.unit_price} min={0}
                      onChange={e => updateLine(l._key, 'unit_price', parseFloat(e.target.value) || 0)}
                      className="col-span-2 bg-transparent text-center text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 rounded px-2 py-1" />
                    <span className="col-span-2 text-center text-sm font-medium">{formatCurrency(l.subtotal)}</span>
                    <button onClick={() => removeLine(l._key)} className="col-span-1 flex justify-center text-muted-foreground hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {lines.length === 0 && (
              <div className="text-center py-6 text-muted-foreground text-sm border border-dashed border-border rounded-lg mb-4">
                لم يتم إضافة أي عناصر بعد
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setShowPriceList(!showPriceList)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-primary/30 text-primary text-sm hover:bg-primary/10 transition-colors">
                <Plus className="w-3.5 h-3.5" /> إضافة من قائمة الأسعار
              </button>
              <button onClick={() => setShowProducts(!showProducts)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-muted-foreground text-sm hover:text-foreground hover:border-border transition-colors">
                <Plus className="w-3.5 h-3.5" /> إضافة منتج من المخزون
              </button>
              <button onClick={addCustomLine}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-muted-foreground text-sm hover:text-foreground transition-colors">
                <Plus className="w-3.5 h-3.5" /> عنصر مخصص
              </button>
            </div>

            {/* Price list picker */}
            {showPriceList && (
              <div className="mt-3 bg-muted/30 border border-border rounded-lg p-3 max-h-48 overflow-y-auto">
                {priceItems.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">لا توجد عناصر في قائمة الأسعار</p>}
                {priceItems.map(item => (
                  <button key={item.id} onClick={() => addLineFromPrice(item)}
                    className="w-full text-right px-3 py-2 text-sm hover:bg-muted/50 rounded-lg transition-colors flex justify-between">
                    <span>{item.name}</span>
                    <span className="text-primary font-medium">{formatCurrency(item.price)}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Products picker */}
            {showProducts && (
              <div className="mt-3 bg-muted/30 border border-border rounded-lg p-3 max-h-48 overflow-y-auto">
                {products.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">لا توجد منتجات</p>}
                {products.map(p => (
                  <button key={p.id} onClick={() => addLineFromProduct(p)}
                    className={`w-full text-right px-3 py-2 text-sm hover:bg-muted/50 rounded-lg transition-colors flex justify-between ${p.quantity <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <span>{p.name}</span>
                    <span className="flex items-center gap-3">
                      <span className={`text-xs ${p.quantity <= p.low_stock_threshold ? 'text-amber-400' : 'text-muted-foreground'}`}>المخزون: {p.quantity}</span>
                      <span className="text-primary font-medium">{formatCurrency(p.selling_price)}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Status */}
          <div className="bg-card rounded-xl border border-border p-5">
            <label className="form-label">حالة الطلب *</label>
            <select value={status} onChange={e => setStatus(e.target.value as OrderStatus)}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
              {ORDER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Summary */}
          <div className="bg-card rounded-xl border border-border p-5 space-y-3">
            <h3 className="font-semibold">ملخص الطلب</h3>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">الإجمالي الفرعي</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-sm">الخصم (%)</span>
              <input type="number" value={discountPct} min={0} max={100} onChange={e => setDiscountPct(parseFloat(e.target.value) || 0)}
                className="w-20 bg-muted border border-border rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">قيمة الخصم</span><span className="text-amber-400">− {formatCurrency(discountAmount)}</span></div>
            <div className="border-t border-border pt-3 flex justify-between font-bold">
              <span>الإجمالي النهائي</span><span className="text-primary text-lg">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Initial Payment (create only) */}
          {!isEdit && (
            <div className="bg-card rounded-xl border border-border p-5 space-y-3">
              <h3 className="font-semibold">تفاصيل الدفع</h3>
              <div>
                <label className="form-label">المبلغ المدفوع الآن</label>
                <input type="number" value={initPayment} min={0} onChange={e => setInitPayment(e.target.value)}
                  placeholder="0" className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="form-label">طريقة الدفع</label>
                <select value={payMethod} onChange={e => setPayMethod(e.target.value as PaymentMethod)}
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="border-t border-border pt-3 space-y-1.5">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">إجمالي مدفوع</span><span className="text-green-400">{formatCurrency(initPayNum)}</span></div>
                <div className="flex justify-between text-sm font-semibold"><span className="text-muted-foreground">المتبقي</span><span className="text-amber-400">{formatCurrency(Math.max(0, remainingCalc))}</span></div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="bg-card rounded-xl border border-border p-5">
            <label className="form-label">ملاحظات (اختياري)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} maxLength={300}
              placeholder="اكتب ملاحظة حول الطلب..."
              className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <p className="text-xs text-muted-foreground text-left mt-1">{notes.length} / 300</p>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <button onClick={() => handleSave(false)} disabled={saving}
              className="w-full btn-primary flex items-center justify-center gap-2 py-3">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? 'حفظ التعديلات' : 'إنشاء الطلب'}
            </button>
            {!isEdit && (
              <button onClick={() => handleSave(true)} disabled={saving}
                className="w-full px-4 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
                حفظ كمسودة
              </button>
            )}
            <Link to="/orders" className="block w-full text-center px-4 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors">
              إلغاء
            </Link>
          </div>
        </div>
      </div>

      {/* New Client Dialog */}
      {showNewClient && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm">
            <h3 className="font-bold mb-4">إضافة عميل جديد</h3>
            <div className="space-y-3">
              <input value={newClientName} onChange={e => setNewClientName(e.target.value)} placeholder="اسم العميل"
                className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              <input value={newClientMobile} onChange={e => setNewClientMobile(e.target.value)} placeholder="01xxxxxxxxx" dir="ltr"
                className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={createNewClient} className="btn-primary flex-1 py-2.5">إضافة</button>
              <button onClick={() => setShowNewClient(false)} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm text-muted-foreground">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
