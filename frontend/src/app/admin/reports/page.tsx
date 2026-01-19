'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Select from '@/components/ui/Select';
import { reportsApi, sessionsApi } from '@/lib/api';
import { Session } from '@/types';
import toast from 'react-hot-toast';
import {
  BarChart3,
  Users,
  FolderKanban,
  Calendar,
  FileCheck,
  Download,
  RefreshCw,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface OverviewStats {
  users: {
    total: number;
    students: number;
    internal_reviewers: number;
    external_reviewers: number;
    admins: number;
    pending_approval: number;
  };
  sessions: {
    total: number;
    active: number;
    upcoming: number;
    completed: number;
  };
  projects: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  reviews: {
    total: number;
    completed: number;
    pending: number;
    average_score: number;
  };
}

interface SessionDetails {
  session: {
    id: number;
    name: string;
    description: string;
    status: string;
    start_date: string;
    end_date: string;
    location: string;
    max_projects: number;
    tags: string[];
  };
  statistics: {
    total_projects: number;
    approved_projects: number;
    pending_projects: number;
    rejected_projects: number;
    total_reviewers: number;
    total_reviews: number;
    completed_reviews: number;
  };
  projects: Array<{
    id: number;
    title: string;
    student_name: string;
    student_email: string;
    status: string;
    tags: string[];
    assigned_reviewers: Array<{ id: number; name: string; email: string }>;
    reviews: { total: number; completed: number; average_score: number };
  }>;
  reviewers: Array<{
    id: number;
    name: string;
    email: string;
    role: string;
    assigned_projects: number;
    completed_reviews: number;
    pending_reviews: number;
  }>;
}

export default function AdminReportsPage() {
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [sessionDetails, setSessionDetails] = useState<SessionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>('projects');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedSession) {
      loadSessionDetails(parseInt(selectedSession));
    } else {
      setSessionDetails(null);
    }
  }, [selectedSession]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [overviewRes, sessionsRes] = await Promise.all([
        reportsApi.getOverview(),
        sessionsApi.list(),
      ]);
      setOverview(overviewRes.data);
      setSessions(sessionsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const loadSessionDetails = async (sessionId: number) => {
    setLoadingDetails(true);
    try {
      const res = await reportsApi.getSessionDetails(sessionId);
      setSessionDetails(res.data);
    } catch (error) {
      console.error('Error loading session details:', error);
      toast.error('Failed to load session details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleExportSession = () => {
    if (selectedSession) {
      reportsApi.exportSession(parseInt(selectedSession));
      toast.success('Downloading session report...');
    }
  };

  const handleExportAll = () => {
    reportsApi.exportAll();
    toast.success('Downloading full report...');
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'gray'> = {
      approved: 'success',
      active: 'success',
      completed: 'primary',
      pending: 'warning',
      upcoming: 'primary',
      rejected: 'danger',
    };
    return <Badge variant={variants[status] || 'gray'}>{status}</Badge>;
  };

  const sessionOptions = [
    { value: '', label: 'Select a session to view details' },
    ...sessions.map((s) => ({ value: s.id.toString(), label: s.name })),
  ];

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports & Overview</h1>
          <p className="text-slate-500 mt-1">Comprehensive view of conference data</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="primary" onClick={handleExportAll}>
            <Download className="w-4 h-4 mr-2" />
            Export All
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Users Card */}
          <Card>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Users</p>
                  <p className="text-3xl font-bold text-slate-900">{overview.users.total}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Students:</span>
                  <span className="font-medium">{overview.users.students}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Reviewers:</span>
                  <span className="font-medium">
                    {overview.users.internal_reviewers + overview.users.external_reviewers}
                  </span>
                </div>
              </div>
              {overview.users.pending_approval > 0 && (
                <div className="mt-2 p-2 bg-amber-50 rounded text-sm text-amber-700 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {overview.users.pending_approval} pending approval
                </div>
              )}
            </CardBody>
          </Card>

          {/* Sessions Card */}
          <Card>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Sessions</p>
                  <p className="text-3xl font-bold text-slate-900">{overview.sessions.total}</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Badge variant="success">{overview.sessions.active} Active</Badge>
                <Badge variant="primary">{overview.sessions.upcoming} Upcoming</Badge>
                <Badge variant="gray">{overview.sessions.completed} Done</Badge>
              </div>
            </CardBody>
          </Card>

          {/* Projects Card */}
          <Card>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Projects</p>
                  <p className="text-3xl font-bold text-slate-900">{overview.projects.total}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <FolderKanban className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <div className="mt-4 space-y-1 text-sm">
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="w-3 h-3" /> Approved
                  </span>
                  <span className="font-medium">{overview.projects.approved}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1 text-amber-600">
                    <Clock className="w-3 h-3" /> Pending
                  </span>
                  <span className="font-medium">{overview.projects.pending}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1 text-red-600">
                    <XCircle className="w-3 h-3" /> Rejected
                  </span>
                  <span className="font-medium">{overview.projects.rejected}</span>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Reviews Card */}
          <Card>
            <CardBody>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Reviews</p>
                  <p className="text-3xl font-bold text-slate-900">{overview.reviews.total}</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <FileCheck className="w-6 h-6 text-orange-600" />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Completed:</span>
                  <span className="font-medium text-green-600">{overview.reviews.completed}</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary-600" />
                  <span className="text-sm text-slate-600">
                    Avg Score: <strong>{overview.reviews.average_score}%</strong>
                  </span>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Session Details Section */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary-600" />
              <h2 className="text-lg font-semibold">Session Details</h2>
            </div>
            <div className="flex gap-2 items-center w-full sm:w-auto">
              <Select
                options={sessionOptions}
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
                className="flex-1 sm:w-64"
              />
              {selectedSession && (
                <Button variant="secondary" size="sm" onClick={handleExportSession}>
                  <Download className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardBody>
          {!selectedSession ? (
            <div className="text-center py-12 text-slate-500">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>Select a session above to view detailed information</p>
            </div>
          ) : loadingDetails ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : sessionDetails ? (
            <div className="space-y-6">
              {/* Session Info */}
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex flex-wrap gap-4 justify-between items-start">
                  <div>
                    <h3 className="text-xl font-semibold text-slate-900">{sessionDetails.session.name}</h3>
                    <p className="text-slate-600 mt-1">{sessionDetails.session.description}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {sessionDetails.session.tags.map((tag, i) => (
                        <Badge key={i} variant="gray">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    {getStatusBadge(sessionDetails.session.status)}
                    <p className="text-sm text-slate-500 mt-2">
                      {formatDate(sessionDetails.session.start_date)} - {formatDate(sessionDetails.session.end_date)}
                    </p>
                    {sessionDetails.session.location && (
                      <p className="text-sm text-slate-500">{sessionDetails.session.location}</p>
                    )}
                  </div>
                </div>

                {/* Stats Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-200">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-slate-900">{sessionDetails.statistics.total_projects}</p>
                    <p className="text-sm text-slate-500">Projects</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-slate-900">{sessionDetails.statistics.total_reviewers}</p>
                    <p className="text-sm text-slate-500">Reviewers</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{sessionDetails.statistics.completed_reviews}</p>
                    <p className="text-sm text-slate-500">Reviews Done</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-amber-600">
                      {sessionDetails.statistics.total_reviews - sessionDetails.statistics.completed_reviews}
                    </p>
                    <p className="text-sm text-slate-500">Reviews Pending</p>
                  </div>
                </div>
              </div>

              {/* Projects Section */}
              <div>
                <button
                  className="w-full flex items-center justify-between p-3 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                  onClick={() => setExpandedSection(expandedSection === 'projects' ? null : 'projects')}
                >
                  <span className="font-medium text-slate-700">
                    Projects ({sessionDetails.projects.length})
                  </span>
                  {expandedSection === 'projects' ? (
                    <ChevronUp className="w-5 h-5 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-500" />
                  )}
                </button>
                {expandedSection === 'projects' && (
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase">Project</th>
                          <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase">Student</th>
                          <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase">Status</th>
                          <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase">Reviewers</th>
                          <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase">Reviews</th>
                          <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase">Avg Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sessionDetails.projects.map((project) => (
                          <tr key={project.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3">
                              <p className="font-medium text-slate-900 line-clamp-1">{project.title}</p>
                              <div className="flex gap-1 mt-1">
                                {project.tags.slice(0, 2).map((tag, i) => (
                                  <span key={i} className="text-xs text-slate-500 bg-slate-100 px-1 rounded">{tag}</span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600">{project.student_name}</td>
                            <td className="px-4 py-3">{getStatusBadge(project.status)}</td>
                            <td className="px-4 py-3 text-sm text-slate-600">{project.assigned_reviewers.length}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className="text-green-600">{project.reviews.completed}</span>
                              <span className="text-slate-400">/{project.reviews.total}</span>
                            </td>
                            <td className="px-4 py-3 text-sm font-medium">
                              {project.reviews.average_score > 0 ? `${project.reviews.average_score}%` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Reviewers Section */}
              <div>
                <button
                  className="w-full flex items-center justify-between p-3 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                  onClick={() => setExpandedSection(expandedSection === 'reviewers' ? null : 'reviewers')}
                >
                  <span className="font-medium text-slate-700">
                    Reviewers ({sessionDetails.reviewers.length})
                  </span>
                  {expandedSection === 'reviewers' ? (
                    <ChevronUp className="w-5 h-5 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-500" />
                  )}
                </button>
                {expandedSection === 'reviewers' && (
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase">Reviewer</th>
                          <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase">Role</th>
                          <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase">Assigned</th>
                          <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase">Completed</th>
                          <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase">Pending</th>
                          <th className="text-left px-4 py-2 text-xs font-medium text-slate-500 uppercase">Progress</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sessionDetails.reviewers.map((reviewer) => {
                          const progress = reviewer.assigned_projects > 0
                            ? Math.round((reviewer.completed_reviews / reviewer.assigned_projects) * 100)
                            : 0;
                          return (
                            <tr key={reviewer.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3">
                                <p className="font-medium text-slate-900">{reviewer.name}</p>
                                <p className="text-sm text-slate-500">{reviewer.email}</p>
                              </td>
                              <td className="px-4 py-3">
                                <Badge variant={reviewer.role === 'internal_reviewer' ? 'primary' : 'gray'}>
                                  {reviewer.role === 'internal_reviewer' ? 'Internal' : 'External'}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-600">{reviewer.assigned_projects}</td>
                              <td className="px-4 py-3 text-sm text-green-600 font-medium">{reviewer.completed_reviews}</td>
                              <td className="px-4 py-3 text-sm text-amber-600 font-medium">{reviewer.pending_reviews}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-primary-500 rounded-full"
                                      style={{ width: `${progress}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-slate-500 w-10">{progress}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </CardBody>
      </Card>
    </DashboardLayout>
  );
}
