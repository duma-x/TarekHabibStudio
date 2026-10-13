import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Loader2, Target } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { logAction } from '@/lib/auditLog';
import { formatCurrency, getCurrentMonthRange, getCurrentYearRange } from '@/lib/utils';
import { ARABIC_MONTHS } from '@/lib/constants';
import { FinancialGoal } from '@/types';
import { toast } from 'sonner';

interface GoalWithProgress extends FinancialGoal { collected: number; }

export default function Goals() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<GoalWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FinancialGoal | null>(null);
  const [goalType, setGoalType] = useState<'monthly' | 'annual'>('monthly');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data: goalsData } = await supabase.from('financial_goals').select('*').order('year', { ascending: false }).order('month', { ascending: false });
    if (!goalsData) { setLoading(false); return; }

    const withProgress = await Promise.all(goalsData.map(async (g: FinancialGoal) => {
      let start: string, end: string;
      if (g.goal_type === 'monthly' && g.month) {
        const d = new Date(g.year, g.month - 1, 1);
        start = new Date(g.year, g.month - 1, 1).toISOString().split('T')[0];
        end = new Date(g.year, g.month, 0).toISOString().split('T')[0];
      } else {
        start = `${g.year}-01-01`;
        end = `${g.year}-12-31`;
      }
      const { data: pays } = await supabase.from('payments').select('amount').gte('payment_date', start).lte('payment_date', end);
      const collected = (pays ?? []).reduce((s: number, p: { amount: number }) => s + Number(p.amount), 0);
      return { ...g, collected };
    }));
    setGoals(withProgress);
    setLoading(false);
  }

  function openCreate() {
    setEditing(null); setGoalType('monthly'); setYear(new Date().getFullYear());
    setMonth(new Date().getMonth() + 1); setAmount(''); setShowForm(true);
  }

  function openEdit(g: FinancialGoal) {
    setEditing(g); setGoalType(g.goal_type); setYear(g.year);
    setMonth(g.month ?? 1); setAmount(String(g.goal_amount)); setShowForm(true);
  }

  async function handleSave() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error('يرجى إدخال مبلغ هدف صحيح'); return; }
    setSaving(true);
    const payload: Partial<FinancialGoal> = {
      goal_type: goalType, year,
      month: goalType === 'monthly' ? month : null as any,
      goal_amount: amt, updated_at: new Date().toISOString() as any,
    };
    if (editing) {
      const { error } = await supabase.from('financial_goals').update(payload).eq('id', editing.id);
      if (error) { toast.error(error.code === '23505' ? 'يوجد هدف مسجل لهذه الفترة بالفعل' : 'فشل التحديث'); setSaving(false); return; }
      await logAction(user?.id, 'تعديل هدف مالي', 'financial_goals', editing.id);
      toast.success('تم التحديث');
    } else {
      const { error } = await supabase.from('financial_goals').insert({ ...payload, created_by: user?.id });
      if (error) { toast.error(error.code === '23505' ? 'يوجد هدف مسجل لهذه الفترة بالفعل' : 'فشل الإضافة'); setSaving(false); return; }
      await logAction(user?.id, 'إضافة هدف مالي', 'financial_goals');
      toast.success('تمت الإضافة');
    }
    setSaving(false); setShowForm(false); load();
  }

  async function handleDelete(g: FinancialGoal) {
    if (!confirm('هل تريد حذف هذا الهدف؟')) return;
    await supabase.from('financial_goals').delete().eq('id', g.id);
    toast.success('تم الحذف'); load();
  }

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="page-title">الأهداف المالية</h1>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> إضافة هدف</button>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      )}

      {!loading && goals.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Target className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>لا توجد أهداف مالية. أضف هدفاً لتتبع تقدمك.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {goals.map(g => {
          const pct = g.goal_amount > 0 ? Math.min(100, Math.round((g.collected / g.goal_amount) * 100)) : 0;
          const remaining = Math.max(0, g.goal_amount - g.collected);
          const label = g.goal_type === 'monthly'
            ? `${ARABIC_MONTHS[(g.month ?? 1) - 1]} ${g.year}`
            : `هدف سنوي ${g.year}`;
          return (
            <div key={g.id} className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold">{label}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{g.goal_type === 'monthly' ? 'هدف شهري' : 'هدف سنوي'}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(g)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(g)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-muted-foreground mb-2">
                  <span>المحصّل: {formatCurrency(g.collected)}</span>
                  <span>الهدف: {formatCurrency(g.goal_amount)}</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : pct >= 70 ? 'bg-primary' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className={`text-xl font-bold ${pct >= 100 ? 'text-green-400' : 'text-primary'}`}>{pct}%</span>
                  <span className="text-sm text-muted-foreground">
                    {pct >= 100 ? '✓ تم تحقيق الهدف!' : `المتبقي: ${formatCurrency(remaining)}`}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-bold mb-5">{editing ? 'تعديل الهدف' : 'إضافة هدف مالي جديد'}</h2>
            <div className="space-y-4">
              <div>
                <label className="form-label">نوع الهدف</label>
                <div className="flex gap-2">
                  <button onClick={() => setGoalType('monthly')} className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${goalType === 'monthly' ? 'bg-primary/15 text-primary border-primary/30' : 'border-border text-muted-foreground'}`}>شهري</button>
                  <button onClick={() => setGoalType('annual')} className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${goalType === 'annual' ? 'bg-primary/15 text-primary border-primary/30' : 'border-border text-muted-foreground'}`}>سنوي</button>
                </div>
              </div>
              <div className={goalType === 'monthly' ? 'grid grid-cols-2 gap-3' : ''}>
                <div>
                  <label className="form-label">السنة</label>
                  <select value={year} onChange={e => setYear(parseInt(e.target.value))}
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                {goalType === 'monthly' && (
                  <div>
                    <label className="form-label">الشهر</label>
                    <select value={month} onChange={e => setMonth(parseInt(e.target.value))}
                      className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                      {ARABIC_MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label className="form-label">مبلغ الهدف (ج.م) *</label>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min={1} dir="ltr" placeholder="100000"
                  className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
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
