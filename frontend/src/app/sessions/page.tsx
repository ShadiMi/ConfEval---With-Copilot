'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import EmptyState from '@/components/ui/EmptyState';
import { useAuthStore } from '@/lib/store';
import { sessionsApi, applicationsApi } from '@/lib/api';
import { Session, ReviewerApplication } from '@/types';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  Calendar,
  MapPin,
  Users,
  Plus,
  Clock,
  Send,
} from 'lucide-react';

export default function SessionsPage() {
  const { user } = useAuthStore();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(false);
  const [applyModal, setApplyModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [myApplications, setMyApplications] = useState<ReviewerApplication[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    location: '',
    max_projects: 50,
  });
  const [applyMessage, setApplyMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [sessionsRes, appsRes] = await Promise.all([
        sessionsApi.list(),
        user?.role === 'internal_reviewer' || user?.role === 'external_reviewer'
          ? applicationsApi.getMyApplications()
          : Promise.resolve({ data: [] }),
      ]);
      setSessions(sessionsRes.data);
      setMyApplications(appsRes.data);
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      await sessionsApi.create({
        ...formData,
        start_date: new Date(formData.start_date).toISOString(),
        end_date: new Date(formData.end_date).toISOString(),
      });
      toast.success('Session created successfully');
      setCreateModal(false);
      setFormData({
        name: '',
        description: '',
        start_date: '',
        end_date: '',
        location: '',
        max_projects: 50,
      });
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to create session');
    } finally {
      setSubmitting(false);
    }
  };

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sessions</h1>
          <p className="text-slate-600 mt-1">Browse conference sessions</p>
        </div>
        {user?.role === 'admin' && (
          <Button onClick={() => setCreateModal(true)} className="mt-4 sm:mt-0">
            <Plus className="w-4 h-4 mr-2" />
            New Session
          </Button>
        )}
      </div>

      {sessions.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<Calendar className="w-12 h-12" />}
              title="No Sessions Found"
              description="There are no sessions available at the moment."
              action={
                user?.role === 'admin' && (
                  <Button onClick={() => setCreateModal(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Session
                  </Button>
                )
              }
            />
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => (
            <Card key={session.id} className="hover:shadow-md transition-shadow">
              <CardBody>
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-slate-900">{session.name}</h3>
                  <Badge status={session.status}>{session.status}</Badge>
                </div>
                
                {session.description && (
                  <p className="text-sm text-slate-600 mb-4 line-clamp-2">
                    {session.description}
                  </p>
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
                
                <div className="mt-4 pt-4 border-t border-slate-100 flex gap-2">
                  <Link href={`/sessions/${session.id}`} className="flex-1">
                    <Button variant="secondary" className="w-full">
                      View Details
                    </Button>
                  </Link>
                  {isReviewer && !hasApplied(session.id) && session.status !== 'completed' && (
                    <Button
                      onClick={() => {
                        setSelectedSession(session);
                        setApplyModal(true);
                      }}
                      className="flex-1"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Apply
                    </Button>
                  )}
                  {isReviewer && hasApplied(session.id) && (
                    <div className="flex items-center">
                      <Badge variant="primary">Applied</Badge>
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Create Session Modal */}
      <Modal
        isOpen={createModal}
        onClose={() => setCreateModal(false)}
        title="Create New Session"
        size="lg"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Session Name"
            placeholder="Spring 2026 Conference"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Textarea
            label="Description"
            placeholder="Describe the session..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              type="datetime-local"
              label="Start Date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              required
            />
            <Input
              type="datetime-local"
              label="End Date"
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              required
            />
          </div>
          <Input
            label="Location"
            placeholder="Main Conference Hall"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
          />
          <Input
            type="number"
            label="Max Projects"
            value={formData.max_projects}
            onChange={(e) => setFormData({ ...formData, max_projects: parseInt(e.target.value) })}
            min={1}
            required
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setCreateModal(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={submitting}>
              Create Session
            </Button>
          </div>
        </form>
      </Modal>

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
