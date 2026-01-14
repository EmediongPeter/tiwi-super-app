'use client';

import { usePathname } from 'next/navigation';
import { AdminAuthProvider } from '@/lib/frontend/contexts/admin-auth-context';
import { AdminProtectedRoute } from '@/components/admin/admin-protected-route';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/admin/login';

  return (
    <AdminAuthProvider>
      {isLoginPage ? (
        children
      ) : (
        <AdminProtectedRoute>
          {children}
        </AdminProtectedRoute>
      )}
    </AdminAuthProvider>
  );
}

