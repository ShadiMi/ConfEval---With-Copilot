'use client';

import { useEffect, useState, ReactNode, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { authApi } from '@/lib/api';
import { UserRole } from '@/types';

interface AuthGuardProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

const PUBLIC_PATHS = ['/', '/login', '/register'];

export default function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, setUser } = useAuthStore();
  const setLoading = useAuthStore((state) => state.setLoading);
  const [checked, setChecked] = useState(false);
  const isCheckingRef = useRef(false);

  useEffect(() => {
    // Skip if already checking or on public page
    if (isCheckingRef.current) return;
    if (PUBLIC_PATHS.includes(pathname)) {
      setChecked(true);
      return;
    }

    const checkAuth = async () => {
      isCheckingRef.current = true;
      
      const token = localStorage.getItem('token');
      
      if (!token) {
        setChecked(true);
        isCheckingRef.current = false;
        router.replace('/login');
        return;
      }

      try {
        const response = await authApi.getMe();
        // Only update user if it changed to prevent unnecessary re-renders
        const currentUser = useAuthStore.getState().user;
        if (!currentUser || currentUser.id !== response.data.id) {
          setUser(response.data);
        }
        
        // Check role access
        if (allowedRoles && !allowedRoles.includes(response.data.role)) {
          router.replace('/dashboard');
        }
      } catch (error) {
        // Clear auth state and redirect
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        router.replace('/login');
      } finally {
        setChecked(true);
        isCheckingRef.current = false;
      }
    };

    checkAuth();
  }, [pathname, allowedRoles, setUser, router]);

  // Show loading only for protected routes
  if (!PUBLIC_PATHS.includes(pathname) && !checked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // On protected routes, don't render if not authenticated
  if (!PUBLIC_PATHS.includes(pathname) && !isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
