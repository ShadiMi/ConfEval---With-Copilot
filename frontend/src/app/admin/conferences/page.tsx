'use client';

import DashboardLayout from '@/components/DashboardLayout';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Textarea from '@/components/ui/Textarea';
import { conferencesApi, sessionsApi } from '@/lib/api';
import { extractErrorMessage, formatDate } from '@/lib/utils'; // ✅ ADD extractErrorMessage
import { Conference, ConferenceWithSessions, Session } from '@/types';
import {
  Calendar,
  Edit,
  Eye,
  Layers,
  LinkIcon,
  MapPin,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

const BUILDINGS = ['לגסי', 'אינשטיין', 'ספרא', 'מינקוף', 'קציר', 'שמעון'] as const;

const roomsForFloor = (floor: '' | 1 | 2) => {
  if (floor === 1) return Array.from({ length: 9 }, (_, i) => 101 + i); // 101..109
  if (floor === 2) return Array.from({ length: 9 }, (_, i) => 201 + i); // 201..209
  return [];
};

export default function ConferencesPage() {
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showAddSessionModal, setShowAddSessionModal] = useState(false);

  const [selectedConference, setSelectedConference] =
    useState<ConferenceWithSessions | null>(null);

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

  // ✅ Reset room when floor changes
  useEffect(() => {
    setFormData((prev) => ({ ...prev, room_number: '' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

        // ✅ فقط location
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

    // ✅ validation: if one of them selected, require all 3
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

        // ✅ send real values
        building: formData.building || undefined,
        floor: formData.floor === '' ? undefined : formData.floor,
        room_number: formData.room_number === '' ? undefined : Number(formData.room_number),

        // ✅ IMPORTANT: do NOT send location here
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

  const handleAddSession = async (sessionId: number) => {
    if (!selectedConference) return;
    try {
      await conferencesApi.addSession(selectedConference.id, sessionId);
      toast.success('Session added to conference');
      const res = await conferencesApi.get(selectedConference.id);
      setSelectedConference(res.data);
      loadSessions();
    } catch (error: any) {
      toast.error(extractErrorMessage(error, 'Failed to add session'));
    }
  };

  const handleRemoveSession = async (sessionId: number) => {
    if (!selectedConference) return;
    try {
      await conferencesApi.removeSession(selectedConference.id, sessionId);
      toast.success('Session removed from conference');
      const res = await conferencesApi.get(selectedConference.id);
      setSelectedConference(res.data);
      loadSessions();
    } catch (error: any) {
      toast.error(extractErrorMessage(error, 'Failed to remove session'));
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

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
      draft: 'default',
      active: 'success',
      completed: 'warning',
      archived: 'error',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  const unassignedSessions = sessions.filter((s) => !s.conference_id);

  if (loading) {
    return (
      <DashboardLayout allowedRoles={['admin']}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout allowedRoles={['admin']}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Conferences</h1>
            <p className="text-slate-600">Manage conferences and their sessions</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Conference
          </Button>
        </div>

        {/* Conferences Grid */}
        {conferences.length === 0 ? (
          <Card>
            <CardBody>
              <div className="text-center py-12">
                <Layers className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No conferences yet</h3>
                <p className="text-slate-600 mb-4">Create your first conference to get started</p>
                <Button onClick={() => setShowCreateModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Conference
                </Button>
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
                    <p className="text-sm text-slate-600 mb-4 line-clamp-2">
                      {conference.description}
                    </p>
                  )}

                  <div className="space-y-2 text-sm text-slate-600 mb-4">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      {formatDate(conference.start_date)} - {formatDate(conference.end_date)}
                    </div>
                  {conference.location && (
                    <div className="flex items-center">
                      <MapPin className="w-4 h-4 mr-2" />
                      <span className="text-slate-500 mr-1">Conference:</span>
                      <span className="text-slate-900 font-medium">{conference.location}</span>
                    </div>
                    )}

                    
                    <div className="flex items-center">
                      <Layers className="w-4 h-4 mr-2" />
                      Max {conference.max_sessions} sessions
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-4 border-t border-slate-200">
                    <Button variant="ghost" size="sm" onClick={() => handleViewDetails(conference)}>
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEditModal(conference)}>
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(conference.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Status Actions */}
                  <div className="flex flex-wrap gap-1 mt-3">
                    {conference.status === 'draft' && (
                      <Button size="sm" variant="outline" onClick={() => handleStatusChange(conference.id, 'active')}>
                        Activate
                      </Button>
                    )}
                    {conference.status === 'active' && (
                      <Button size="sm" variant="outline" onClick={() => handleStatusChange(conference.id, 'completed')}>
                        Complete
                      </Button>
                    )}
                    {conference.status === 'completed' && (
                      <Button size="sm" variant="outline" onClick={() => handleStatusChange(conference.id, 'archived')}>
                        Archive
                      </Button>
                    )}
                  </div>
          </CardBody>
        </Card>
      ))}
    </div>
  )}
</div>

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          resetForm();
        }}
        title="Create Conference"
      >
        <div className="space-y-4">
          <Input
            label="Conference Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter conference name"
            required
          />

          <Textarea
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Enter description"
            rows={3}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="datetime-local"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              required
            />
            <Input
              label="End Date"
              type="datetime-local"
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              required
            />
          </div>

          {/* Building / Floor / Room */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Building</label>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                value={formData.building}
                onChange={(e) => setFormData({ ...formData, building: e.target.value })}
              >
                <option value="">Select building</option>
                {BUILDINGS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Floor</label>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                value={formData.floor}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    floor: (e.target.value ? Number(e.target.value) : '') as '' | 1 | 2,
                  })
                }
              >
                <option value="">Select floor</option>
                <option value="1">1</option>
                <option value="2">2</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Room</label>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                value={formData.room_number}
                disabled={formData.floor === ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    room_number: (e.target.value ? Number(e.target.value) : '') as '' | number,
                  })
                }
              >
                <option value="">Select room</option>
                {roomsForFloor(formData.floor).map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Preview */}
          {formData.building && formData.floor && formData.room_number && (
            <p className="text-xs text-slate-500">
              Location Preview: {formData.building}, קומה {formData.floor}, חדר {formData.room_number}
            </p>
          )}

          <Input
            label="Max Sessions"
            type="number"
            value={formData.max_sessions}
            onChange={(e) => setFormData({ ...formData, max_sessions: parseInt(e.target.value) || 10 })}
            min={1}
            max={100}
          />

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateModal(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!formData.name || !formData.start_date || !formData.end_date}>
              Create Conference
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          resetForm();
        }}
        title="Edit Conference"
      >
        <div className="space-y-4">
          <Input
            label="Conference Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter conference name"
            required
          />

          <Textarea
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Enter description"
            rows={3}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="datetime-local"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              required
            />
            <Input
              label="End Date"
              type="datetime-local"
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              required
            />
          </div>

          {/* Building / Floor / Room */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Building</label>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                value={formData.building}
                onChange={(e) => setFormData({ ...formData, building: e.target.value })}
              >
                <option value="">Select building</option>
                {BUILDINGS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Floor</label>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                value={formData.floor}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    floor: (e.target.value ? Number(e.target.value) : '') as '' | 1 | 2,
                  })
                }
              >
                <option value="">Select floor</option>
                <option value="1">1</option>
                <option value="2">2</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Room</label>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                value={formData.room_number}
                disabled={formData.floor === ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    room_number: (e.target.value ? Number(e.target.value) : '') as '' | number,
                  })
                }
              >
                <option value="">Select room</option>
                {roomsForFloor(formData.floor).map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Preview */}
          {formData.building && formData.floor && formData.room_number && (
            <p className="text-xs text-slate-500">
              Location Preview: {formData.building}, קומה {formData.floor}, חדר {formData.room_number}
            </p>
          )}

          <Input
            label="Max Sessions"
            type="number"
            value={formData.max_sessions}
            onChange={(e) => setFormData({ ...formData, max_sessions: parseInt(e.target.value) || 10 })}
            min={1}
            max={100}
          />

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowEditModal(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdate}>Update Conference</Button>
          </div>
        </div>
      </Modal>

      {/* Details Modal */}
      <Modal
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedConference(null);
        }}
        title={selectedConference?.name || 'Conference Details'}
        size="lg"
      >
        {selectedConference && (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              {getStatusBadge(selectedConference.status)}
              <span className="text-sm text-slate-500">
                {selectedConference.session_count} / {selectedConference.max_sessions} sessions
              </span>
            </div>

            {selectedConference.description && (
              <p className="text-slate-600">{selectedConference.description}</p>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500">Start Date:</span>
                <span className="ml-2 text-slate-900">{formatDate(selectedConference.start_date)}</span>
              </div>
              <div>
                <span className="text-slate-500">End Date:</span>
                <span className="ml-2 text-slate-900">{formatDate(selectedConference.end_date)}</span>
              </div>

              {selectedConference.location && (
                <div className="col-span-2">
                  <span className="text-slate-500">Conference:</span>
                  <span className="ml-2 text-slate-900 font-medium">{selectedConference.location}</span>
                </div>
              )}

              
            </div>

            {/* Sessions */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-slate-900">Sessions</h4>
                {(selectedConference.session_count || 0) < selectedConference.max_sessions &&
                  unassignedSessions.length > 0 && (
                    <Button size="sm" onClick={() => setShowAddSessionModal(true)}>
                      <LinkIcon className="w-4 h-4 mr-1" />
                      Add Session
                    </Button>
                  )}
              </div>

              {!selectedConference.sessions || selectedConference.sessions.length === 0 ? (
                <p className="text-sm text-slate-500">No sessions assigned to this conference yet.</p>
              ) : (
                <div className="space-y-2">
                  {selectedConference.sessions.map((session) => (
                    <div key={session.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium text-slate-900">{session.name}</p>
                        <p className="text-sm text-slate-500">
                          {formatDate(session.start_date)} - {formatDate(session.end_date)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveSession(session.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Add Session Modal */}
      <Modal
        isOpen={showAddSessionModal}
        onClose={() => setShowAddSessionModal(false)}
        title="Add Session to Conference"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">Select a session to add to this conference:</p>
          {unassignedSessions.length === 0 ? (
            <p className="text-sm text-slate-500">No unassigned sessions available.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {unassignedSessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer"
                  onClick={() => {
                    handleAddSession(session.id);
                    setShowAddSessionModal(false);
                  }}
                >
                  <div>
                    <p className="font-medium text-slate-900">{session.name}</p>
                    <p className="text-sm text-slate-500">
                      {formatDate(session.start_date)} - {formatDate(session.end_date)}
                    </p>
                  </div>
                  <Plus className="w-4 h-4 text-primary-600" />
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end pt-4">
            <Button variant="outline" onClick={() => setShowAddSessionModal(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
