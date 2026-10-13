import { Bell, LogOut, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    toast.success('تم تسجيل الخروج بنجاح');
    navigate('/login');
  }

  return (
    <header className="h-14 border-b border-border bg-card px-5 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-1.5">
        <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
          <Bell className="w-4.5 h-4.5" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-semibold text-foreground leading-tight">{user?.username}</p>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
        </div>
        <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
          <User className="w-4 h-4 text-primary" />
        </div>
        <button
          onClick={handleLogout}
          className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title="تسجيل الخروج"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
