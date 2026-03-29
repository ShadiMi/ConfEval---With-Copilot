'use client';

import DashboardLayout from '@/components/DashboardLayout';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import { conferencesApi, sessionsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { extractErrorMessage, formatDate } from '@/lib/utils';

const BUILDINGS = ['לגסי', 'אינשטיין', 'ספרא', 'מינקוף', 'קציר', 'שמעון'] as const;

const floorsForBuilding = (building: string): (number | string)[] => {
  if (building === 'מינקוף') return [1];
  if (building === 'קציר') return ['G-'];
  return [1, 2];
};

const roomsForFloor = (building: string, floor: '' | 1 | 2 | 'G-'): (number | string)[] => {
  if (building === 'מינקוף' && floor === 1) return [104, 105, 106];
  if (building === 'קציר' && floor === 'G-') return ['G-07', 'G-08', 'G-09'];
  if (floor === 1) return Array.from({ length: 9 }, (_, i) => 101 + i);
  if (floor === 2) return Array.from({ length: 9 }, (_, i) => 201 + i);
  return [];
};
import { ConferenceWithSessions, Session } from '@/types';
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  Clock,
  Edit,
  FolderKanban,
  Layers,
  MapPin,
  Plus,
  Settings,
  Trash2,
  Users
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

export default function ConferenceDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const conferenceId = Number(params.id);
  const isAdmin = user?.role === 'admin';
  
  const [conference, setConference] = useState<ConferenceWithSessions | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'sessions'>('sessions');
  
  // Modals
  const [createSessionModal, setCreateSessionModal] = useState(false);
  const [editConferenceModal, setEditConferenceModal] = useState(false);
  const [editSessionModal, setEditSessionModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  
  // Forms
  const [sessionForm, setSessionForm] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    location: '',
    max_projects: 50,
    status: 'upcoming' as string,
  });
  const [conferenceForm, setConferenceForm] = useState<{
    name: string;
    description: string;
    start_date: string;
    end_date: string;
    location: string;
    status: string;
    max_sessions: number;
    building: string;
    floor: '' | 1 | 2 | 'G-';
    room_number: '' | number | string;
  }>({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    location: '',
    status: '',
    max_sessions: 10,
    building: '',
    floor: '',
    room_number: '',
  });

  useEffect(() => {
    setConferenceForm((prev) => ({ ...prev, floor: '', room_number: '' }));
  }, [conferenceForm.building]);

  useEffect(() => {
    setConferenceForm((prev) => ({ ...prev, room_number: '' }));
  }, [conferenceForm.floor]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (conferenceId) {
      loadData();
    }
  }, [conferenceId]);

  const loadData = async () => {
    try {
      const confRes = await conferencesApi.get(conferenceId);
      setConference(confRes.data);
    } catch (error) {
      console.error('Failed to load conference');
      toast.error('Failed to load conference');
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
      upcoming: 'primary',
    };
    return <Badge variant={variants[status] || 'gray'}>{status}</Badge>;
  };

  const getSessionStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      upcoming: 'border-l-blue-500 bg-blue-50/50',
      active: 'border-l-green-500 bg-green-50/50',
      completed: 'border-l-amber-500 bg-amber-50/50',
    };
    return colors[status] || 'border-l-slate-300';
  };

  // Create new session for this conference
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conference) return;
    setSubmitting(true);

    const sessionStart = new Date(sessionForm.start_date);
    const sessionEnd = new Date(sessionForm.end_date);
    const confStart = new Date(conference.start_date);
    const confEnd = new Date(conference.end_date);

    if (sessionStart < confStart || sessionStart > confEnd) {
      toast.error('Session start must be within the conference dates');
      setSubmitting(false);
      return;
    }
    if (sessionEnd < confStart || sessionEnd > confEnd) {
      toast.error('Session end must be within the conference dates');
      setSubmitting(false);
      return;
    }
    if (sessionEnd <= sessionStart) {
      toast.error('Session end must be after session start');
      setSubmitting(false);
      return;
    }
    
    try {
      await sessionsApi.create({
        ...sessionForm,
        start_date: sessionStart.toISOString(),
        end_date: sessionEnd.toISOString(),
        conference_id: conferenceId,
      });
      toast.success('Session created successfully');
      setCreateSessionModal(false);
      setSessionForm({
        name: '',
        description: '',
        start_date: '',
        end_date: '',
        location: '',
        max_projects: 50,
        status: 'upcoming',
      });
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to create session');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete session permanently
  const handleDeleteSession = async (sessionId: number, sessionName: string) => {
    if (!confirm(`Are you sure you want to delete the session "${sessionName}"? This action cannot be undone.`)) return;
    
    try {
      await sessionsApi.delete(sessionId);
      toast.success('Session deleted successfully');
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to delete session');
    }
  };

  // Open edit session modal
  const openEditSession = (session: Session) => {
    setSelectedSession(session);
    setSessionForm({
      name: session.name,
      description: session.description || '',
      start_date: session.start_date.slice(0, 16),
      end_date: session.end_date.slice(0, 16),
      location: session.location || '',
      max_projects: session.max_projects,
      status: session.status,
    });
    setEditSessionModal(true);
  };

  // Update session
  const handleUpdateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession || !conference) return;
    
    setSubmitting(true);

    const sessionStart = new Date(sessionForm.start_date);
    const sessionEnd = new Date(sessionForm.end_date);
    const confStart = new Date(conference.start_date);
    const confEnd = new Date(conference.end_date);

    if (sessionStart < confStart || sessionStart > confEnd) {
      toast.error('Session start must be within the conference dates');
      setSubmitting(false);
      return;
    }
    if (sessionEnd < confStart || sessionEnd > confEnd) {
      toast.error('Session end must be within the conference dates');
      setSubmitting(false);
      return;
    }
    if (sessionEnd <= sessionStart) {
      toast.error('Session end must be after session start');
      setSubmitting(false);
      return;
    }

    try {
      await sessionsApi.update(selectedSession.id, {
        ...sessionForm,
        start_date: sessionStart.toISOString(),
        end_date: sessionEnd.toISOString(),
      });
      toast.success('Session updated successfully');
      setEditSessionModal(false);
      setSelectedSession(null);
      setSessionForm({
        name: '',
        description: '',
        start_date: '',
        end_date: '',
        location: '',
        max_projects: 50,
        status: 'upcoming',
      });
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to update session');
    } finally {
      setSubmitting(false);
    }
  };

  // Edit conference
  const openEditConference = () => {
    if (!conference) return;
    setConferenceForm({
      name: conference.name,
      description: conference.description || '',
      start_date: conference.start_date.slice(0, 16),
      end_date: conference.end_date.slice(0, 16),
      location: conference.location || '',
      status: conference.status,
      max_sessions: conference.max_sessions,
      building: conference.building || '',
      floor: (conference.floor ?? '') as '' | 1 | 2 | 'G-',
      room_number: (conference.room_number ?? '') as '' | number | string,
    });
    setEditConferenceModal(true);
  };

  const handleUpdateConference = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const hasAny = !!(conferenceForm.building || conferenceForm.floor || conferenceForm.room_number);
    const hasAll = !!(conferenceForm.building && conferenceForm.floor !== '' && conferenceForm.room_number !== '');

    if (hasAny && !hasAll) {
      toast.error('בחר בניין + קומה + חדר (חובה ביחד)');
      setSubmitting(false);
      return;
    }

    const isNonStandardBuilding = conferenceForm.building === 'קציר';

    const computedLocation = hasAll
      ? `${conferenceForm.building}, קומה ${conferenceForm.floor}, חדר ${conferenceForm.room_number}`
      : undefined;

    try {
      await conferencesApi.update(conferenceId, {
        name: conferenceForm.name,
        description: conferenceForm.description,
        start_date: new Date(conferenceForm.start_date).toISOString(),
        end_date: new Date(conferenceForm.end_date).toISOString(),
        status: conferenceForm.status,
        max_sessions: conferenceForm.max_sessions,
        building: isNonStandardBuilding ? undefined : (conferenceForm.building || undefined),
        floor: isNonStandardBuilding ? undefined : (conferenceForm.floor === '' ? undefined : conferenceForm.floor as number),
        room_number: isNonStandardBuilding ? undefined : (conferenceForm.room_number === '' ? undefined : Number(conferenceForm.room_number)),
        location: isNonStandardBuilding ? computedLocation : undefined,
      });
      toast.success('Conference updated successfully');
      setEditConferenceModal(false);
      loadData();
    } catch (error: any) {
      toast.error(extractErrorMessage(error, 'Failed to update conference'));
    } finally {
      setSubmitting(false);
    }
  };

  // Delete conference
  const handleDeleteConference = async () => {
    if (!confirm('Are you sure you want to delete this conference? This action cannot be undone.')) return;
    
    try {
      await conferencesApi.delete(conferenceId);
      toast.success('Conference deleted');
      router.push('/conferences');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to delete conference');
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
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
            <Button variant="secondary">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Conferences
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const canAddMoreSessions = conference.session_count < conference.max_sessions;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Back Button & Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <Link href="/conferences" className="inline-flex items-center text-slate-600 hover:text-slate-900 mb-3">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Conferences
            </Link>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-slate-900">{conference.name}</h1>
              {getStatusBadge(conference.status)}
            </div>
            {conference.description && (
              <p className="text-slate-600 max-w-2xl">{conference.description}</p>
            )}
          </div>
          
          {isAdmin && (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={openEditConference}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button variant="danger" size="sm" onClick={handleDeleteConference}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          )}
        </div>

        {/* Conference Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-primary-50 to-white border-primary-100">
            <CardBody className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Duration</p>
                <p className="font-semibold text-slate-900 text-sm">
                  {formatDate(conference.start_date)} - {formatDate(conference.end_date)}
                </p>
              </div>
            </CardBody>
          </Card>
          
          {conference.location && (
            <Card className="bg-gradient-to-br from-green-50 to-white border-green-100">
              <CardBody className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Location</p>
                  <p className="font-semibold text-slate-900">{conference.location}</p>
                </div>
              </CardBody>
            </Card>
          )}
          
          <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100">
            <CardBody className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <Layers className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Sessions</p>
                <p className="font-semibold text-slate-900">
                  {conference.session_count} / {conference.max_sessions}
                </p>
              </div>
            </CardBody>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-100">
            <CardBody className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <FolderKanban className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Projects</p>
                <p className="font-semibold text-slate-900">
                  {conference.sessions.reduce((acc, s) => acc + (s.max_projects || 0), 0)}
                </p>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200">
          <nav className="flex gap-6">
            <button
              onClick={() => setActiveTab('sessions')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'sessions'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Layers className="w-4 h-4 inline mr-2" />
              Sessions ({conference.sessions.length})
            </button>
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'overview'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Settings className="w-4 h-4 inline mr-2" />
              Overview
            </button>
          </nav>
        </div>

        {/* Sessions Tab Content */}
        {activeTab === 'sessions' && (
          <div className="space-y-4">
            {/* Session Actions */}
            {isAdmin && canAddMoreSessions && (
              <Button onClick={() => {
                const confStart = conference.start_date?.slice(0, 16) || '';
                setSessionForm(prev => ({ ...prev, location: conference.location || '', start_date: confStart, end_date: confStart }));
                setCreateSessionModal(true);
              }}>
                <Plus className="w-4 h-4 mr-2" />
                Create New Session
              </Button>
            )}
            
            {!canAddMoreSessions && isAdmin && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <Layers className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium text-amber-800">Session limit reached</p>
                  <p className="text-sm text-amber-600">
                    This conference has reached its maximum of {conference.max_sessions} sessions.
                    Edit the conference to increase the limit.
                  </p>
                </div>
              </div>
            )}

            {/* Sessions Grid */}
            {conference.sessions.length === 0 ? (
              <Card>
                <CardBody>
                  <div className="text-center py-12">
                    <Calendar className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 mb-2">No sessions yet</h3>
                    <p className="text-slate-500 mb-6">
                      {isAdmin 
                        ? 'Create your first session for this conference.'
                        : 'Sessions will be added to this conference soon.'}
                    </p>
                    {isAdmin && (
                      <Button onClick={() => {
                        const confStart = conference.start_date?.slice(0, 16) || '';
                        setSessionForm(prev => ({ ...prev, location: conference.location || '', start_date: confStart, end_date: confStart }));
                        setCreateSessionModal(true);
                      }}>
                        <Plus className="w-4 h-4 mr-2" />
                        Create First Session
                      </Button>
                    )}
                  </div>
                </CardBody>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {conference.sessions.map((session) => (
                  <Card 
                    key={session.id} 
                    className={`hover:shadow-lg transition-all border-l-4 ${getSessionStatusColor(session.status)}`}
                  >
                    <CardBody className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-900 text-lg">{session.name}</h3>
                          {getStatusBadge(session.status)}
                        </div>
                        {isAdmin && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditSession(session)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                              title="Edit session"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteSession(session.id, session.name)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              title="Delete session"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                      
                      {session.description && (
                        <p className="text-sm text-slate-600 line-clamp-2">{session.description}</p>
                      )}
                      
                      <div className="space-y-2">
                        <div className="flex items-center text-sm text-slate-500">
                          <Clock className="w-4 h-4 mr-2 text-slate-400" />
                          <span>{formatDate(session.start_date)} - {formatDate(session.end_date)}</span>
                        </div>
                        {session.location && (
                          <div className="flex items-center text-sm text-slate-500">
                            <MapPin className="w-4 h-4 mr-2 text-slate-400" />
                            <span>{session.location}</span>
                          </div>
                        )}
                        <div className="flex items-center text-sm text-slate-500">
                          <Users className="w-4 h-4 mr-2 text-slate-400" />
                          <span>Max {session.max_projects} projects</span>
                        </div>
                      </div>
                      
                      <Link href={`/sessions/${session.id}`} className="block">
                        <Button variant="secondary" size="sm" className="w-full group">
                          View Session Details
                          <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                        </Button>
                      </Link>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Overview Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-slate-900">Conference Details</h3>
              </CardHeader>
              <CardBody className="space-y-4">
                <div>
                  <label className="text-sm text-slate-500">Name</label>
                  <p className="font-medium text-slate-900">{conference.name}</p>
                </div>
                <div>
                  <label className="text-sm text-slate-500">Description</label>
                  <p className="text-slate-700">{conference.description || 'No description provided'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-500">Start Date</label>
                    <p className="font-medium text-slate-900">{formatDate(conference.start_date)}</p>
                  </div>
                  <div>
                    <label className="text-sm text-slate-500">End Date</label>
                    <p className="font-medium text-slate-900">{formatDate(conference.end_date)}</p>
                  </div>
                </div>
                {conference.location && (
                  <div>
                    <label className="text-sm text-slate-500">Location</label>
                    <p className="font-medium text-slate-900">{conference.location}</p>
                  </div>
                )}
              </CardBody>
            </Card>
            
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-slate-900">Session Summary</h3>
              </CardHeader>
              <CardBody className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-600">Total Sessions</span>
                  <span className="font-semibold text-slate-900">{conference.session_count}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-600">Max Sessions Allowed</span>
                  <span className="font-semibold text-slate-900">{conference.max_sessions}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <span className="text-green-700">Active Sessions</span>
                  <span className="font-semibold text-green-700">
                    {conference.sessions.filter(s => s.status === 'active').length}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                  <span className="text-blue-700">Upcoming Sessions</span>
                  <span className="font-semibold text-blue-700">
                    {conference.sessions.filter(s => s.status === 'upcoming').length}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg">
                  <span className="text-amber-700">Completed Sessions</span>
                  <span className="font-semibold text-amber-700">
                    {conference.sessions.filter(s => s.status === 'completed').length}
                  </span>
                </div>
              </CardBody>
            </Card>
          </div>
        )}
      </div>

      {/* Create Session Modal */}
      <Modal
        isOpen={createSessionModal}
        onClose={() => setCreateSessionModal(false)}
        title="Create New Session"
        size="lg"
      >
        <form onSubmit={handleCreateSession} className="space-y-4">
          <div className="bg-primary-50 border border-primary-100 rounded-lg p-3 mb-4">
            <p className="text-sm text-primary-700">
              <Layers className="w-4 h-4 inline mr-2" />
              This session will be automatically linked to <strong>{conference.name}</strong>
            </p>
          </div>
          
          <Input
            label="Session Name"
            placeholder="e.g., Morning Presentations"
            value={sessionForm.name}
            onChange={(e) => setSessionForm({ ...sessionForm, name: e.target.value })}
            required
          />
          <Textarea
            label="Description"
            placeholder="Describe the session..."
            value={sessionForm.description}
            onChange={(e) => setSessionForm({ ...sessionForm, description: e.target.value })}
            rows={3}
          />
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
            <Calendar className="w-4 h-4 inline mr-1 text-slate-400" />
            Conference dates: <strong>{formatDate(conference.start_date)}</strong> — <strong>{formatDate(conference.end_date)}</strong>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              type="datetime-local"
              label="Start Date & Time"
              value={sessionForm.start_date}
              onChange={(e) => setSessionForm({ ...sessionForm, start_date: e.target.value })}
              min={conference.start_date?.slice(0, 16)}
              max={conference.end_date?.slice(0, 16)}
              required
            />
            <Input
              type="datetime-local"
              label="End Date & Time"
              value={sessionForm.end_date}
              onChange={(e) => setSessionForm({ ...sessionForm, end_date: e.target.value })}
              min={sessionForm.start_date || conference.start_date?.slice(0, 16)}
              max={conference.end_date?.slice(0, 16)}
              required
            />
          </div>
          <Input
            label="Location"
            placeholder="e.g., Room 101, Building A"
            value={sessionForm.location}
            onChange={(e) => setSessionForm({ ...sessionForm, location: e.target.value })}
          />
          <Input
            type="number"
            label="Maximum Projects"
            value={sessionForm.max_projects}
            onChange={(e) => setSessionForm({ ...sessionForm, max_projects: parseInt(e.target.value) || 50 })}
            min={1}
            required
          />
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button type="button" variant="secondary" onClick={() => setCreateSessionModal(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={submitting}>
              <Plus className="w-4 h-4 mr-2" />
              Create Session
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Session Modal */}
      <Modal
        isOpen={editSessionModal}
        onClose={() => { setEditSessionModal(false); setSelectedSession(null); }}
        title="Edit Session"
        size="lg"
      >
        <form onSubmit={handleUpdateSession} className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4">
            <p className="text-sm text-blue-700">
              <Edit className="w-4 h-4 inline mr-2" />
              Editing session in <strong>{conference.name}</strong>
            </p>
          </div>
          
          <Input
            label="Session Name"
            placeholder="e.g., Morning Presentations"
            value={sessionForm.name}
            onChange={(e) => setSessionForm({ ...sessionForm, name: e.target.value })}
            required
          />
          <Textarea
            label="Description"
            placeholder="Describe the session..."
            value={sessionForm.description}
            onChange={(e) => setSessionForm({ ...sessionForm, description: e.target.value })}
            rows={3}
          />
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
            <Calendar className="w-4 h-4 inline mr-1 text-slate-400" />
            Conference dates: <strong>{formatDate(conference.start_date)}</strong> — <strong>{formatDate(conference.end_date)}</strong>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              type="datetime-local"
              label="Start Date & Time"
              value={sessionForm.start_date}
              onChange={(e) => setSessionForm({ ...sessionForm, start_date: e.target.value })}
              min={conference.start_date?.slice(0, 16)}
              max={conference.end_date?.slice(0, 16)}
              required
            />
            <Input
              type="datetime-local"
              label="End Date & Time"
              value={sessionForm.end_date}
              onChange={(e) => setSessionForm({ ...sessionForm, end_date: e.target.value })}
              min={sessionForm.start_date || conference.start_date?.slice(0, 16)}
              max={conference.end_date?.slice(0, 16)}
              required
            />
          </div>
          <Input
            label="Location"
            placeholder="e.g., Room 101, Building A"
            value={sessionForm.location}
            onChange={(e) => setSessionForm({ ...sessionForm, location: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              type="number"
              label="Maximum Projects"
              value={sessionForm.max_projects}
              onChange={(e) => setSessionForm({ ...sessionForm, max_projects: parseInt(e.target.value) || 50 })}
              min={1}
              required
            />
            <Select
              label="Status"
              value={sessionForm.status}
              onChange={(e) => setSessionForm({ ...sessionForm, status: e.target.value })}
              options={[
                { value: 'upcoming', label: 'Upcoming' },
                { value: 'active', label: 'Active' },
                { value: 'completed', label: 'Completed' },
              ]}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button type="button" variant="secondary" onClick={() => { setEditSessionModal(false); setSelectedSession(null); }}>
              Cancel
            </Button>
            <Button type="submit" isLoading={submitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Conference Modal */}
      <Modal
        isOpen={editConferenceModal}
        onClose={() => setEditConferenceModal(false)}
        title="Edit Conference"
        size="lg"
      >
        <form onSubmit={handleUpdateConference} className="space-y-5">
          <Input
            label="Conference Name"
            value={conferenceForm.name}
            onChange={(e) => setConferenceForm({ ...conferenceForm, name: e.target.value })}
            required
          />
          <Textarea
            label="Description"
            value={conferenceForm.description}
            onChange={(e) => setConferenceForm({ ...conferenceForm, description: e.target.value })}
            rows={3}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              type="datetime-local"
              label="Start Date & Time"
              value={conferenceForm.start_date}
              onChange={(e) => setConferenceForm({ ...conferenceForm, start_date: e.target.value })}
              required
            />
            <Input
              type="datetime-local"
              label="End Date & Time"
              value={conferenceForm.end_date}
              onChange={(e) => setConferenceForm({ ...conferenceForm, end_date: e.target.value })}
              required
            />
          </div>

          <div className="p-4 bg-slate-50 rounded-lg space-y-4">
            <p className="text-sm font-medium text-slate-700">Location</p>
            <div className="grid grid-cols-3 gap-3">
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={conferenceForm.building}
                onChange={(e) => setConferenceForm({ ...conferenceForm, building: e.target.value })}
              >
                <option value="">Building</option>
                {BUILDINGS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={conferenceForm.floor}
                onChange={(e) => {
                  const val = e.target.value;
                  const floor = val === '' ? '' : val === 'G-' ? 'G-' : Number(val) as 1 | 2;
                  setConferenceForm({ ...conferenceForm, floor });
                }}
                disabled={!conferenceForm.building}
              >
                <option value="">Floor</option>
                {floorsForBuilding(conferenceForm.building).map((f) => <option key={String(f)} value={String(f)}>Floor {f}</option>)}
              </select>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={conferenceForm.room_number}
                onChange={(e) => {
                  const val = e.target.value;
                  const room = val === '' ? '' : (typeof val === 'string' && val.startsWith('G-')) ? val : Number(val);
                  setConferenceForm({ ...conferenceForm, room_number: room });
                }}
                disabled={!conferenceForm.floor}
              >
                <option value="">Room</option>
                {roomsForFloor(conferenceForm.building, conferenceForm.floor).map((r) => <option key={String(r)} value={String(r)}>{r}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Status"
              value={conferenceForm.status}
              onChange={(e) => setConferenceForm({ ...conferenceForm, status: e.target.value })}
              options={[
                { value: 'draft', label: 'Draft' },
                { value: 'active', label: 'Active' },
                { value: 'completed', label: 'Completed' },
                { value: 'archived', label: 'Archived' },
              ]}
            />
            <Input
              type="number"
              label="Max Sessions"
              value={conferenceForm.max_sessions}
              onChange={(e) => setConferenceForm({ ...conferenceForm, max_sessions: parseInt(e.target.value) || 10 })}
              min={conference.session_count}
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button type="button" variant="secondary" onClick={() => setEditConferenceModal(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={submitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
