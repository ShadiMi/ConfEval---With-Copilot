'use client';

import DashboardLayout from '@/components/DashboardLayout';
import Button from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Textarea from '@/components/ui/Textarea';
import { conferencesApi, sessionsApi } from '@/lib/api';
import { extractErrorMessage, formatDate } from '@/lib/utils';
import { Conference, ConferenceWithSessions, Session } from '@/types';
import {
    Calendar,
    CheckCircle2,
    ChevronRight,
    Clock,
    Edit3,
    Layers,
    MapPin,
    Plus,
    Search,
    Trash2,
    Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

const BUILDINGS = ['לגסי', 'אינשטיין', 'ספרא', 'מינקוף', 'קציר', 'שמעון'] as const;

const roomsForFloor = (floor: '' | 1 | 2) => {
  if (floor === 1) return Array.from({ length: 9 }, (_, i) => 101 + i);
  if (floor === 2) return Array.from({ length: 9 }, (_, i) => 201 + i);
  return [];
};

export default function ConferencesPage() {
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showCreateSessionModal, setShowCreateSessionModal] = useState(false);

  const [selectedConference, setSelectedConference] = useState<ConferenceWithSessions | null>(null);

  const [sessionForm, setSessionForm] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    location: '',
    max_projects: 50,
  });

  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    start_date: string;
    end_date: string;
    location: string;
    max_sessions: number;
    building: string;
    floor: '' | 1 | 2;
    room_number: '' | number;
  }>({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    location: '',
    max_sessions: 10,
    building: '',
    floor: '',
    room_number: '',
  });

  useEffect(() => {
    loadConferences();
    loadSessions();
  }, []);

  useEffect(() => {
    setFormData((prev) => ({ ...prev, room_number: '' }));
  }, [formData.floor]);

  const loadConferences = async () => {
    try {
      const res = await conferencesApi.list();
      setConferences(res.data);
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Failed to load conferences'));
    } finally {
      setLoading(false);
    }
  };

  const loadSessions = async () => {
    try {
      const res = await sessionsApi.list();
      setSessions(res.data);
    } catch (error) {
      console.error('Failed to load sessions', error);
    }
  };

  const handleCreate = async () => {
    try {
      const computedLocation =
        formData.location?.trim() ||
        (formData.building && formData.floor && formData.room_number
          ? `${formData.building}, קומה ${formData.floor}, חדר ${formData.room_number}`
          : undefined);

      await conferencesApi.create({
        name: formData.name,
        description: formData.description,
        start_date: new Date(formData.start_date).toISOString(),
        end_date: new Date(formData.end_date).toISOString(),
        max_sessions: formData.max_sessions,
        location: computedLocation,
      });

      toast.success('Conference created successfully');
      setShowCreateModal(false);
      resetForm();
      loadConferences();
    } catch (error: any) {
      toast.error(extractErrorMessage(error, 'Failed to create conference'));
    }
  };

  const handleUpdate = async () => {
    if (!selectedConference) return;

    const hasAny = !!(formData.building || formData.floor || formData.room_number);
    const hasAll = !!(formData.building && formData.floor !== '' && formData.room_number !== '');

    if (hasAny && !hasAll) {
      toast.error('בחר בניין + קומה + חדר (חובה ביחד)');
      return;
    }

    try {
      await conferencesApi.update(selectedConference.id, {
        name: formData.name,
        description: formData.description,
        start_date: new Date(formData.start_date).toISOString(),
        end_date: new Date(formData.end_date).toISOString(),
        max_sessions: formData.max_sessions,
        building: formData.building || undefined,
        floor: formData.floor === '' ? undefined : formData.floor,
        room_number: formData.room_number === '' ? undefined : Number(formData.room_number),
        location: undefined,
      });

      toast.success('Conference updated successfully');
      setShowEditModal(false);
      resetForm();
      loadConferences();
    } catch (error: any) {
      toast.error(extractErrorMessage(error, 'Failed to update conference'));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this conference?')) return;
    try {
      await conferencesApi.delete(id);
      toast.success('Conference deleted successfully');
      loadConferences();
    } catch (error: any) {
      toast.error(extractErrorMessage(error, 'Failed to delete conference'));
    }
  };

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await conferencesApi.update(id, { status });
      toast.success('Status updated');
      loadConferences();
    } catch (error: any) {
      toast.error(extractErrorMessage(error, 'Failed to update status'));
    }
  };

  const handleViewDetails = async (conference: Conference) => {
    try {
      const res = await conferencesApi.get(conference.id);
      setSelectedConference(res.data);
      setShowDetailsModal(true);
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Failed to load conference details'));
    }
  };

  const handleCreateSession = async () => {
    if (!selectedConference) return;
    try {
      await sessionsApi.create({
        ...sessionForm,
        start_date: new Date(sessionForm.start_date).toISOString(),
        end_date: new Date(sessionForm.end_date).toISOString(),
        conference_id: selectedConference.id,
      });
      toast.success('Session created successfully');
      setShowCreateSessionModal(false);
      setSessionForm({
        name: '',
        description: '',
        start_date: '',
        end_date: '',
        location: '',
        max_projects: 50,
      });
      const res = await conferencesApi.get(selectedConference.id);
      setSelectedConference(res.data);
      loadSessions();
    } catch (error: any) {
      toast.error(extractErrorMessage(error, 'Failed to create session'));
    }
  };

  const handleDeleteSession = async (sessionId: number) => {
    if (!confirm('Are you sure you want to delete this session?')) return;
    try {
      await sessionsApi.delete(sessionId);
      toast.success('Session deleted');
      if (selectedConference) {
        const res = await conferencesApi.get(selectedConference.id);
        setSelectedConference(res.data);
      }
      loadSessions();
    } catch (error: any) {
      toast.error(extractErrorMessage(error, 'Failed to delete session'));
    }
  };

  const openEditModal = (conference: Conference) => {
    setSelectedConference(conference as ConferenceWithSessions);
    setFormData({
      name: conference.name,
      description: conference.description || '',
      start_date: conference.start_date.slice(0, 16),
      end_date: conference.end_date.slice(0, 16),
      location: conference.location || '',
      max_sessions: conference.max_sessions,
      building: (conference as any).building || '',
      floor: ((conference as any).floor ?? '') as '' | 1 | 2,
      room_number: ((conference as any).room_number ?? '') as '' | number,
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      start_date: '',
      end_date: '',
      location: '',
      max_sessions: 10,
      building: '',
      floor: '',
      room_number: '',
    });
    setSelectedConference(null);
  };

  // Filter conferences
  const filteredConferences = conferences.filter((conf) => {
    const matchesSearch = conf.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conf.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || conf.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const stats = {
    total: conferences.length,
    active: conferences.filter((c) => c.status === 'active').length,
    draft: conferences.filter((c) => c.status === 'draft').length,
    completed: conferences.filter((c) => c.status === 'completed').length,
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-slate-100 text-slate-700 border-slate-200',
      active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      completed: 'bg-amber-50 text-amber-700 border-amber-200',
      archived: 'bg-red-50 text-red-700 border-red-200',
    };
    return colors[status] || 'bg-slate-100 text-slate-700';
  };

  const getStatusIcon = (status: string) => {
    const icons: Record<string, React.ReactNode> = {
      draft: <Clock className="w-3.5 h-3.5" />,
      active: <CheckCircle2 className="w-3.5 h-3.5" />,
      completed: <CheckCircle2 className="w-3.5 h-3.5" />,
    };
    return icons[status] || null;
  };

  if (loading) {
    return (
      <DashboardLayout allowedRoles={['admin']}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout allowedRoles={['admin']}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Conferences</h1>
            <p className="text-slate-500 mt-1">Manage your conferences and their sessions</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)} className="w-fit">
            <Plus className="w-5 h-5 mr-2" />
            New Conference
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
            <CardBody className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Layers className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-3xl font-bold text-blue-900">{stats.total}</p>
                <p className="text-sm text-blue-600">Total</p>
              </div>
            </CardBody>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200">
            <CardBody className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-3xl font-bold text-emerald-900">{stats.active}</p>
                <p className="text-sm text-emerald-600">Active</p>
              </div>
            </CardBody>
          </Card>
          <Card className="bg-gradient-to-br from-slate-50 to-slate-100/50 border-slate-200">
            <CardBody className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-slate-500 flex items-center justify-center shadow-lg shadow-slate-500/30">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-900">{stats.draft}</p>
                <p className="text-sm text-slate-600">Draft</p>
              </div>
            </CardBody>
          </Card>
          <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200">
            <CardBody className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-3xl font-bold text-amber-900">{stats.completed}</p>
                <p className="text-sm text-amber-600">Completed</p>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Search & Filters */}
        <Card>
          <CardBody className="flex flex-col sm:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search conferences..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-2">
              {['all', 'draft', 'active', 'completed'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    filterStatus === status
                      ? 'bg-primary-600 text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Conferences List */}
        {filteredConferences.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardBody className="text-center py-16">
              <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-6">
                <Layers className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                {searchQuery || filterStatus !== 'all' ? 'No conferences found' : 'No conferences yet'}
              </h3>
              <p className="text-slate-500 mb-6 max-w-md mx-auto">
                {searchQuery || filterStatus !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Create your first conference to start organizing sessions'}
              </p>
              {!searchQuery && filterStatus === 'all' && (
                <Button onClick={() => setShowCreateModal(true)}>
                  <Plus className="w-5 h-5 mr-2" />
                  Create Conference
                </Button>
              )}
            </CardBody>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Conference</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Location</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Sessions</th>
                    <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredConferences.map((conference) => (
                    <tr
                      key={conference.id}
                      className="group hover:bg-slate-50 transition-colors"
                    >
                      {/* Conference Name & Description */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-1 h-12 rounded-full ${
                            conference.status === 'active' ? 'bg-emerald-500' :
                            conference.status === 'completed' ? 'bg-amber-500' :
                            conference.status === 'archived' ? 'bg-red-500' : 'bg-slate-300'
                          }`} />
                          <div>
                            <h3 className="font-semibold text-slate-900 group-hover:text-primary-600 transition-colors">
                              {conference.name}
                            </h3>
                            {conference.description && (
                              <p className="text-sm text-slate-500 line-clamp-1 max-w-xs">{conference.description}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(conference.status)}`}>
                          {getStatusIcon(conference.status)}
                          {conference.status}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span>{formatDate(conference.start_date).split(',')[0]}</span>
                        </div>
                      </td>

                      {/* Location */}
                      <td className="px-6 py-4">
                        {conference.location ? (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <MapPin className="w-4 h-4 text-slate-400" />
                            <span className="max-w-[150px] truncate">{conference.location}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-sm">—</span>
                        )}
                      </td>

                      {/* Sessions */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Users className="w-4 h-4 text-slate-400" />
                          <span>Max {conference.max_sessions}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          {conference.status === 'draft' && (
                            <Button
                              size="sm"
                              onClick={() => handleStatusChange(conference.id, 'active')}
                              className="bg-emerald-600 hover:bg-emerald-700 text-xs px-2 py-1"
                            >
                              Activate
                            </Button>
                          )}
                          {conference.status === 'active' && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleStatusChange(conference.id, 'completed')}
                              className="text-xs px-2 py-1"
                            >
                              Complete
                            </Button>
                          )}
                          <button
                            onClick={() => handleViewDetails(conference)}
                            className="p-2 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                            title="View & Manage Sessions"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => openEditModal(conference)}
                            className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Edit"
                          >
                            <Edit3 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(conference.id)}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Create Conference Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => { setShowCreateModal(false); resetForm(); }}
        title="Create New Conference"
        size="lg"
      >
        <div className="space-y-5">
          <Input
            label="Conference Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Spring Research Conference 2026"
            required
          />

          <Textarea
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Brief description of the conference..."
            rows={3}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date & Time"
              type="datetime-local"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              required
            />
            <Input
              label="End Date & Time"
              type="datetime-local"
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              required
            />
          </div>

          <div className="p-4 bg-slate-50 rounded-lg space-y-4">
            <p className="text-sm font-medium text-slate-700">Location</p>
            <div className="grid grid-cols-3 gap-3">
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={formData.building}
                onChange={(e) => setFormData({ ...formData, building: e.target.value })}
              >
                <option value="">Building</option>
                {BUILDINGS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={formData.floor}
                onChange={(e) => setFormData({ ...formData, floor: (e.target.value ? Number(e.target.value) : '') as '' | 1 | 2 })}
              >
                <option value="">Floor</option>
                <option value="1">Floor 1</option>
                <option value="2">Floor 2</option>
              </select>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={formData.room_number}
                onChange={(e) => setFormData({ ...formData, room_number: e.target.value ? Number(e.target.value) : '' })}
                disabled={!formData.floor}
              >
                <option value="">Room</option>
                {roomsForFloor(formData.floor).map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <Input
            type="number"
            label="Maximum Sessions"
            value={formData.max_sessions}
            onChange={(e) => setFormData({ ...formData, max_sessions: parseInt(e.target.value) || 10 })}
            min={1}
            required
          />

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => { setShowCreateModal(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Create Conference
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Conference Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); resetForm(); }}
        title="Edit Conference"
        size="lg"
      >
        <div className="space-y-5">
          <Input
            label="Conference Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <Textarea
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date & Time"
              type="datetime-local"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              required
            />
            <Input
              label="End Date & Time"
              type="datetime-local"
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              required
            />
          </div>

          <div className="p-4 bg-slate-50 rounded-lg space-y-4">
            <p className="text-sm font-medium text-slate-700">Location</p>
            <div className="grid grid-cols-3 gap-3">
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                value={formData.building}
                onChange={(e) => setFormData({ ...formData, building: e.target.value })}
              >
                <option value="">Building</option>
                {BUILDINGS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                value={formData.floor}
                onChange={(e) => setFormData({ ...formData, floor: (e.target.value ? Number(e.target.value) : '') as '' | 1 | 2 })}
              >
                <option value="">Floor</option>
                <option value="1">Floor 1</option>
                <option value="2">Floor 2</option>
              </select>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
                value={formData.room_number}
                onChange={(e) => setFormData({ ...formData, room_number: e.target.value ? Number(e.target.value) : '' })}
                disabled={!formData.floor}
              >
                <option value="">Room</option>
                {roomsForFloor(formData.floor).map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <Input
            type="number"
            label="Maximum Sessions"
            value={formData.max_sessions}
            onChange={(e) => setFormData({ ...formData, max_sessions: parseInt(e.target.value) || 10 })}
            min={1}
            required
          />

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => { setShowEditModal(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleUpdate}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      {/* Conference Details Modal */}
      <Modal
        isOpen={showDetailsModal}
        onClose={() => { setShowDetailsModal(false); setSelectedConference(null); }}
        title={selectedConference?.name || 'Conference Details'}
        size="lg"
      >
        {selectedConference && (
          <div className="space-y-6">
            {/* Conference Info */}
            <div className="p-4 bg-gradient-to-r from-primary-50 to-blue-50 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(selectedConference.status)}`}>
                  {getStatusIcon(selectedConference.status)}
                  {selectedConference.status}
                </span>
                <span className="text-sm text-slate-500">
                  {selectedConference.session_count || 0} / {selectedConference.max_sessions} sessions
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Start Date</p>
                  <p className="font-medium text-slate-900">{formatDate(selectedConference.start_date)}</p>
                </div>
                <div>
                  <p className="text-slate-500">End Date</p>
                  <p className="font-medium text-slate-900">{formatDate(selectedConference.end_date)}</p>
                </div>
                {selectedConference.location && (
                  <div className="col-span-2">
                    <p className="text-slate-500">Location</p>
                    <p className="font-medium text-slate-900">{selectedConference.location}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Sessions Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-slate-900">Sessions</h4>
                {(selectedConference.session_count || 0) < selectedConference.max_sessions && (
                  <Button size="sm" onClick={() => setShowCreateSessionModal(true)}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Session
                  </Button>
                )}
              </div>

              {!selectedConference.sessions || selectedConference.sessions.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-xl">
                  <Calendar className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500">No sessions yet</p>
                  <Button size="sm" className="mt-4" onClick={() => setShowCreateSessionModal(true)}>
                    <Plus className="w-4 h-4 mr-1" />
                    Create First Session
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedConference.sessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:border-primary-200 hover:shadow-sm transition-all"
                    >
                      <div className="flex-1">
                        <h5 className="font-medium text-slate-900">{session.name}</h5>
                        <p className="text-sm text-slate-500">
                          {formatDate(session.start_date)} - {formatDate(session.end_date)}
                        </p>
                        {session.location && (
                          <p className="text-sm text-slate-400 flex items-center gap-1 mt-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {session.location}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteSession(session.id)}
                        className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Create Session Modal */}
      <Modal
        isOpen={showCreateSessionModal}
        onClose={() => setShowCreateSessionModal(false)}
        title="Create New Session"
        size="lg"
      >
        <div className="space-y-5">
          <div className="p-4 bg-primary-50 border border-primary-100 rounded-xl">
            <p className="text-sm text-primary-700">
              <Layers className="w-4 h-4 inline mr-2" />
              Creating session for <strong>{selectedConference?.name}</strong>
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
            placeholder="Brief description of the session..."
            value={sessionForm.description}
            onChange={(e) => setSessionForm({ ...sessionForm, description: e.target.value })}
            rows={3}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              type="datetime-local"
              label="Start Date & Time"
              value={sessionForm.start_date}
              onChange={(e) => setSessionForm({ ...sessionForm, start_date: e.target.value })}
              required
            />
            <Input
              type="datetime-local"
              label="End Date & Time"
              value={sessionForm.end_date}
              onChange={(e) => setSessionForm({ ...sessionForm, end_date: e.target.value })}
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

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowCreateSessionModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSession}>
              <Plus className="w-4 h-4 mr-2" />
              Create Session
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
