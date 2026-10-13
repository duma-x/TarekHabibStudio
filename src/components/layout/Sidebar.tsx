import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, Users, Tag, Package,
  CreditCard, CalendarDays, UserCheck, Target, BarChart3,
  ClipboardList, Settings, Camera, HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', label: 'لوحة التحكم', icon: LayoutDashboard, exact: true },
  { to: '/orders', label: 'الطلبات', icon: ShoppingCart },
  { to: '/clients', label: 'العملاء', icon: Users },
  { to: '/price-list', label: 'قائمة الأسعار', icon: Tag },
  { to: '/products', label: 'المنتجات والمخزون', icon: Package },
  { to: '/payments', label: 'المدفوعات', icon: CreditCard },
  { to: '/bookings', label: 'الحجوزات', icon: CalendarDays },
  { to: '/employees', label: 'الموظفون', icon: UserCheck },
  { to: '/goals', label: 'الأهداف', icon: Target },
  { to: '/reports', label: 'التقارير', icon: BarChart3 },
  { to: '/audit-log', label: 'سجل العمليات', icon: ClipboardList },
  { to: '/settings', label: 'إعدادات التطبيق', icon: Settings },
];

export default function Sidebar() {
  return (
    <aside className="fixed top-0 right-0 h-full w-[220px] bg-sidebar border-l border-sidebar-border flex flex-col z-30">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <Camera className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground leading-tight truncate">Tarek Habib Studio</p>
          <p className="text-xs text-muted-foreground">إدارة الاستوديو</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <ul className="space-y-0.5">
          {navItems.map(({ to, label, icon: Icon, exact }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={exact}
                className={({ isActive }) => cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150',
                  isActive
                    ? 'bg-primary/15 text-primary font-semibold'
                    : 'text-sidebar-foreground hover:bg-white/5 hover:text-foreground'
                )}
              >
                {({ isActive }) => (
                  <>
                    <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
                    <span className="truncate">{label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 border-t border-sidebar-border">
        <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 w-full transition-colors">
          <HelpCircle className="w-4 h-4 flex-shrink-0" />
          <span>الدعم والمساعدة</span>
        </button>
      </div>
    </aside>
  );
}
