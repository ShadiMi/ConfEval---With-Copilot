'use client';

import DashboardLayout from '@/components/DashboardLayout';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import { conferencesApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { extractErrorMessage, formatDate } from '@/lib/utils';
import { ConferenceWithSessions } from '@/types';
import {
    Calendar,
    ChevronRight,
    Layers,
    MapPin,
    Plus,
    Settings,
    Users
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

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

export default function ConferencesListPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const [conferences, setConferences] = useState<ConferenceWithSessions[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    start_date: string;
    end_date: string;
    location: string;
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
    max_sessions: 10,
    building: '',
    floor: '',
    room_number: '',
  });

  useEffect(() => {
    setFormData((prev) => ({ ...prev, floor: '', room_number: '' }));
  }, [formData.building]);

  useEffect(() => {
    setFormData((prev) => ({ ...prev, room_number: '' }));
  }, [formData.floor]);

  useEffect(() => {
    loadConferences();
  }, []);

  const loadConferences = async () => {
    try {
      const res = await conferencesApi.list();
      // Fetch detailed info for each conference to get session counts
      const detailedConferences = await Promise.all(
        res.data.map(async (conf: any) => {
          try {
            const detailRes = await conferencesApi.get(conf.id);
            return detailRes.data;
          } catch {
            return { ...conf, sessions: [], session_count: 0 };
          }
        })
      );
      setConferences(detailedConferences);
    } catch (error) {
      console.error('Failed to load conferences');
    } finally {
      setLoading(false);
    }
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
  };

  const handleCreateConference = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
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
        location: computedLocation,
        max_sessions: formData.max_sessions,
      });
      toast.success('Conference created successfully');
      setCreateModal(false);
      resetForm();
      loadConferences();
    } catch (error: any) {
      toast.error(extractErrorMessage(error, 'Failed to create conference'));
    } finally {
      setSubmitting(false);
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

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'border-l-slate-400',
      active: 'border-l-green-500',
      completed: 'border-l-amber-500',
      archived: 'border-l-red-400',
    };
    return colors[status] || 'border-l-slate-300';
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Conferences</h1>
            <p className="text-slate-600">Browse all active conferences and their sessions</p>
          </div>
          <div className="flex gap-3">
            {isAdmin && (
              <Link href="/admin/conferences">
                <Button variant="secondary">
                  <Settings className="w-4 h-4 mr-2" />
                  Manage Conferences
                </Button>
              </Link>
            )}
            {isAdmin && (
              <Button onClick={() => setCreateModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Conference
              </Button>
            )}
          </div>
        </div>

        {/* Stats Summary */}
        {conferences.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-primary-50 to-white border-primary-100">
              <CardBody className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                  <Layers className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{conferences.length}</p>
                  <p className="text-sm text-slate-500">Total Conferences</p>
                </div>
              </CardBody>
            </Card>
            <Card className="bg-gradient-to-br from-green-50 to-white border-green-100">
              <CardBody className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">
                    {conferences.filter(c => c.status === 'active').length}
                  </p>
                  <p className="text-sm text-slate-500">Active</p>
                </div>
              </CardBody>
            </Card>
            <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100">
              <CardBody className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">
                    {conferences.reduce((acc, c) => acc + (c.session_count || 0), 0)}
                  </p>
                  <p className="text-sm text-slate-500">Total Sessions</p>
                </div>
              </CardBody>
            </Card>
            <Card className="bg-gradient-to-br from-amber-50 to-white border-amber-100">
              <CardBody className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">
                    {conferences.filter(c => c.status === 'completed').length}
                  </p>
                  <p className="text-sm text-slate-500">Completed</p>
                </div>
              </CardBody>
            </Card>
          </div>
        )}

        {/* Conferences Grid */}
        {conferences.length === 0 ? (
          <Card>
            <CardBody>
              <div className="text-center py-12">
                <Layers className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No conferences available</h3>
                <p className="text-slate-600 mb-6">
                  {isAdmin 
                    ? 'Create your first conference to get started' 
                    : 'Check back later for upcoming conferences'}
                </p>
                {isAdmin && (
                  <Button onClick={() => setCreateModal(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Conference
                  </Button>
                )}
              </div>
            </CardBody>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {conferences.map((conference) => (
              <Card 
                key={conference.id} 
                className={`hover:shadow-lg transition-all border-l-4 ${getStatusColor(conference.status)}`}
              >
                <CardBody className="space-y-4">
                  <div className="flex items-start justify-between">
                    <Link href={`/conferences/${conference.id}`} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">{conference.name}</Link>
                    {getStatusBadge(conference.status)}
                  </div>
                  
                  {conference.description && (
                    <p className="text-sm text-slate-600 line-clamp-2">{conference.description}</p>
                  )}
                  
                  <div className="space-y-2 text-sm text-slate-600">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-2 text-slate-400" />
                      {formatDate(conference.start_date)} - {formatDate(conference.end_date)}
                    </div>
                    {conference.location && (
                      <div className="flex items-center">
                        <MapPin className="w-4 h-4 mr-2 text-slate-400" />
                        {conference.location}
                      </div>
                    )}
                  </div>
                  
                  {/* Session Count Badge */}
                  <div className="flex items-center gap-2 py-2 px-3 bg-slate-50 rounded-lg">
                    <Layers className="w-4 h-4 text-slate-500" />
                    <span className="text-sm text-slate-600">
                      <span className="font-semibold text-slate-900">{conference.session_count || 0}</span>
                      {' '}of {conference.max_sessions} sessions
                    </span>
                  </div>
                  
                  <Link href={`/conferences/${conference.id}`}>
                    <Button variant="secondary" className="w-full group">
                      View Details
                      <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Conference Modal */}
      <Modal
        isOpen={createModal}
        onClose={() => setCreateModal(false)}
        title="Create New Conference"
        size="lg"
      >
        <form onSubmit={handleCreateConference} className="space-y-5">
          <Input
            label="Conference Name"
            placeholder="e.g., Spring Research Conference 2026"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Textarea
            label="Description"
            placeholder="Brief description of the conference..."
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
                onChange={(e) => {
                  const val = e.target.value;
                  const floor = val === '' ? '' : val === 'G-' ? 'G-' : Number(val) as 1 | 2;
                  setFormData({ ...formData, floor });
                }}
                disabled={!formData.building}
              >
                <option value="">Floor</option>
                {floorsForBuilding(formData.building).map((f) => <option key={String(f)} value={String(f)}>Floor {f}</option>)}
              </select>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                value={formData.room_number}
                onChange={(e) => {
                  const val = e.target.value;
                  const room = val === '' ? '' : (typeof val === 'string' && val.startsWith('G-')) ? val : Number(val);
                  setFormData({ ...formData, room_number: room });
                }}
                disabled={!formData.floor}
              >
                <option value="">Room</option>
                {roomsForFloor(formData.building, formData.floor).map((r) => <option key={String(r)} value={String(r)}>{r}</option>)}
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
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button type="button" variant="secondary" onClick={() => { setCreateModal(false); resetForm(); }}>
              Cancel
            </Button>
            <Button type="submit" isLoading={submitting}>
              <Plus className="w-4 h-4 mr-2" />
              Create Conference
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
