import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import Layout from '@/components/layout/Layout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Clients from '@/pages/Clients';
import OrdersList from '@/pages/Orders/index';
import OrderForm from '@/pages/Orders/OrderForm';
import OrderDetail from '@/pages/Orders/OrderDetail';
import PriceList from '@/pages/PriceList';
import Products from '@/pages/Products';
import Payments from '@/pages/Payments';
import Bookings from '@/pages/Bookings';
import Employees from '@/pages/Employees';
import Goals from '@/pages/Goals';
import Reports from '@/pages/Reports';
import AuditLog from '@/pages/AuditLog';
import Settings from '@/pages/Settings';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">جارٍ التحميل...</p>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="clients" element={<Clients />} />
        <Route path="orders" element={<OrdersList />} />
        <Route path="orders/new" element={<OrderForm />} />
        <Route path="orders/:id/edit" element={<OrderForm />} />
        <Route path="orders/:id" element={<OrderDetail />} />
        <Route path="price-list" element={<PriceList />} />
        <Route path="products" element={<Products />} />
        <Route path="payments" element={<Payments />} />
        <Route path="bookings" element={<Bookings />} />
        <Route path="employees" element={<Employees />} />
        <Route path="goals" element={<Goals />} />
        <Route path="reports" element={<Reports />} />
        <Route path="audit-log" element={<AuditLog />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-center" richColors dir="rtl" />
      </AuthProvider>
    </BrowserRouter>
  );
}
