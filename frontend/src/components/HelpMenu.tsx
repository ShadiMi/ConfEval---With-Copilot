'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  ChevronDown,
  HelpCircle,
  LifeBuoy,
  RotateCw,
} from 'lucide-react';
import { useAuthStore, useHelpStore } from '@/lib/store';
import { cn } from '@/lib/utils';

interface HelpMenuProps {
  variant?: 'desktop' | 'mobile';
  onNavigate?: () => void;
}

export default function HelpMenu({ variant = 'desktop', onNavigate }: HelpMenuProps) {
  const { user } = useAuthStore();
  const { openContact, restartTour } = useHelpStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const handleContact = () => {
    setOpen(false);
    onNavigate?.();
    openContact();
  };

  const handleRestart = () => {
    setOpen(false);
    onNavigate?.();
    restartTour(user?.id);
  };

  const handleHelpPage = () => {
    setOpen(false);
    onNavigate?.();
  };

  if (variant === 'mobile') {
    return (
      <div className="space-y-1">
        <Link
          href="/help"
          onClick={handleHelpPage}
          className="flex items-center w-full px-3 py-2 text-base font-medium text-slate-600 rounded-lg hover:bg-slate-50"
        >
          <BookOpen className="w-5 h-5 mr-3" />
          Help page
        </Link>
        <button
          type="button"
          onClick={handleRestart}
          className="flex items-center w-full px-3 py-2 text-base font-medium text-slate-600 rounded-lg hover:bg-slate-50"
        >
          <RotateCw className="w-5 h-5 mr-3" />
          Restart tutorial
        </button>
        <button
          type="button"
          onClick={handleContact}
          className="flex items-center w-full px-3 py-2 text-base font-medium text-slate-600 rounded-lg hover:bg-slate-50"
        >
          <LifeBuoy className="w-5 h-5 mr-3" />
          Contact support
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        data-tour="help"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center p-2 rounded-lg transition-colors',
          open
            ? 'bg-slate-100 text-slate-900'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        )}
        title="Help"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <HelpCircle className="w-5 h-5" />
        <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50"
        >
          <Link
            href="/help"
            onClick={handleHelpPage}
            role="menuitem"
            className="flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <BookOpen className="w-4 h-4 mr-2 text-slate-500" />
            Help page
          </Link>
          <button
            type="button"
            onClick={handleRestart}
            role="menuitem"
            className="flex items-center w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <RotateCw className="w-4 h-4 mr-2 text-slate-500" />
            Restart tutorial
          </button>
          <div className="my-1 border-t border-slate-100" />
          <button
            type="button"
            onClick={handleContact}
            role="menuitem"
            className="flex items-center w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <LifeBuoy className="w-4 h-4 mr-2 text-slate-500" />
            Contact support
          </button>
        </div>
      )}
    </div>
  );
}
