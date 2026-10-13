import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Eye, EyeOff, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth, mapSupabaseUser } from '@/hooks/useAuth';
import { toast } from 'sonner';

type Mode = 'login' | 'register-email' | 'register-otp' | 'forgot-email' | 'forgot-otp';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [username, setUsername] = useState('');
  const [otp, setOtp] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) { toast.error('يرجى إدخال البريد الإلكتروني وكلمة المرور'); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { toast.error('بيانات الدخول غير صحيحة'); setLoading(false); return; }
    login(mapSupabaseUser(data.user));
    navigate('/');
  }

  async function handleSendOtp() {
    if (!email) { toast.error('يرجى إدخال البريد الإلكتروني'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) { toast.error(error.message); setLoading(false); return; }
    toast.success('تم إرسال رمز التحقق إلى بريدك الإلكتروني');
    setMode(mode === 'register-email' ? 'register-otp' : 'forgot-otp');
    setLoading(false);
  }

  async function handleRegisterVerify() {
    if (!otp || !newPassword || !username) { toast.error('يرجى ملء جميع الحقول'); return; }
    if (newPassword.length < 6) { toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' });
    if (error) { toast.error('رمز التحقق غير صحيح أو منتهي الصلاحية'); setLoading(false); return; }
    const { data: updated, error: updateErr } = await supabase.auth.updateUser({ password: newPassword, data: { username } });
    if (updateErr) { toast.error(updateErr.message); setLoading(false); return; }
    login(mapSupabaseUser(updated.user));
    toast.success('تم إنشاء الحساب بنجاح! مرحباً بك');
    navigate('/');
  }

  async function handleForgotVerify() {
    if (!otp || !newPassword) { toast.error('يرجى ملء جميع الحقول'); return; }
    if (newPassword.length < 6) { toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل'); return; }
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' });
    if (error) { toast.error('رمز التحقق غير صحيح أو منتهي الصلاحية'); setLoading(false); return; }
    const { data: updated, error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
    if (updateErr) { toast.error(updateErr.message); setLoading(false); return; }
    login(mapSupabaseUser(updated.user));
    toast.success('تم تغيير كلمة المرور بنجاح');
    navigate('/');
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto mb-4">
            <Camera className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Tarek Habib Studio</h1>
          <p className="text-muted-foreground text-sm mt-1">نظام إدارة الاستوديو</p>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 shadow-xl">
          {/* Login */}
          {mode === 'login' && (
            <>
              <h2 className="text-lg font-bold mb-5">تسجيل الدخول</h2>
              <div className="space-y-4">
                <div>
                  <label className="form-label">البريد الإلكتروني</label>
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="example@email.com" dir="ltr"
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="form-label">كلمة المرور</label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleLogin()}
                      className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors pl-9"
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button onClick={handleLogin} disabled={loading}
                  className="w-full btn-primary flex items-center justify-center gap-2 py-2.5">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  تسجيل الدخول
                </button>
              </div>
              <div className="mt-4 flex justify-between text-sm">
                <button onClick={() => setMode('forgot-email')} className="text-primary hover:underline">نسيت كلمة المرور؟</button>
                <button onClick={() => setMode('register-email')} className="text-muted-foreground hover:text-foreground">إنشاء حساب جديد</button>
              </div>
            </>
          )}

          {/* Register - Email */}
          {mode === 'register-email' && (
            <>
              <h2 className="text-lg font-bold mb-5">إنشاء حساب جديد</h2>
              <div className="space-y-4">
                <div>
                  <label className="form-label">البريد الإلكتروني</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="example@email.com" dir="ltr"
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors" />
                </div>
                <button onClick={handleSendOtp} disabled={loading}
                  className="w-full btn-primary flex items-center justify-center gap-2 py-2.5">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />} إرسال رمز التحقق
                </button>
                <button onClick={() => setMode('login')} className="w-full text-sm text-muted-foreground hover:text-foreground py-1">← العودة لتسجيل الدخول</button>
              </div>
            </>
          )}

          {/* Register - OTP */}
          {mode === 'register-otp' && (
            <>
              <h2 className="text-lg font-bold mb-1">تفعيل الحساب</h2>
              <p className="text-sm text-muted-foreground mb-5">أدخل الرمز المرسل إلى {email}</p>
              <div className="space-y-4">
                <div>
                  <label className="form-label">رمز التحقق (4 أرقام)</label>
                  <input type="text" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="0000" maxLength={4} dir="ltr" className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-center tracking-widest text-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary" />
                </div>
                <div>
                  <label className="form-label">الاسم</label>
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="اسمك"
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary" />
                </div>
                <div>
                  <label className="form-label">كلمة المرور الجديدة</label>
                  <input type={showPass ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••"
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary" />
                </div>
                <button onClick={handleRegisterVerify} disabled={loading}
                  className="w-full btn-primary flex items-center justify-center gap-2 py-2.5">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />} إنشاء الحساب
                </button>
                <button onClick={() => setMode('register-email')} className="w-full text-sm text-muted-foreground hover:text-foreground py-1">← إعادة إرسال الرمز</button>
              </div>
            </>
          )}

          {/* Forgot - Email */}
          {mode === 'forgot-email' && (
            <>
              <h2 className="text-lg font-bold mb-5">استعادة كلمة المرور</h2>
              <div className="space-y-4">
                <div>
                  <label className="form-label">البريد الإلكتروني</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="example@email.com" dir="ltr"
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary" />
                </div>
                <button onClick={handleSendOtp} disabled={loading}
                  className="w-full btn-primary flex items-center justify-center gap-2 py-2.5">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />} إرسال رمز التحقق
                </button>
                <button onClick={() => setMode('login')} className="w-full text-sm text-muted-foreground hover:text-foreground py-1">← العودة</button>
              </div>
            </>
          )}

          {/* Forgot - OTP */}
          {mode === 'forgot-otp' && (
            <>
              <h2 className="text-lg font-bold mb-1">تعيين كلمة مرور جديدة</h2>
              <p className="text-sm text-muted-foreground mb-5">أدخل الرمز المرسل إلى {email}</p>
              <div className="space-y-4">
                <div>
                  <label className="form-label">رمز التحقق</label>
                  <input type="text" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="0000" maxLength={4} dir="ltr"
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm text-center tracking-widest text-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary" />
                </div>
                <div>
                  <label className="form-label">كلمة المرور الجديدة</label>
                  <input type={showPass ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••"
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary" />
                </div>
                <button onClick={handleForgotVerify} disabled={loading}
                  className="w-full btn-primary flex items-center justify-center gap-2 py-2.5">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />} تغيير كلمة المرور
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
