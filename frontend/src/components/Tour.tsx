'use client';

import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';
import type { CallBackProps } from 'react-joyride';
import { STATUS } from 'react-joyride';
import { useAuthStore, useHelpStore } from '@/lib/store';
import { tutorialTour } from '@/lib/tutorials';

const Joyride = dynamic(() => import('react-joyride'), { ssr: false });

const PRIMARY = '#2563eb'; // tailwind primary-600

export default function Tour() {
  const { user } = useAuthStore();
  const { tourRunning, tourSeedKey, stopTour } = useHelpStore();
  const router = useRouter();
  const pathname = usePathname();

  // If the tour is started from a page other than /dashboard, navigate there
  // first so the nav selectors resolve.
  useEffect(() => {
    if (!tourRunning) return;
    if (pathname && !pathname.startsWith('/dashboard')) {
      router.push('/dashboard');
    }
  }, [tourRunning, pathname, router]);

  const handleCallback = useCallback(
    (data: CallBackProps) => {
      const finished: string[] = [STATUS.FINISHED, STATUS.SKIPPED];
      if (finished.includes(data.status)) {
        if (user && typeof window !== 'undefined') {
          window.localStorage.setItem(`confeval.tour.seen.${user.id}`, '1');
        }
        stopTour();
      }
    },
    [stopTour, user]
  );

  if (!user) return null;
  const tour = tutorialTour[user.role];
  if (!tour) return null;

  return (
    <Joyride
      key={tourSeedKey}
      steps={tour.steps}
      run={tourRunning}
      continuous
      showProgress
      showSkipButton
      scrollToFirstStep
      disableOverlayClose
      callback={handleCallback}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Finish',
        next: 'Next',
        skip: 'Skip',
      }}
      styles={{
        options: {
          primaryColor: PRIMARY,
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: 12,
          padding: 16,
        },
        tooltipTitle: {
          fontSize: 16,
          fontWeight: 600,
        },
        buttonNext: {
          backgroundColor: PRIMARY,
          borderRadius: 8,
        },
        buttonBack: {
          color: '#475569',
        },
        buttonSkip: {
          color: '#64748b',
        },
      }}
    />
  );
}
