'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import { useAuthStore } from '@/lib/store';
import { sessionsApi, criteriaApi, projectsApi, reviewsApi, tagsApi, applicationsApi, authApi } from '@/lib/api';
import { SessionWithDetails, Criteria, ProjectWithStudent, Review, Tag, ReviewerApplication, User } from '@/types';
import { formatDate, formatDateTime, getRoleLabel } from '@/lib/utils';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  Calendar,
  MapPin,
  Users,
  ClipboardList,
  FolderKanban,
  ArrowLeft,
  Plus,
  Trash2,
  Edit,
  Clock,
  X,
  FileText,
  Presentation,
  File,
  Star,
  Tag as TagIcon,
  Send,
  UserPlus,
  RefreshCw,
} from 'lucide-react';

const statusOptions = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
];

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const sessionId = parseInt(params.id as string);
  const isAdmin = user?.role === 'admin';
  const isReviewer = user?.role === 'internal_reviewer' || user?.role === 'external_reviewer';

  const [session, setSession] = useState<SessionWithDetails | null>(null);
  const [projects, setProjects] = useState<ProjectWithStudent[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [myApplications, setMyApplications] = useState<ReviewerApplication[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Apply modal for reviewers
  const [applyModal, setApplyModal] = useState(false);
  const [applyMessage, setApplyMessage] = useState('');
  
  // Tag management modal
  const [tagModal, setTagModal] = useState(false);
  const [showCreateTag, setShowCreateTag] = useState(false);
  const [newTagForm, setNewTagForm] = useState({ name: '', description: '' });
  
  // Session edit modal
  const [editSessionModal, setEditSessionModal] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    location: '',
    status: '',
    max_projects: 50,
  });
  
  // Criteria modal
  const [criteriaModal, setCriteriaModal] = useState(false);
  const [editingCriteria, setEditingCriteria] = useState<Criteria | null>(null);
  const [criteriaForm, setCriteriaForm] = useState({
    name: '',
    description: '',
    max_score: 10,
    weight: 1.0,
  });
  
  // Project detail modal for admin
  const [projectDetailModal, setProjectDetailModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectWithStudent | null>(null);
  const [projectReviews, setProjectReviews] = useState<Review[]>([]);
  const [projectEditForm, setProjectEditForm] = useState({
    title: '',
    description: '',
    mentor_email: '',
  });
  const [projectSelectedTagIds, setProjectSelectedTagIds] = useState<number[]>([]);
  const [projectTeamMembers, setProjectTeamMembers] = useState<User[]>([]);
  const [allStudents, setAllStudents] = useState<User[]>([]);
  
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [sessionId]);

  const loadData = async () => {
    try {
      const [sessionRes, projectsRes, tagsRes, appsRes, studentsRes] = await Promise.all([
        sessionsApi.get(sessionId),
        projectsApi.list({ session_id: sessionId }),
        tagsApi.list(),
        isReviewer ? applicationsApi.getMyApplications() : Promise.resolve({ data: [] }),
        isAdmin ? authApi.getUsers('student') : Promise.resolve({ data: [] }),
      ]);
      setSession(sessionRes.data);
      setProjects(projectsRes.data);
      setAllTags(tagsRes.data);
      setMyApplications(appsRes.data);
      setAllStudents(studentsRes.data);
    } catch (error) {
      console.error('Error loading session:', error);
      toast.error('Failed to load session');
    } finally {
      setLoading(false);
    }
  };

  // Check if user has already applied to this session
  const hasApplied = myApplications.some((app) => app.session_id === sessionId);
  
  // Check if user is already assigned as reviewer
  const isAssignedReviewer = session?.reviewers?.some((r) => r.id === user?.id) || false;

  // Handle apply to session
  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      await applicationsApi.create({
        session_id: sessionId,
        message: applyMessage,
      });
      toast.success('Application submitted successfully!');
      setApplyModal(false);
      setApplyMessage('');
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  // Session actions
  const handleDeleteSession = async () => {
    if (!confirm('Are you sure you want to delete this session? This will also delete all associated projects and reviews.')) return;
    
    try {
      await sessionsApi.delete(sessionId);
      toast.success('Session deleted');
      router.push('/sessions');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to delete session');
    }
  };

  const openEditSession = () => {
    if (!session) return;
    setSessionForm({
      name: session.name,
      description: session.description || '',
      start_date: session.start_date.slice(0, 16),
      end_date: session.end_date.slice(0, 16),
      location: session.location || '',
      status: session.status,
      max_projects: session.max_projects,
    });
    setEditSessionModal(true);
  };

  const handleSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      await sessionsApi.update(sessionId, sessionForm);
      toast.success('Session updated');
      setEditSessionModal(false);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to update session');
    } finally {
      setSubmitting(false);
    }
  };

  // Reviewer actions
  const handleRemoveReviewer = async (userId: number, name: string) => {
    if (!confirm(`Remove ${name} from this session?`)) return;
    
    try {
      await sessionsApi.removeReviewer(sessionId, userId);
      toast.success('Reviewer removed');
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to remove reviewer');
    }
  };

  // Tag actions
  const handleAddTag = async (tagId: number) => {
    try {
      await sessionsApi.addTag(sessionId, tagId);
      toast.success('Tag added');
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to add tag');
    }
  };

  const handleRemoveTag = async (tagId: number, tagName: string) => {
    if (!confirm(`Remove tag "${tagName}" from this session?`)) return;
    
    try {
      await sessionsApi.removeTag(sessionId, tagId);
      toast.success('Tag removed');
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to remove tag');
    }
  };

  const handleCreateAndAddTag = async () => {
    if (!newTagForm.name.trim()) {
      toast.error('Tag name is required');
      return;
    }
    
    try {
      setSubmitting(true);
      // Create the tag
      const response = await tagsApi.create({
        name: newTagForm.name.trim(),
        description: newTagForm.description.trim() || undefined,
      });
      const newTag = response.data;
      
      // Add to session
      await sessionsApi.addTag(sessionId, newTag.id);
      
      toast.success('Tag created and added to session');
      setNewTagForm({ name: '', description: '' });
      setShowCreateTag(false);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to create tag');
    } finally {
      setSubmitting(false);
    }
  };

  const getAvailableTags = () => {
    if (!session) return allTags;
    const sessionTagIds = session.tags?.map(t => t.id) || [];
    return allTags.filter(t => !sessionTagIds.includes(t.id));
  };

  // Criteria actions
  const handleCriteriaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      if (editingCriteria) {
        await criteriaApi.update(editingCriteria.id, criteriaForm);
        toast.success('Criteria updated');
      } else {
        await criteriaApi.create({
          session_id: sessionId,
          ...criteriaForm,
        });
        toast.success('Criteria added');
      }
      setCriteriaModal(false);
      resetCriteriaForm();
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to save criteria');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCriteria = async (id: number) => {
    if (!confirm('Are you sure you want to delete this criteria?')) return;
    
    try {
      await criteriaApi.delete(id);
      toast.success('Criteria deleted');
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to delete criteria');
    }
  };

  const resetCriteriaForm = () => {
    setEditingCriteria(null);
    setCriteriaForm({
      name: '',
      description: '',
      max_score: 10,
      weight: 1.0,
    });
  };

  const openEditCriteria = (criteria: Criteria) => {
    setEditingCriteria(criteria);
    setCriteriaForm({
      name: criteria.name,
      description: criteria.description || '',
      max_score: criteria.max_score,
      weight: criteria.weight,
    });
    setCriteriaModal(true);
  };

  // Project actions
  const openProjectDetail = async (project: ProjectWithStudent) => {
    setSelectedProject(project);
    setProjectEditForm({
      title: project.title,
      description: project.description || '',
      mentor_email: project.mentor_email || '',
    });
    setProjectSelectedTagIds(project.tags.map(t => t.id));
    try {
      const [reviewsRes, teamRes] = await Promise.all([
        reviewsApi.listForProject(project.id),
        projectsApi.getTeamMembers(project.id),
      ]);
      setProjectReviews(reviewsRes.data);
      setProjectTeamMembers(teamRes.data);
    } catch {
      setProjectReviews([]);
      setProjectTeamMembers([]);
    }
    setProjectDetailModal(true);
  };

  const handleUpdateProjectFromSession = async () => {
    if (!selectedProject) return;
    
    setSubmitting(true);
    try {
      await projectsApi.update(selectedProject.id, {
        title: projectEditForm.title,
        description: projectEditForm.description || undefined,
        mentor_email: projectEditForm.mentor_email || undefined,
        tag_ids: projectSelectedTagIds,
      });
      toast.success('Project updated');
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to update project');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddProjectTeamMember = async (studentId: number) => {
    if (!selectedProject) return;
    
    try {
      await projectsApi.addTeamMember(selectedProject.id, studentId);
      toast.success('Team member added');
      const res = await projectsApi.getTeamMembers(selectedProject.id);
      setProjectTeamMembers(res.data);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to add team member');
    }
  };

  const handleRemoveProjectTeamMember = async (studentId: number) => {
    if (!selectedProject) return;
    
    try {
      await projectsApi.removeTeamMember(selectedProject.id, studentId);
      toast.success('Team member removed');
      const res = await projectsApi.getTeamMembers(selectedProject.id);
      setProjectTeamMembers(res.data);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to remove team member');
    }
  };

  const toggleProjectTag = (tagId: number) => {
    setProjectSelectedTagIds(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const getAvailableStudentsForProjectTeam = () => {
    if (!selectedProject) return allStudents;
    const teamMemberIds = projectTeamMembers.map(m => m.id);
    return allStudents.filter(s => 
      s.id !== selectedProject.student_id && !teamMemberIds.includes(s.id)
    );
  };

  const handleRemoveProject = async (projectId: number, title: string) => {
    if (!confirm(`Remove project "${title}" from this session? This will delete all associated reviews.`)) return;
    
    try {
      await projectsApi.delete(projectId);
      toast.success('Project removed');
      setProjectDetailModal(false);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to remove project');
    }
  };

  const handleDeleteReview = async (reviewId: number) => {
    if (!confirm('Delete this review?')) return;
    
    try {
      await reviewsApi.delete(reviewId);
      toast.success('Review deleted');
      if (selectedProject) {
        const reviewsRes = await reviewsApi.listForProject(selectedProject.id);
        setProjectReviews(reviewsRes.data);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to delete review');
    }
  };

  const handleDeleteDocument = async (projectId: number, docType: 'paper' | 'slides' | 'docs') => {
    if (!confirm(`Delete ${docType}?`)) return;
    
    try {
      if (docType === 'paper') {
        await projectsApi.deletePaper(projectId);
      } else if (docType === 'slides') {
        await projectsApi.deleteSlides(projectId);
      } else {
        await projectsApi.deleteDocs(projectId);
      }
      toast.success('Document deleted');
      const projectRes = await projectsApi.get(projectId);
      setSelectedProject(projectRes.data);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to delete document');
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

  if (!session) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-slate-500">Session not found</p>
          <Link href="/sessions">
            <Button variant="secondary" className="mt-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Sessions
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6">
        <Link href="/sessions" className="text-primary-600 hover:text-primary-700 text-sm flex items-center mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Sessions
        </Link>
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{session.name}</h1>
              <Badge status={session.status}>{session.status}</Badge>
            </div>
            {session.description && (
              <p className="text-slate-600 mt-2">{session.description}</p>
            )}
          </div>
          
          {isAdmin && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={openEditSession}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button variant="danger" onClick={handleDeleteSession}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          )}
          
          {/* Reviewer Apply Button */}
          {isReviewer && session.status !== 'completed' && (
            <div className="flex items-center gap-3">
              {isAssignedReviewer ? (
                <Badge variant="success" className="text-sm py-2 px-4">
                  ✓ You are assigned to this session
                </Badge>
              ) : hasApplied ? (
                <Badge variant="primary" className="text-sm py-2 px-4">
                  Application Pending
                </Badge>
              ) : (
                <Button onClick={() => setApplyModal(true)}>
                  <Send className="w-4 h-4 mr-2" />
                  Apply to Review
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Session Info */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardBody className="flex items-center space-x-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <Clock className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Duration</p>
              <p className="font-medium text-slate-900">
                {formatDate(session.start_date)} - {formatDate(session.end_date)}
              </p>
            </div>
          </CardBody>
        </Card>
        
        {session.location && (
          <Card>
            <CardBody className="flex items-center space-x-3">
              <div className="p-2 bg-accent-100 rounded-lg">
                <MapPin className="w-5 h-5 text-accent-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Location</p>
                <p className="font-medium text-slate-900">{session.location}</p>
              </div>
            </CardBody>
          </Card>
        )}
        
        <Card>
          <CardBody className="flex items-center space-x-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <FolderKanban className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Projects</p>
              <p className="font-medium text-slate-900">
                {projects.length} / {session.max_projects}
              </p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Session Tags */}
      <Card className="mb-6">
        <CardHeader
          action={
            isAdmin && (
              <Button size="sm" onClick={() => setTagModal(true)}>
                <Plus className="w-4 h-4 mr-1" />
                Add Tag
              </Button>
            )
          }
        >
          <div className="flex items-center">
            <TagIcon className="w-5 h-5 text-slate-500 mr-2" />
            <h2 className="font-semibold text-slate-900">Session Tags</h2>
          </div>
        </CardHeader>
        <CardBody>
          {(!session.tags || session.tags.length === 0) ? (
            <p className="text-slate-500 text-sm">No tags assigned to this session</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {session.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-primary-100 text-primary-700"
                >
                  {tag.name}
                  {isAdmin && (
                    <button
                      onClick={() => handleRemoveTag(tag.id, tag.name)}
                      className="ml-1 hover:bg-primary-200 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Criteria */}
        <Card>
          <CardHeader
            action={
              isAdmin && (
                <Button
                  size="sm"
                  onClick={() => {
                    resetCriteriaForm();
                    setCriteriaModal(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              )
            }
          >
            <div className="flex items-center">
              <ClipboardList className="w-5 h-5 text-slate-500 mr-2" />
              <h2 className="font-semibold text-slate-900">Judging Criteria</h2>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {session.criteria.length === 0 ? (
              <div className="p-6 text-center text-slate-500">
                No criteria defined yet
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {session.criteria.map((criteria) => (
                  <div key={criteria.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{criteria.name}</p>
                      {criteria.description && (
                        <p className="text-sm text-slate-500 mt-1">{criteria.description}</p>
                      )}
                      <div className="flex gap-4 mt-2 text-xs text-slate-400">
                        <span>Max: {criteria.max_score}</span>
                        <span>Weight: {criteria.weight}x</span>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditCriteria(criteria)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCriteria(criteria.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Reviewers */}
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <Users className="w-5 h-5 text-slate-500 mr-2" />
              <h2 className="font-semibold text-slate-900">
                Assigned Reviewers ({session.reviewers.length})
              </h2>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {session.reviewers.length === 0 ? (
              <div className="p-6 text-center text-slate-500">
                No reviewers assigned yet
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {session.reviewers.map((reviewer) => (
                  <div key={reviewer.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center mr-3">
                        <span className="text-sm font-medium text-primary-700">
                          {reviewer.full_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{reviewer.full_name}</p>
                        <p className="text-sm text-slate-500">{getRoleLabel(reviewer.role)}</p>
                        {reviewer.affiliation && (
                          <p className="text-xs text-slate-400">{reviewer.affiliation}</p>
                        )}
                      </div>
                    </div>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveReviewer(reviewer.id, reviewer.full_name)}
                      >
                        <X className="w-4 h-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Projects */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center">
            <FolderKanban className="w-5 h-5 text-slate-500 mr-2" />
            <h2 className="font-semibold text-slate-900">
              Projects ({projects.length})
            </h2>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {projects.length === 0 ? (
            <div className="p-6 text-center text-slate-500">
              No projects in this session
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/projects/${project.id}`}
                      className="flex-1"
                    >
                      <p className="font-medium text-slate-900">{project.title}</p>
                      <p className="text-sm text-slate-500 mt-1">
                        By: {project.student.full_name}
                      </p>
                    </Link>
                    <div className="flex items-center gap-3">
                      {project.poster_number && (
                        <span className="text-sm text-slate-500">
                          #{project.poster_number}
                        </span>
                      )}
                      <Badge status={project.status}>{project.status}</Badge>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openProjectDetail(project)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {/* Assigned Reviewers */}
                  {project.assigned_reviewers && project.assigned_reviewers.length > 0 && (
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Reviewers:
                      </span>
                      {project.assigned_reviewers.map((reviewer) => (
                        <span
                          key={reviewer.id}
                          className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full"
                        >
                          {reviewer.full_name}
                        </span>
                      ))}
                    </div>
                  )}
                  {project.status === 'approved' && (!project.assigned_reviewers || project.assigned_reviewers.length === 0) && (
                    <div className="mt-2 text-xs text-amber-600 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      No reviewers assigned
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Edit Session Modal */}
      <Modal
        isOpen={editSessionModal}
        onClose={() => setEditSessionModal(false)}
        title="Edit Session"
      >
        <form onSubmit={handleSessionSubmit} className="space-y-4">
          <Input
            label="Session Name"
            value={sessionForm.name}
            onChange={(e) => setSessionForm({ ...sessionForm, name: e.target.value })}
            required
          />
          <Textarea
            label="Description"
            value={sessionForm.description}
            onChange={(e) => setSessionForm({ ...sessionForm, description: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              type="datetime-local"
              label="Start Date"
              value={sessionForm.start_date}
              onChange={(e) => setSessionForm({ ...sessionForm, start_date: e.target.value })}
              required
            />
            <Input
              type="datetime-local"
              label="End Date"
              value={sessionForm.end_date}
              onChange={(e) => setSessionForm({ ...sessionForm, end_date: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Location"
              value={sessionForm.location}
              onChange={(e) => setSessionForm({ ...sessionForm, location: e.target.value })}
            />
            <Input
              type="number"
              label="Max Projects"
              value={sessionForm.max_projects}
              onChange={(e) => setSessionForm({ ...sessionForm, max_projects: parseInt(e.target.value) })}
              min={1}
            />
          </div>
          <Select
            label="Status"
            options={statusOptions}
            value={sessionForm.status}
            onChange={(e) => setSessionForm({ ...sessionForm, status: e.target.value })}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={() => setEditSessionModal(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={submitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Criteria Modal */}
      <Modal
        isOpen={criteriaModal}
        onClose={() => {
          setCriteriaModal(false);
          resetCriteriaForm();
        }}
        title={editingCriteria ? 'Edit Criteria' : 'Add Criteria'}
      >
        <form onSubmit={handleCriteriaSubmit} className="space-y-4">
          <Input
            label="Criteria Name"
            placeholder="e.g., Presentation Quality"
            value={criteriaForm.name}
            onChange={(e) => setCriteriaForm({ ...criteriaForm, name: e.target.value })}
            required
          />
          <Textarea
            label="Description"
            placeholder="Describe what reviewers should evaluate..."
            value={criteriaForm.description}
            onChange={(e) => setCriteriaForm({ ...criteriaForm, description: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              type="number"
              label="Max Score"
              value={criteriaForm.max_score}
              onChange={(e) => setCriteriaForm({ ...criteriaForm, max_score: parseInt(e.target.value) })}
              min={1}
              max={100}
              required
            />
            <Input
              type="number"
              label="Weight"
              value={criteriaForm.weight}
              onChange={(e) => setCriteriaForm({ ...criteriaForm, weight: parseFloat(e.target.value) })}
              min={0.1}
              max={10}
              step={0.1}
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setCriteriaModal(false);
                resetCriteriaForm();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={submitting}>
              {editingCriteria ? 'Update' : 'Add'} Criteria
            </Button>
          </div>
        </form>
      </Modal>

      {/* Project Detail Modal (Admin) */}
      <Modal
        isOpen={projectDetailModal}
        onClose={() => {
          setProjectDetailModal(false);
          setSelectedProject(null);
          setProjectReviews([]);
          setProjectTeamMembers([]);
        }}
        title="Manage Project"
      >
        {selectedProject && (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto">
            <div className="pb-4 border-b">
              <Badge status={selectedProject.status} className="mb-2">{selectedProject.status}</Badge>
              <p className="text-sm text-slate-500">
                Owner: {selectedProject.student.full_name}
              </p>
            </div>

            {/* Edit Project Details */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Edit className="w-4 h-4 text-slate-500" />
                <h4 className="font-medium text-slate-700">Edit Project Details</h4>
              </div>
              
              <Input
                label="Project Title"
                value={projectEditForm.title}
                onChange={(e) => setProjectEditForm({ ...projectEditForm, title: e.target.value })}
                required
              />
              
              <Textarea
                label="Description"
                value={projectEditForm.description}
                onChange={(e) => setProjectEditForm({ ...projectEditForm, description: e.target.value })}
                rows={3}
              />
              
              <Input
                label="Mentor Email"
                type="email"
                value={projectEditForm.mentor_email}
                onChange={(e) => setProjectEditForm({ ...projectEditForm, mentor_email: e.target.value })}
                placeholder="mentor@university.edu"
              />
              
              {/* Tags Selection */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TagIcon className="w-4 h-4 text-slate-500" />
                  <label className="text-sm font-medium text-slate-700">Tags</label>
                </div>
                <div className="flex flex-wrap gap-2 p-3 border border-slate-200 rounded-lg max-h-32 overflow-y-auto">
                  {allTags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleProjectTag(tag.id)}
                      className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                        projectSelectedTagIds.includes(tag.id)
                          ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-500'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {tag.name}
                      {projectSelectedTagIds.includes(tag.id) && (
                        <span className="ml-1">✓</span>
                      )}
                    </button>
                  ))}
                  {allTags.length === 0 && (
                    <span className="text-sm text-slate-400">No tags available</span>
                  )}
                </div>
              </div>
              
              <Button
                onClick={handleUpdateProjectFromSession}
                isLoading={submitting}
                disabled={!projectEditForm.title.trim()}
                className="w-full"
              >
                Save Changes
              </Button>
            </div>

            <hr />

            {/* Manage Team Members */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-500" />
                <h4 className="font-medium text-slate-700">Team Members</h4>
              </div>
              
              {/* Project Owner */}
              <div className="p-2 bg-primary-50 rounded-lg">
                <p className="text-xs text-primary-600 font-medium mb-1">Project Owner</p>
                <p className="text-sm font-medium text-slate-900">{selectedProject.student.full_name}</p>
                <p className="text-xs text-slate-500">{selectedProject.student.email}</p>
              </div>
              
              {/* Current Team Members */}
              {projectTeamMembers.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500 font-medium">Team Members</p>
                  {projectTeamMembers.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{member.full_name}</p>
                        <p className="text-xs text-slate-500">{member.email}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveProjectTeamMember(member.id)}
                      >
                        <X className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Add Team Member */}
              {getAvailableStudentsForProjectTeam().length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 font-medium mb-2">Add Team Member</p>
                  <div className="max-h-32 overflow-y-auto space-y-1 border border-slate-200 rounded-lg p-2">
                    {getAvailableStudentsForProjectTeam().map((student) => (
                      <button
                        key={student.id}
                        onClick={() => handleAddProjectTeamMember(student.id)}
                        className="w-full flex items-center justify-between p-2 text-left hover:bg-slate-50 rounded transition-colors"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-900">{student.full_name}</p>
                          <p className="text-xs text-slate-500">{student.email}</p>
                        </div>
                        <UserPlus className="w-4 h-4 text-primary-600" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <hr />

            {/* Documents */}
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-2">Documents</h4>
              <div className="space-y-2">
                {selectedProject.paper_path ? (
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                    <div className="flex items-center">
                      <FileText className="w-4 h-4 text-green-600 mr-2" />
                      <span className="text-sm">Paper</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteDocument(selectedProject.id, 'paper')}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No paper uploaded</p>
                )}
                
                {selectedProject.slides_path ? (
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                    <div className="flex items-center">
                      <Presentation className="w-4 h-4 text-blue-600 mr-2" />
                      <span className="text-sm">Slides</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteDocument(selectedProject.id, 'slides')}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No slides uploaded</p>
                )}
                
                {selectedProject.additional_docs_path ? (
                  <div className="flex items-center justify-between p-2 bg-slate-50 rounded">
                    <div className="flex items-center">
                      <File className="w-4 h-4 text-purple-600 mr-2" />
                      <span className="text-sm">Additional Docs</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteDocument(selectedProject.id, 'docs')}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">No additional docs uploaded</p>
                )}
              </div>
            </div>

            {/* Reviews */}
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-2">Reviews ({projectReviews.length})</h4>
              {projectReviews.length === 0 ? (
                <p className="text-sm text-slate-400">No reviews yet</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {projectReviews.map((review) => (
                    <div key={review.id} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                      <div>
                        <p className="text-sm font-medium">{review.reviewer?.full_name || 'Reviewer'}</p>
                        <div className="flex items-center text-xs text-slate-500">
                          <Star className="w-3 h-3 mr-1 text-yellow-500" />
                          {review.total_score?.toFixed(1) || 'N/A'}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteReview(review.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-between pt-4 border-t">
              <Button
                variant="danger"
                onClick={() => handleRemoveProject(selectedProject.id, selectedProject.title)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Project
              </Button>
              <Button variant="secondary" onClick={() => setProjectDetailModal(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Tag Selection Modal */}
      <Modal
        isOpen={tagModal}
        onClose={() => {
          setTagModal(false);
          setShowCreateTag(false);
          setNewTagForm({ name: '', description: '' });
        }}
        title="Add Tag to Session"
      >
        <div className="space-y-4">
          {showCreateTag ? (
            <div className="space-y-4">
              <Input
                label="Tag Name"
                value={newTagForm.name}
                onChange={(e) => setNewTagForm({ ...newTagForm, name: e.target.value })}
                placeholder="Enter tag name"
                required
              />
              <Textarea
                label="Description (optional)"
                value={newTagForm.description}
                onChange={(e) => setNewTagForm({ ...newTagForm, description: e.target.value })}
                placeholder="Enter tag description"
                rows={2}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowCreateTag(false);
                    setNewTagForm({ name: '', description: '' });
                  }}
                >
                  Back
                </Button>
                <Button
                  variant="primary"
                  onClick={handleCreateAndAddTag}
                  disabled={submitting || !newTagForm.name.trim()}
                >
                  {submitting ? 'Creating...' : 'Create & Add Tag'}
                </Button>
              </div>
            </div>
          ) : (
            <>
              {isAdmin && (
                <Button
                  variant="secondary"
                  onClick={() => setShowCreateTag(true)}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Tag
                </Button>
              )}
              {getAvailableTags().length === 0 ? (
                <p className="text-slate-500 text-center py-4">
                  No more tags available.{!isAdmin && ' Ask an admin to create new tags.'}
                </p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {getAvailableTags().map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => {
                        handleAddTag(tag.id);
                        setTagModal(false);
                      }}
                      className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <div>
                        <p className="font-medium text-slate-900">{tag.name}</p>
                        {tag.description && (
                          <p className="text-sm text-slate-500">{tag.description}</p>
                        )}
                      </div>
                      <Plus className="w-5 h-5 text-primary-600" />
                    </button>
                  ))}
                </div>
              )}
              <div className="flex justify-end pt-4">
                <Button variant="secondary" onClick={() => setTagModal(false)}>
                  Cancel
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Apply to Session Modal (for reviewers) */}
      <Modal
        isOpen={applyModal}
        onClose={() => setApplyModal(false)}
        title="Apply to Review This Session"
      >
        <form onSubmit={handleApply} className="space-y-4">
          <div className="p-4 bg-slate-50 rounded-lg">
            <h3 className="font-medium text-slate-900">{session.name}</h3>
            <p className="text-sm text-slate-500 mt-1">
              {formatDate(session.start_date)} - {formatDate(session.end_date)}
            </p>
            {session.location && (
              <p className="text-sm text-slate-500">{session.location}</p>
            )}
          </div>
          
          <Textarea
            label="Application Message (Optional)"
            placeholder="Explain why you'd like to review projects in this session, your relevant expertise, etc."
            value={applyMessage}
            onChange={(e) => setApplyMessage(e.target.value)}
            rows={4}
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
