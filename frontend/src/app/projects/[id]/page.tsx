'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import { useAuthStore } from '@/lib/store';
import { projectsApi, reviewsApi, criteriaApi, tagsApi } from '@/lib/api';
import { ProjectWithStudent, Review, Criteria, Tag } from '@/types';
import { formatDate, formatDateTime, getRoleLabel } from '@/lib/utils';
import Link from 'next/link';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import {
  ArrowLeft,
  Upload,
  FileText,
  Presentation,
  File,
  Trash2,
  Edit,
  Star,
  User,
  Users,
  Calendar,
  Tag as TagIcon,
  Download,
} from 'lucide-react';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const projectId = parseInt(params.id as string);

  const [project, setProject] = useState<ProjectWithStudent | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [criteria, setCriteria] = useState<Criteria[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    mentor_email: '',
    tag_ids: [] as number[],
  });
  const [saving, setSaving] = useState(false);

  const paperInputRef = useRef<HTMLInputElement>(null);
  const slidesInputRef = useRef<HTMLInputElement>(null);
  const docsInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      const [projectRes, reviewsRes, tagsRes] = await Promise.all([
        projectsApi.get(projectId),
        reviewsApi.listForProject(projectId).catch(() => ({ data: [] })),
        tagsApi.list(),
      ]);
      setProject(projectRes.data);
      setReviews(reviewsRes.data);
      setAllTags(tagsRes.data);

      if (projectRes.data.session_id) {
        const criteriaRes = await criteriaApi.listForSession(projectRes.data.session_id);
        setCriteria(criteriaRes.data);
      }
    } catch (error) {
      console.error('Error loading project:', error);
      toast.error('Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (type: 'paper' | 'slides' | 'docs', file: File) => {
    setUploading(type);
    try {
      if (type === 'paper') {
        await projectsApi.uploadPaper(projectId, file);
      } else if (type === 'slides') {
        await projectsApi.uploadSlides(projectId, file);
      } else {
        await projectsApi.uploadDocs(projectId, file);
      }
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} uploaded successfully`);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || `Failed to upload ${type}`);
    } finally {
      setUploading(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    
    try {
      await projectsApi.delete(projectId);
      toast.success('Project deleted');
      router.push('/projects');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to delete project');
    }
  };

  const openEditModal = () => {
    if (project) {
      setEditForm({
        title: project.title,
        description: project.description || '',
        mentor_email: project.mentor_email || '',
        tag_ids: project.tags.map((t) => t.id),
      });
      setEditModal(true);
    }
  };

  const handleSaveEdit = async () => {
    if (!project) return;
    setSaving(true);
    try {
      await projectsApi.update(projectId, {
        title: editForm.title,
        description: editForm.description,
        mentor_email: editForm.mentor_email || undefined,
        tag_ids: editForm.tag_ids,
      });
      toast.success('Project updated successfully');
      setEditModal(false);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to update project');
    } finally {
      setSaving(false);
    }
  };

  const toggleTag = (tagId: number) => {
    setEditForm((prev) => ({
      ...prev,
      tag_ids: prev.tag_ids.includes(tagId)
        ? prev.tag_ids.filter((id) => id !== tagId)
        : [...prev.tag_ids, tagId],
    }));
  };

  const isOwner = user?.id === project?.student_id;
  const isTeamMember = project?.team_members?.some((m) => m.id === user?.id) || false;
  const canEdit = isOwner && project?.status === 'pending';
  const canUpload = (isOwner || isTeamMember) && (project?.status === 'pending' || project?.status === 'approved');
  
  // Check if any files are uploaded
  const hasAnyFiles = project?.paper_path || project?.slides_path || project?.additional_docs_path;

  // Warning for owner or team members
  const showUploadWarning = (isOwner || isTeamMember) && !hasAnyFiles;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!project) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-slate-500">Project not found</p>
          <Link href="/projects">
            <Button variant="secondary" className="mt-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Projects
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const averageScore = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + (r.total_score || 0), 0) / reviews.length
    : null;

  return (
    <DashboardLayout>
      {/* Warning if no files uploaded */}
      {showUploadWarning && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-amber-800 font-medium">⚠️ No documents uploaded</p>
          <p className="text-sm text-amber-700 mt-1">
            Please upload at least one document (paper, slides, or additional docs) to complete your project submission.
          </p>
        </div>
      )}
      
      {/* Header */}
      <div className="mb-6">
        <Link
          href={isOwner ? '/projects' : '/admin/projects'}
          className="text-primary-600 hover:text-primary-700 text-sm flex items-center mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Projects
        </Link>
        
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{project.title}</h1>
              <Badge status={project.status}>{project.status}</Badge>
            </div>
            {project.poster_number && (
              <p className="text-lg text-primary-600 font-medium mt-1">
                Poster #{project.poster_number}
              </p>
            )}
          </div>
          
          {canEdit && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={openEditModal}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button variant="danger" onClick={handleDelete}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-slate-900">Description</h2>
            </CardHeader>
            <CardBody>
              <p className="text-slate-600 whitespace-pre-wrap">
                {project.description || 'No description provided.'}
              </p>
            </CardBody>
          </Card>

          {/* Files */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-slate-900">Documents</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              {/* Paper */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg mr-3">
                    <FileText className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Paper</p>
                    <p className="text-sm text-slate-500">
                      {project.paper_path ? 'Uploaded' : 'Not uploaded'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {project.paper_path && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => projectsApi.downloadPaper(projectId)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  )}
                  {canUpload && (
                    <>
                      <input
                        type="file"
                        ref={paperInputRef}
                        className="hidden"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => e.target.files?.[0] && handleFileUpload('paper', e.target.files[0])}
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => paperInputRef.current?.click()}
                        isLoading={uploading === 'paper'}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {project.paper_path ? 'Replace' : 'Upload'}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Slides */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg mr-3">
                    <Presentation className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Slides</p>
                    <p className="text-sm text-slate-500">
                      {project.slides_path ? 'Uploaded' : 'Not uploaded'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {project.slides_path && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => projectsApi.downloadSlides(projectId)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  )}
                  {canUpload && (
                    <>
                      <input
                        type="file"
                        ref={slidesInputRef}
                        className="hidden"
                        accept=".pdf,.ppt,.pptx"
                        onChange={(e) => e.target.files?.[0] && handleFileUpload('slides', e.target.files[0])}
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => slidesInputRef.current?.click()}
                        isLoading={uploading === 'slides'}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {project.slides_path ? 'Replace' : 'Upload'}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Additional Docs */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg mr-3">
                    <File className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Additional Documents</p>
                    <p className="text-sm text-slate-500">
                      {project.additional_docs_path ? 'Uploaded' : 'Not uploaded'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {project.additional_docs_path && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => projectsApi.downloadDocs(projectId)}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  )}
                  {canUpload && (
                    <>
                      <input
                        type="file"
                        ref={docsInputRef}
                        className="hidden"
                        accept=".pdf,.doc,.docx,.zip"
                        onChange={(e) => e.target.files?.[0] && handleFileUpload('docs', e.target.files[0])}
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => docsInputRef.current?.click()}
                        isLoading={uploading === 'docs'}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {project.additional_docs_path ? 'Replace' : 'Upload'}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Reviews */}
          {reviews.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-slate-900">Reviews</h2>
                  {averageScore !== null && (
                    <div className="flex items-center text-yellow-500">
                      <Star className="w-5 h-5 fill-current mr-1" />
                      <span className="font-medium">{averageScore.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardBody className="p-0">
                <div className="divide-y divide-slate-100">
                  {reviews.map((review) => (
                    <div key={review.id} className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center mr-2">
                            <span className="text-sm font-medium text-primary-700">
                              {review.reviewer.full_name.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">
                              {review.reviewer.full_name}
                            </p>
                            {review.reviewer.affiliation && (
                              <p className="text-xs text-slate-400">{review.reviewer.affiliation}</p>
                            )}
                            <p className="text-xs text-slate-500">
                              {formatDate(review.created_at)}
                            </p>
                          </div>
                        </div>
                        {review.total_score != null && (
                          <Badge variant="primary">
                            Score: {review.total_score.toFixed(1)}
                          </Badge>
                        )}
                      </div>
                      {review.comments && (
                        <p className="text-sm text-slate-600 mt-2">{review.comments}</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Info Card */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-slate-900">Information</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="flex items-center">
                <User className="w-5 h-5 text-slate-400 mr-3" />
                <div>
                  <p className="text-sm text-slate-500">Submitted by</p>
                  <p className="font-medium text-slate-900">{project.student.full_name}</p>
                </div>
              </div>
              {project.team_members && project.team_members.length > 0 && (
                <div>
                  <p className="text-sm text-slate-500 mb-2">Team Members</p>
                  <div className="space-y-2">
                    {project.team_members.map((member) => (
                      <div key={member.id} className="flex items-center">
                        <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center mr-2">
                          <span className="text-xs font-medium text-primary-700">
                            {member.full_name.charAt(0)}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-slate-900">{member.full_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {project.pending_invitations && project.pending_invitations.filter(inv => inv.status === 'pending').length > 0 && (
                <div>
                  <p className="text-sm text-slate-500 mb-2">Pending Invitations</p>
                  <div className="space-y-2">
                    {project.pending_invitations.filter(inv => inv.status === 'pending').map((inv) => (
                      <div key={inv.id} className="flex items-center">
                        <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center mr-2">
                          <span className="text-xs font-medium text-amber-700">?</span>
                        </div>
                        <span className="text-sm text-slate-600">{inv.email}</span>
                        <Badge variant="warning" className="ml-2 text-xs">Pending</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {project.mentor_email && (
                <div>
                  <p className="text-sm text-slate-500">Mentor</p>
                  <p className="font-medium text-slate-900">{project.mentor_email}</p>
                </div>
              )}
              <div className="flex items-center">
                <Calendar className="w-5 h-5 text-slate-400 mr-3" />
                <div>
                  <p className="text-sm text-slate-500">Submitted on</p>
                  <p className="font-medium text-slate-900">{formatDateTime(project.created_at)}</p>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Tags */}
          {project.tags.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center">
                  <TagIcon className="w-5 h-5 text-slate-400 mr-2" />
                  <h2 className="font-semibold text-slate-900">Tags</h2>
                </div>
              </CardHeader>
              <CardBody>
                <div className="flex flex-wrap gap-2">
                  {project.tags.map((tag) => (
                    <Badge key={tag.id} variant="gray">
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}

          {/* Assigned Reviewers */}
          {project.assigned_reviewers && project.assigned_reviewers.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center">
                  <Users className="w-5 h-5 text-slate-400 mr-2" />
                  <h2 className="font-semibold text-slate-900">Assigned Reviewers</h2>
                </div>
              </CardHeader>
              <CardBody>
                <div className="space-y-3">
                  {project.assigned_reviewers.map((reviewer) => (
                    <div key={reviewer.id} className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center mr-3">
                        <span className="text-sm font-medium text-indigo-700">
                          {reviewer.full_name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{reviewer.full_name}</p>
                        <p className="text-xs text-slate-500">{reviewer.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={editModal}
        onClose={() => setEditModal(false)}
        title="Edit Project"
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Project Title"
            value={editForm.title}
            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
            required
          />
          <Textarea
            label="Description"
            value={editForm.description}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            rows={4}
          />
          <Input
            label="Mentor Email (Optional)"
            type="email"
            value={editForm.mentor_email}
            onChange={(e) => setEditForm({ ...editForm, mentor_email: e.target.value })}
            placeholder="Enter mentor's email address"
          />
          
          {allTags.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Tags</label>
              <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      editForm.tag_ids.includes(tag.id)
                        ? 'bg-primary-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} isLoading={saving}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
