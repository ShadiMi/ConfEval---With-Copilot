'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, LifeBuoy } from 'lucide-react';
import Navbar from './Navbar';
import AuthGuard from './AuthGuard';
import Tour from './Tour';
import ContactSupportModal from './ContactSupportModal';
import { useAuthStore, useHelpStore } from '@/lib/store';
import { authApi } from '@/lib/api';
import { UserRole } from '@/types';

interface DashboardLayoutProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

const seenKey = (userId: number | string) =>
  `confeval.tour.seen.${userId}`;

export default function DashboardLayout({ children, allowedRoles }: DashboardLayoutProps) {
  const { user } = useAuthStore();
  const { startTour, openContact } = useHelpStore();
  const pathname = usePathname();
  const [supportEmail, setSupportEmail] = useState('');

  // First-login auto-start: only on the dashboard, and only if not seen.
  useEffect(() => {
    if (!user) return;
    if (typeof window === 'undefined') return;
    if (!pathname || !pathname.startsWith('/dashboard')) return;
    const seen = window.localStorage.getItem(seenKey(user.id));
    if (!seen) {
      startTour();
    }
  }, [user, pathname, startTour]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await authApi.getSetting('support_email');
        if (!cancelled) setSupportEmail(res.data?.value || '');
      } catch {
        // Non-fatal — footer just omits the email.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <AuthGuard allowedRoles={allowedRoles}>
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 to-slate-100">
        <Navbar />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <footer className="border-t border-slate-200 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-slate-500">
            <div>&copy; {new Date().getFullYear()} ConfEval</div>
            <div className="flex items-center gap-4">
              <Link
                href="/help"
                className="inline-flex items-center hover:text-slate-800"
              >
                <BookOpen className="w-4 h-4 mr-1" />
                Help page
              </Link>
              <button
                type="button"
                onClick={() => openContact()}
                className="inline-flex items-center hover:text-slate-800"
              >
                <LifeBuoy className="w-4 h-4 mr-1" />
                Contact support
              </button>
              {supportEmail && (
                <a
                  href={`mailto:${supportEmail}`}
                  className="hidden md:inline text-slate-600 hover:text-slate-900"
                >
                  {supportEmail}
                </a>
              )}
            </div>
          </div>
        </footer>
        {user && <Tour />}
        <ContactSupportModal />
      </div>
    </AuthGuard>
  );
}
