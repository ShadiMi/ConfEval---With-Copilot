'use client';

import DashboardLayout from '@/components/DashboardLayout';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { conferencesApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Conference } from '@/types';
import {
    Calendar,
    ChevronRight,
    Layers,
    MapPin
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function ConferencesListPage() {
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConferences();
  }, []);

  const loadConferences = async () => {
    try {
      const res = await conferencesApi.list();
      setConferences(res.data);
    } catch (error) {
      console.error('Failed to load conferences');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'gray'> = {
      draft: 'gray',
      active: 'success',
      completed: 'warning',
      archived: 'danger',
    };
    return <Badge variant={variants[status] || 'gray'}>{status}</Badge>;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Conferences</h1>
          <p className="text-slate-600">Browse all active conferences and their sessions</p>
        </div>

        {/* Conferences Grid */}
        {conferences.length === 0 ? (
          <Card>
            <CardBody>
              <div className="text-center py-12">
                <Layers className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No conferences available</h3>
                <p className="text-slate-600">Check back later for upcoming conferences</p>
              </div>
            </CardBody>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {conferences.map((conference) => (
              <Card key={conference.id} className="hover:shadow-lg transition-shadow">
                <CardBody>
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-900">{conference.name}</h3>
                    {getStatusBadge(conference.status)}
                  </div>
                  
                  {conference.description && (
                    <p className="text-sm text-slate-600 mb-4 line-clamp-2">{conference.description}</p>
                  )}
                  
                  <div className="space-y-2 text-sm text-slate-600 mb-4">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      {formatDate(conference.start_date)} - {formatDate(conference.end_date)}
                    </div>
                    {conference.location && (
                      <div className="flex items-center">
                        <MapPin className="w-4 h-4 mr-2" />
                        {conference.location}
                      </div>
                    )}
                  </div>
                  
                  <Link href={`/conferences/${conference.id}`}>
                    <Button variant="secondary" className="w-full">
                      View Details
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
