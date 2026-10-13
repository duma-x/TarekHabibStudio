import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-background" dir="rtl">
      <Sidebar />
      <div className="flex-1 mr-[220px] flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 p-5 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
