'use client';

import DashboardLayout from '@/components/DashboardLayout';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import { applicationsApi, conferencesApi, sessionsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { formatDate } from '@/lib/utils';
import { Conference, ReviewerApplication, Session } from '@/types';
import {
    Calendar,
    ChevronRight,
    Clock,
    Filter,
    Layers,
    MapPin,
    Send,
    Users,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

export default function SessionsPage() {
  const { user } = useAuthStore();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyModal, setApplyModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [myApplications, setMyApplications] = useState<ReviewerApplication[]>([]);
  const [filterConferenceId, setFilterConferenceId] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [applyMessage, setApplyMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [sessionsRes, appsRes, conferencesRes] = await Promise.all([
        sessionsApi.list(),
        user?.role === 'internal_reviewer' || user?.role === 'external_reviewer'
          ? applicationsApi.getMyApplications()
          : Promise.resolve({ data: [] }),
        conferencesApi.list().catch(() => ({ data: [] })),
      ]);
      setSessions(sessionsRes.data);
      setMyApplications(appsRes.data);
      setConferences(conferencesRes.data);
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getConferenceName = (conferenceId?: number) => {
    if (!conferenceId) return null;
    const conference = conferences.find(c => c.id === conferenceId);
    return conference?.name || null;
  };

  const getSessionStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      upcoming: 'border-l-blue-500 bg-blue-50/30',
      active: 'border-l-green-500 bg-green-50/30',
      completed: 'border-l-amber-500 bg-amber-50/30',
    };
    return colors[status] || 'border-l-slate-300';
  };

  // Filter sessions
  const filteredSessions = sessions.filter(session => {
    if (filterConferenceId && session.conference_id !== parseInt(filterConferenceId)) {
      return false;
    }
    if (filterStatus && session.status !== filterStatus) {
      return false;
    }
    return true;
  });

  // Group sessions by conference
  const sessionsByConference = filteredSessions.reduce((acc, session) => {
    const conferenceId = session.conference_id || 0; // 0 for unassigned
    if (!acc[conferenceId]) {
      acc[conferenceId] = [];
    }
    acc[conferenceId].push(session);
    return acc;
  }, {} as Record<number, Session[]>);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession) return;
    
    setSubmitting(true);
    try {
      await applicationsApi.create({
        session_id: selectedSession.id,
        message: applyMessage,
      });
      toast.success('Application submitted successfully');
      setApplyModal(false);
      setApplyMessage('');
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  const hasApplied = (sessionId: number) => {
    return myApplications.some((app) => app.session_id === sessionId);
  };

  const isReviewer = user?.role === 'internal_reviewer' || user?.role === 'external_reviewer';

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Sessions</h1>
            <p className="text-slate-600 mt-1">Browse conference sessions</p>
          </div>
          {user?.role === 'admin' && (
            <Link href="/conferences">
              <Button variant="secondary">
                <Layers className="w-4 h-4 mr-2" />
                Manage in Conferences
              </Button>
            </Link>
          )}
        </div>

        {/* Filters */}
        {sessions.length > 0 && (
          <Card>
            <CardBody className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-700">Filters:</span>
              </div>
              <Select
                value={filterConferenceId}
                onChange={(e) => setFilterConferenceId(e.target.value)}
                options={[
                  { value: '', label: 'All Conferences' },
                  ...conferences.map((c) => ({ value: String(c.id), label: c.name })),
                ]}
                className="w-48"
              />
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                options={[
                  { value: '', label: 'All Statuses' },
                  { value: 'upcoming', label: 'Upcoming' },
                  { value: 'active', label: 'Active' },
                  { value: 'completed', label: 'Completed' },
                ]}
                className="w-40"
              />
              {(filterConferenceId || filterStatus) && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => { setFilterConferenceId(''); setFilterStatus(''); }}
                >
                  Clear Filters
                </Button>
              )}
              <span className="text-sm text-slate-500 ml-auto">
                Showing {filteredSessions.length} of {sessions.length} sessions
              </span>
            </CardBody>
          </Card>
        )}

        {sessions.length === 0 ? (
          <Card>
            <CardBody>
              <EmptyState
                icon={<Calendar className="w-12 h-12" />}
                title="No Sessions Found"
                description={user?.role === 'admin' 
                  ? "Sessions are created from within conferences. Go to Conferences to create your first session."
                  : "There are no sessions available at the moment."
                }
                action={
                  user?.role === 'admin' && (
                    <Link href="/conferences">
                      <Button>
                        <Layers className="w-4 h-4 mr-2" />
                        Go to Conferences
                      </Button>
                    </Link>
                  )
                }
              />
            </CardBody>
          </Card>
        ) : filteredSessions.length === 0 ? (
          <Card>
            <CardBody>
              <div className="text-center py-8">
                <Filter className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No matching sessions</h3>
                <p className="text-slate-500 mb-4">Try adjusting your filters to see more results.</p>
                <Button variant="secondary" onClick={() => { setFilterConferenceId(''); setFilterStatus(''); }}>
                  Clear Filters
                </Button>
              </div>
            </CardBody>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredSessions.map((session) => (
              <Card 
                key={session.id} 
                className={`hover:shadow-lg transition-all border-l-4 ${getSessionStatusColor(session.status)}`}
              >
                <CardBody className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-slate-900">{session.name}</h3>
                    <Badge status={session.status}>{session.status}</Badge>
                  </div>
                  
                  {getConferenceName(session.conference_id) && (
                    <Link
                      href={`/conferences/${session.conference_id}`}
                      className="inline-flex items-center gap-2 px-2.5 py-1 bg-primary-50 text-primary-700 rounded-md text-sm font-medium hover:bg-primary-100 transition-colors"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      {getConferenceName(session.conference_id)}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                  
                  {session.description && (
                    <p className="text-sm text-slate-600 line-clamp-2">
                      {session.description}
                    </p>
                  )}
                  
                  <div className="space-y-2 text-sm text-slate-500">
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-2 text-slate-400" />
                      {formatDate(session.start_date)} - {formatDate(session.end_date)}
                    </div>
                    {session.location && (
                      <div className="flex items-center">
                        <MapPin className="w-4 h-4 mr-2 text-slate-400" />
                        {session.location}
                      </div>
                    )}
                    <div className="flex items-center">
                      <Users className="w-4 h-4 mr-2 text-slate-400" />
                      Max {session.max_projects} projects
                    </div>
                  </div>
                  
                  <div className="pt-3 border-t border-slate-100 flex gap-2">
                    <Link href={`/sessions/${session.id}`} className="flex-1">
                      <Button variant="secondary" size="sm" className="w-full group">
                        View Details
                        <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    </Link>
                    {isReviewer && !hasApplied(session.id) && session.status !== 'completed' && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedSession(session);
                          setApplyModal(true);
                        }}
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Apply
                      </Button>
                    )}
                    {isReviewer && hasApplied(session.id) && (
                      <Badge variant="primary">Applied</Badge>
                    )}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Apply Modal */}
      <Modal
        isOpen={applyModal}
        onClose={() => setApplyModal(false)}
        title={`Apply to ${selectedSession?.name}`}
      >
        <form onSubmit={handleApply} className="space-y-4">
          <p className="text-slate-600">
            Submit your application to review projects in this session.
          </p>
          <Textarea
            label="Message (Optional)"
            placeholder="Why would you like to review this session?"
            value={applyMessage}
            onChange={(e) => setApplyMessage(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setApplyModal(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={submitting}>
              <Send className="w-4 h-4 mr-2" />
              Submit Application
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
