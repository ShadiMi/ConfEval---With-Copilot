'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { useAuthStore } from '@/lib/store';
import { statsApi, sessionsApi, projectsApi, applicationsApi, reviewsApi } from '@/lib/api';
import { Session, Project, ReviewerApplication, Review, Stats } from '@/types';
import { formatDate, getRoleLabel } from '@/lib/utils';
import Link from 'next/link';
import {
  Users,
  Calendar,
  FolderKanban,
  FileCheck,
  ArrowRight,
  Clock,
  TrendingUp,
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [applications, setApplications] = useState<ReviewerApplication[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    
    try {
      // Load data based on role
      const [statsRes, sessionsRes] = await Promise.all([
        user.role === 'admin' ? statsApi.get() : Promise.resolve({ data: null }),
        sessionsApi.list(),
      ]);

      setStats(statsRes.data);
      setSessions(sessionsRes.data.slice(0, 5));

      if (user.role === 'student') {
        const projectsRes = await projectsApi.getMyProjects();
        setProjects(projectsRes.data.slice(0, 5));
      }

      if (user.role === 'internal_reviewer' || user.role === 'external_reviewer') {
        const [appsRes, reviewsRes] = await Promise.all([
          applicationsApi.getMyApplications(),
          reviewsApi.getMyReviews(),
        ]);
        setApplications(appsRes.data.slice(0, 5));
        setReviews(reviewsRes.data.slice(0, 5));
      }

      if (user.role === 'admin') {
        const [appsRes, projectsRes] = await Promise.all([
          applicationsApi.list({ status: 'pending' }),
          projectsApi.list({ status: 'pending' }),
        ]);
        setApplications(appsRes.data.slice(0, 5));
        setProjects(projectsRes.data.slice(0, 5));
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
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

  return (
    <DashboardLayout>
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome back, {user?.full_name}!
        </h1>
        <p className="text-slate-600 mt-1">
          {getRoleLabel(user?.role || '')} Dashboard
        </p>
      </div>

      {/* Admin Stats */}
      {user?.role === 'admin' && stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardBody className="flex items-center space-x-4">
              <div className="p-3 bg-primary-100 rounded-lg">
                <Users className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Total Users</p>
                <p className="text-2xl font-bold text-slate-900">{stats.total_users}</p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-center space-x-4">
              <div className="p-3 bg-accent-100 rounded-lg">
                <Calendar className="w-6 h-6 text-accent-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Sessions</p>
                <p className="text-2xl font-bold text-slate-900">{stats.total_sessions}</p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-center space-x-4">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <FolderKanban className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Projects</p>
                <p className="text-2xl font-bold text-slate-900">{stats.total_projects}</p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-center space-x-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <FileCheck className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-600">Reviews</p>
                <p className="text-2xl font-bold text-slate-900">{stats.total_reviews}</p>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sessions */}
        <Card>
          <CardHeader
            action={
              <Link href="/sessions">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            }
          >
            <h2 className="text-lg font-semibold text-slate-900">
              {user?.role === 'admin' ? 'Recent Sessions' : 'Available Sessions'}
            </h2>
          </CardHeader>
          <CardBody className="p-0">
            {sessions.length === 0 ? (
              <div className="p-6 text-center text-slate-500">No sessions found</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {sessions.map((session) => (
                  <Link
                    key={session.id}
                    href={`/sessions/${session.id}`}
                    className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{session.name}</p>
                      <p className="text-sm text-slate-500 flex items-center mt-1">
                        <Clock className="w-4 h-4 mr-1" />
                        {formatDate(session.start_date)} - {formatDate(session.end_date)}
                      </p>
                    </div>
                    <Badge status={session.status}>{session.status}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Student Projects */}
        {user?.role === 'student' && (
          <Card>
            <CardHeader
              action={
                <Link href="/projects">
                  <Button variant="ghost" size="sm">
                    View All <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              }
            >
              <h2 className="text-lg font-semibold text-slate-900">My Projects</h2>
            </CardHeader>
            <CardBody className="p-0">
              {projects.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-slate-500 mb-4">You haven't submitted any projects yet</p>
                  <Link href="/projects">
                    <Button>Submit Your First Project</Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {projects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-slate-900">{project.title}</p>
                        <p className="text-sm text-slate-500 mt-1">
                          {formatDate(project.created_at)}
                        </p>
                      </div>
                      <Badge status={project.status}>{project.status}</Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        )}

        {/* Reviewer Applications */}
        {(user?.role === 'internal_reviewer' || user?.role === 'external_reviewer') && (
          <Card>
            <CardHeader
              action={
                <Link href="/applications">
                  <Button variant="ghost" size="sm">
                    View All <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              }
            >
              <h2 className="text-lg font-semibold text-slate-900">My Applications</h2>
            </CardHeader>
            <CardBody className="p-0">
              {applications.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-slate-500 mb-4">You haven't applied to any sessions</p>
                  <Link href="/sessions">
                    <Button>Browse Sessions</Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {applications.map((app) => (
                    <div
                      key={app.id}
                      className="flex items-center justify-between p-4"
                    >
                      <div>
                        <p className="font-medium text-slate-900">{app.session.name}</p>
                        <p className="text-sm text-slate-500 mt-1">
                          Applied {formatDate(app.created_at)}
                        </p>
                      </div>
                      <Badge status={app.status}>{app.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        )}

        {/* Reviewer Reviews */}
        {(user?.role === 'internal_reviewer' || user?.role === 'external_reviewer') && (
          <Card>
            <CardHeader
              action={
                <Link href="/reviews">
                  <Button variant="ghost" size="sm">
                    View All <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              }
            >
              <h2 className="text-lg font-semibold text-slate-900">My Reviews</h2>
            </CardHeader>
            <CardBody className="p-0">
              {reviews.length === 0 ? (
                <div className="p-6 text-center text-slate-500">
                  No reviews yet
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {reviews.map((review) => (
                    <Link
                      key={review.id}
                      href={`/reviews/${review.id}`}
                      className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-slate-900">
                          Review #{review.id}
                        </p>
                        <div className="flex items-center mt-1">
                          <TrendingUp className="w-4 h-4 text-slate-400 mr-1" />
                          <span className="text-sm text-slate-500">
                            Score: {review.total_score?.toFixed(1) || 'N/A'}
                          </span>
                        </div>
                      </div>
                      <Badge variant={review.is_completed ? 'success' : 'warning'}>
                        {review.is_completed ? 'Completed' : 'In Progress'}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        )}

        {/* Admin Pending Applications */}
        {user?.role === 'admin' && (
          <Card>
            <CardHeader
              action={
                <Link href="/admin/applications">
                  <Button variant="ghost" size="sm">
                    View All <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              }
            >
              <h2 className="text-lg font-semibold text-slate-900">
                Pending Applications
              </h2>
            </CardHeader>
            <CardBody className="p-0">
              {applications.length === 0 ? (
                <div className="p-6 text-center text-slate-500">
                  No pending applications
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {applications.map((app) => (
                    <Link
                      key={app.id}
                      href={`/admin/applications`}
                      className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-slate-900">
                          {app.reviewer.full_name}
                        </p>
                        {app.reviewer.affiliation && (
                          <p className="text-xs text-slate-400">{app.reviewer.affiliation}</p>
                        )}
                        <p className="text-sm text-slate-500 mt-1">
                          Applied for: {app.session.name}
                        </p>
                      </div>
                      <Badge status={app.status}>{app.status}</Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        )}

        {/* Admin Pending Projects */}
        {user?.role === 'admin' && (
          <Card>
            <CardHeader
              action={
                <Link href="/admin/projects">
                  <Button variant="ghost" size="sm">
                    View All <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              }
            >
              <h2 className="text-lg font-semibold text-slate-900">
                Pending Projects
              </h2>
            </CardHeader>
            <CardBody className="p-0">
              {projects.length === 0 ? (
                <div className="p-6 text-center text-slate-500">
                  No pending projects
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {projects.map((project: any) => (
                    <Link
                      key={project.id}
                      href={`/admin/projects`}
                      className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-slate-900">{project.title}</p>
                        <p className="text-sm text-slate-500 mt-1">
                          By: {project.student?.full_name}
                        </p>
                      </div>
                      <Badge status={project.status}>{project.status}</Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
