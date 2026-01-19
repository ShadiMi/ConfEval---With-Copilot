'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { applicationsApi } from '@/lib/api';
import { ReviewerApplication } from '@/types';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';
import {
  ClipboardList,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';

export default function MyApplicationsPage() {
  const [applications, setApplications] = useState<ReviewerApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await applicationsApi.getMyApplications();
      setApplications(res.data);
    } catch (error) {
      console.error('Error loading applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (id: number) => {
    if (!confirm('Are you sure you want to withdraw this application?')) return;
    
    try {
      await applicationsApi.delete(id);
      toast.success('Application withdrawn');
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to withdraw application');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-500" />;
    }
  };

  if (loading) {
    return (
      <DashboardLayout allowedRoles={['internal_reviewer', 'external_reviewer']}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout allowedRoles={['internal_reviewer', 'external_reviewer']}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">My Applications</h1>
        <p className="text-slate-600 mt-1">Track your session applications</p>
      </div>

      {applications.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<ClipboardList className="w-12 h-12" />}
              title="No Applications"
              description="You haven't applied to any sessions yet."
            />
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => (
            <Card key={app.id}>
              <CardBody>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start gap-4">
                    {getStatusIcon(app.status)}
                    <div>
                      <h3 className="font-semibold text-slate-900">{app.session.name}</h3>
                      <p className="text-sm text-slate-500 mt-1">
                        Applied {formatDate(app.created_at)}
                      </p>
                      {app.message && (
                        <p className="text-sm text-slate-600 mt-2">{app.message}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Badge status={app.status}>{app.status}</Badge>
                    {app.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleWithdraw(app.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
