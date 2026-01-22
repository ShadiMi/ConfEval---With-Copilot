'use client';

import DashboardLayout from '@/components/DashboardLayout';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { conferencesApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { ConferenceWithSessions } from '@/types';
import {
    ArrowLeft,
    Calendar,
    Clock,
    Layers,
    MapPin,
    Users,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function ConferenceDetailsPage() {
  const params = useParams();
  const conferenceId = Number(params.id);
  const [conference, setConference] = useState<ConferenceWithSessions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (conferenceId) {
      loadConference();
    }
  }, [conferenceId]);

  const loadConference = async () => {
    try {
      const res = await conferencesApi.get(conferenceId);
      setConference(res.data);
    } catch (error) {
      console.error('Failed to load conference');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
      draft: 'default',
      active: 'success',
      completed: 'warning',
      archived: 'error',
      upcoming: 'default',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
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

  if (!conference) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <Layers className="w-12 h-12 mx-auto text-slate-400 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">Conference not found</h3>
          <Link href="/conferences">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Conferences
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Back Button */}
        <Link href="/conferences" className="inline-flex items-center text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Conferences
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-slate-900">{conference.name}</h1>
              {getStatusBadge(conference.status)}
            </div>
            {conference.description && (
              <p className="text-slate-600 max-w-2xl">{conference.description}</p>
            )}
          </div>
        </div>

        {/* Conference Info */}
        <Card>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Duration</p>
                  <p className="font-medium text-slate-900">
                    {formatDate(conference.start_date)} - {formatDate(conference.end_date)}
                  </p>
                </div>
              </div>
              
              {conference.location && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Location</p>
                    <p className="font-medium text-slate-900">{conference.location}</p>
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Layers className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Sessions</p>
                  <p className="font-medium text-slate-900">
                    {conference.session_count} / {conference.max_sessions}
                  </p>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Sessions */}
        <div>
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Sessions</h2>
          
          {conference.sessions.length === 0 ? (
            <Card>
              <CardBody>
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No sessions yet</h3>
                  <p className="text-slate-600">Sessions will be added to this conference soon</p>
                </div>
              </CardBody>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {conference.sessions.map((session) => (
                <Card key={session.id} className="hover:shadow-md transition-shadow">
                  <CardBody>
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-slate-900">{session.name}</h3>
                      {getStatusBadge(session.status)}
                    </div>
                    
                    {session.description && (
                      <p className="text-sm text-slate-600 mb-3 line-clamp-2">{session.description}</p>
                    )}
                    
                    <div className="space-y-2 text-sm text-slate-500">
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-2" />
                        {formatDate(session.start_date)} - {formatDate(session.end_date)}
                      </div>
                      {session.location && (
                        <div className="flex items-center">
                          <MapPin className="w-4 h-4 mr-2" />
                          {session.location}
                        </div>
                      )}
                      <div className="flex items-center">
                        <Users className="w-4 h-4 mr-2" />
                        Max {session.max_projects} projects
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <Link href={`/sessions/${session.id}`}>
                        <Button variant="outline" size="sm" className="w-full">
                          View Session Details
                        </Button>
                      </Link>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
