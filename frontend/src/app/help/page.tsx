'use client';

import Link from 'next/link';
import { ArrowRight, LifeBuoy, PlayCircle } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useAuthStore, useHelpStore } from '@/lib/store';
import { helpSections } from '@/lib/tutorials';
import { getRoleLabel } from '@/lib/utils';

export default function HelpPage() {
  const { user } = useAuthStore();
  const { startTour, openContact } = useHelpStore();

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Help &amp; how-to
          </h1>
          {user && (
            <p className="text-slate-600 mt-1">
              Everything you can do in ConfEval as a{' '}
              <span className="font-medium">{getRoleLabel(user.role)}</span>.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => startTour()}
          >
            <PlayCircle className="w-4 h-4 mr-2" />
            Take the interactive tour
          </Button>
          <Button onClick={() => openContact()}>
            <LifeBuoy className="w-4 h-4 mr-2" />
            Contact support
          </Button>
        </div>
      </div>

      {user && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {helpSections[user.role].map((section) => (
            <Card key={section.heading}>
              <CardHeader>
                <h2 className="font-semibold text-slate-900">
                  {section.heading}
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  {section.description}
                </p>
              </CardHeader>
              <CardBody>
                <ul className="space-y-1.5 text-sm text-slate-700 list-disc pl-5">
                  {section.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
                {section.href && (
                  <Link
                    href={section.href}
                    className="inline-flex items-center mt-4 text-sm font-medium text-primary-700 hover:text-primary-800"
                  >
                    {section.linkLabel || 'Open'}
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Link>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <div id="support" className="mt-8">
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <LifeBuoy className="w-5 h-5 text-slate-400 mr-2" />
              <h2 className="font-semibold text-slate-900">
                Need more help?
              </h2>
            </div>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-slate-700 mb-3">
              For technical issues or questions about ConfEval, contact the
              support team.
            </p>
            <Button onClick={() => openContact()}>
              <LifeBuoy className="w-4 h-4 mr-2" />
              Show contact info
            </Button>
          </CardBody>
        </Card>
      </div>
    </DashboardLayout>
  );
}
