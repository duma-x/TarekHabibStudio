import { useEffect, useState } from 'react';
import { Loader2, Save, Eye, EyeOff, Camera } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth, mapSupabaseUser } from '@/hooks/useAuth';
import { logAction } from '@/lib/auditLog';
import { toast } from 'sonner';

export default function Settings() {
  const { user, login } = useAuth();
  const [studioName, setStudioName] = useState('Tarek Habib Studio');
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [username, setUsername] = useState(user?.username ?? '');
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [savingPass, setSavingPass] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [inviteStep, setInviteStep] = useState<'idle' | 'sent'>('idle');
  const [sendingInvite, setSendingInvite] = useState(false);

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    setLoadingSettings(true);
    const { data } = await supabase.from('app_settings').select('*');
    if (data) {
      const nameRow = data.find(r => r.key === 'studio_name');
      if (nameRow) setStudioName(nameRow.value);
    }
    setLoadingSettings(false);
  }

  async function saveStudioName() {
    setSavingSettings(true);
    const { error } = await supabase.from('app_settings').upsert({ key: 'studio_name', value: studioName, updated_at: new Date().toISOString() });
    if (error) { toast.error('فشل الحفظ'); setSavingSettings(false); return; }
    await logAction(user?.id, 'تعديل إعدادات الاستوديو', 'app_settings');
    toast.success('تم حفظ اسم الاستوديو');
    setSavingSettings(false);
  }

  async function saveProfile() {
    if (!username.trim()) { toast.error('يرجى إدخال الاسم'); return; }
    setSavingProfile(true);
    const { data, error } = await supabase.auth.updateUser({ data: { username: username.trim() } });
    if (error) { toast.error('فشل تحديث الملف الشخصي'); setSavingProfile(false); return; }
    login(mapSupabaseUser(data.user));
    await logAction(user?.id, 'تحديث الملف الشخصي', 'user_profiles', user?.id);
    toast.success('تم تحديث الملف الشخصي');
    setSavingProfile(false);
  }

  async function changePassword() {
    if (!newPass || newPass.length < 6) { toast.error('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل'); return; }
    if (newPass !== confirmPass) { toast.error('كلمتا المرور غير متطابقتان'); return; }
    setSavingPass(true);
    // Verify current password first
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user!.email, password: currentPass });
    if (signInErr) { toast.error('كلمة المرور الحالية غير صحيحة'); setSavingPass(false); return; }
    const { error } = await supabase.auth.updateUser({ password: newPass });
    if (error) { toast.error('فشل تغيير كلمة المرور'); setSavingPass(false); return; }
    await logAction(user?.id, 'تغيير كلمة المرور', 'user_profiles', user?.id);
    toast.success('تم تغيير كلمة المرور بنجاح');
    setCurrentPass(''); setNewPass(''); setConfirmPass('');
    setSavingPass(false);
  }

  async function sendInvite() {
    if (!otpEmail.trim()) { toast.error('يرجى إدخال البريد الإلكتروني'); return; }
    setSendingInvite(true);
    const { error } = await supabase.auth.signInWithOtp({ email: otpEmail.trim(), options: { shouldCreateUser: true } });
    if (error) { toast.error('فشل الإرسال: ' + error.message); setSendingInvite(false); return; }
    toast.success('تم إرسال رمز التحقق إلى البريد الإلكتروني');
    setInviteStep('sent');
    setSendingInvite(false);
  }

  async function handleExportData() {
    toast.info('جارٍ تصدير البيانات...');
    const [clients, orders, payments, bookings, employees] = await Promise.all([
      supabase.from('clients').select('*'),
      supabase.from('orders').select('*'),
      supabase.from('payments').select('*'),
      supabase.from('bookings').select('*'),
      supabase.from('employees').select('*'),
    ]);
    const exportData = {
      exported_at: new Date().toISOString(),
      clients: clients.data ?? [],
      orders: orders.data ?? [],
      payments: payments.data ?? [],
      bookings: bookings.data ?? [],
      employees: employees.data ?? [],
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `tarek-habib-studio-backup-${new Date().toISOString().split('T')[0]}.json`; a.click();
    URL.revokeObjectURL(url);
    await logAction(user?.id, 'تصدير بيانات', 'app_settings');
    toast.success('تم تصدير البيانات بنجاح');
  }

  if (loadingSettings) return <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <h1 className="page-title">إعدادات التطبيق</h1>

      {/* Studio Info */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Camera className="w-5 h-5 text-primary" />
          </div>
          <h2 className="font-bold">معلومات الاستوديو</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="form-label">اسم الاستوديو</label>
            <input value={studioName} onChange={e => setStudioName(e.target.value)}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <button onClick={saveStudioName} disabled={savingSettings}
            className="btn-primary flex items-center gap-2 py-2.5 px-5">
            {savingSettings && <Loader2 className="w-4 h-4 animate-spin" />} <Save className="w-4 h-4" /> حفظ
          </button>
        </div>
      </div>

      {/* Profile */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="font-bold mb-5">الملف الشخصي</h2>
        <div className="space-y-4">
          <div>
            <label className="form-label">البريد الإلكتروني</label>
            <input value={user?.email ?? ''} disabled dir="ltr"
              className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm text-muted-foreground cursor-not-allowed" />
          </div>
          <div>
            <label className="form-label">الاسم</label>
            <input value={username} onChange={e => setUsername(e.target.value)}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <button onClick={saveProfile} disabled={savingProfile}
            className="btn-primary flex items-center gap-2 py-2.5 px-5">
            {savingProfile && <Loader2 className="w-4 h-4 animate-spin" />} حفظ الاسم
          </button>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="font-bold mb-5">تغيير كلمة المرور</h2>
        <div className="space-y-4">
          <div>
            <label className="form-label">كلمة المرور الحالية *</label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} value={currentPass} onChange={e => setCurrentPass(e.target.value)}
                className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 pl-9" />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="form-label">كلمة المرور الجديدة *</label>
            <input type={showPass ? 'text' : 'password'} value={newPass} onChange={e => setNewPass(e.target.value)}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div>
            <label className="form-label">تأكيد كلمة المرور الجديدة *</label>
            <input type={showPass ? 'text' : 'password'} value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <button onClick={changePassword} disabled={savingPass}
            className="btn-primary flex items-center gap-2 py-2.5 px-5">
            {savingPass && <Loader2 className="w-4 h-4 animate-spin" />} تغيير كلمة المرور
          </button>
        </div>
      </div>

      {/* Invite User */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="font-bold mb-2">دعوة مستخدم جديد</h2>
        <p className="text-sm text-muted-foreground mb-5">أرسل رمز تحقق OTP لإنشاء حساب موظف جديد</p>
        {inviteStep === 'idle' ? (
          <div className="space-y-4">
            <div>
              <label className="form-label">البريد الإلكتروني للموظف</label>
              <input type="email" value={otpEmail} onChange={e => setOtpEmail(e.target.value)} dir="ltr"
                className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <button onClick={sendInvite} disabled={sendingInvite} className="btn-primary flex items-center gap-2 py-2.5 px-5">
              {sendingInvite && <Loader2 className="w-4 h-4 animate-spin" />} إرسال رمز التحقق
            </button>
          </div>
        ) : (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <p className="text-green-400 font-medium text-sm">تم إرسال رمز التحقق إلى {otpEmail}</p>
            <p className="text-muted-foreground text-xs mt-1">يمكن للموظف الآن الدخول إلى صفحة تسجيل الدخول وإنشاء حسابه</p>
            <button onClick={() => { setInviteStep('idle'); setOtpEmail(''); }} className="text-xs text-primary hover:underline mt-2">إرسال لبريد آخر</button>
          </div>
        )}
      </div>

      {/* Data Export */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="font-bold mb-2">تصدير البيانات</h2>
        <p className="text-sm text-muted-foreground mb-4">تصدير جميع بيانات النظام (العملاء، الطلبات، المدفوعات، الحجوزات) كملف JSON للنسخ الاحتياطي</p>
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4">
          <p className="text-amber-400 text-xs">⚠️ ملاحظة: التصدير يشمل بيانات العمل فقط ولا يشمل كلمات المرور أو معلومات المصادقة الحساسة.</p>
        </div>
        <button onClick={handleExportData} className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-primary/30 text-primary text-sm hover:bg-primary/10 transition-colors">
          تصدير نسخة احتياطية JSON
        </button>
      </div>
    </div>
  );
}
