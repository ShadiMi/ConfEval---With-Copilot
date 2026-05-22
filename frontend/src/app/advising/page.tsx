'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { projectsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { formatDate } from '@/lib/utils';
import { ProjectWithStudent } from '@/types';
import { GraduationCap, Mail, Users, Star } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdvisingPage() {
  const { user } = useAuthStore();
  const [projects, setProjects] = useState<ProjectWithStudent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await projectsApi.getAdvised();
      setProjects(res.data);
    } catch (error: any) {
      console.error('Error loading advised projects:', error);
      toast.error(error.response?.data?.detail || 'Failed to load advised projects');
    } finally {
      setLoading(false);
    }
  };

  const counts = projects.reduce(
    (acc, p) => {
      acc.total += 1;
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    },
    { total: 0 } as Record<string, number>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <GraduationCap className="w-6 h-6 text-primary-600" />
              Projects I Advise
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Projects where students listed your email ({user?.email}) as their advisor.
            </p>
          </div>
        </div>

        {/* Summary */}
        {!loading && projects.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardBody>
                <p className="text-xs text-slate-500 uppercase">Total</p>
                <p className="text-2xl font-bold text-slate-900">{counts.total}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-xs text-slate-500 uppercase">Pending</p>
                <p className="text-2xl font-bold text-amber-600">{counts.pending || 0}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-xs text-slate-500 uppercase">Approved</p>
                <p className="text-2xl font-bold text-green-600">{counts.approved || 0}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-xs text-slate-500 uppercase">Rejected</p>
                <p className="text-2xl font-bold text-red-600">{counts.rejected || 0}</p>
              </CardBody>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <h2 className="font-semibold text-slate-900">Advised Projects</h2>
          </CardHeader>
          <CardBody>
            {loading ? (
              <p className="text-sm text-slate-500">Loading...</p>
            ) : projects.length === 0 ? (
              <EmptyState
                icon={<GraduationCap className="w-12 h-12" />}
                title="No advised projects"
                description="When a student lists your email as their advisor, their project will appear here."
              />
            ) : (
              <div className="space-y-3">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="border border-slate-200 rounded-lg p-4 hover:border-primary-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-slate-900 truncate">
                            {project.title}
                          </h3>
                          <Badge status={project.status}>{project.status}</Badge>
                        </div>
                        {project.description && (
                          <p className="text-sm text-slate-600 line-clamp-2 mb-2">
                            {project.description}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {project.student?.full_name}
                          </span>
                          {project.student?.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3.5 h-3.5" />
                              {project.student.email}
                            </span>
                          )}
                          <span>Submitted {formatDate(project.created_at)}</span>
                          {project.poster_number && (
                            <span>Poster #{project.poster_number}</span>
                          )}
                          {project.review_count != null && project.review_count > 0 && (
                            <span className="flex items-center gap-1">
                              <Star className="w-3.5 h-3.5 text-yellow-500 fill-current" />
                              {project.avg_score?.toFixed(1) ?? 'N/A'} ({project.review_count})
                            </span>
                          )}
                        </div>
                      </div>
                      <Link href={`/projects/${project.id}`}>
                        <Button variant="secondary" size="sm">
                          View Details
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </DashboardLayout>
  );
}
