'use client';

import { useEffect, useState, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import EmptyState from '@/components/ui/EmptyState';
import { useAuthStore } from '@/lib/store';
import { projectsApi, sessionsApi, tagsApi } from '@/lib/api';
import { Project, Session, Tag, PendingInvitation } from '@/types';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  FolderKanban,
  Plus,
  Upload,
  FileText,
  Presentation,
  File,
  Users,
  Mail,
  Star,
} from 'lucide-react';

export default function ProjectsPage() {
  const { user } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    session_id: '',
    tag_ids: [] as number[],
    team_member_emails: ['', ''] as string[],
    mentor_email: '',
  });
  const [paperFile, setPaperFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [projectsRes, sessionsRes, tagsRes, invitationsRes] = await Promise.all([
        projectsApi.getMyProjects(),
        sessionsApi.listAvailable(),
        tagsApi.list(),
        projectsApi.getMyInvitations(),
      ]);
      setProjects(projectsRes.data);
      setSessions(sessionsRes.data);
      setTags(tagsRes.data);
      setInvitations(invitationsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvitation = async (invitationId: number) => {
    try {
      await projectsApi.acceptInvitation(invitationId);
      toast.success('Invitation accepted!');
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to accept invitation');
    }
  };

  const handleDeclineInvitation = async (invitationId: number) => {
    try {
      await projectsApi.declineInvitation(invitationId);
      toast.success('Invitation declined');
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to decline invitation');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate that at least one file is selected
    if (!paperFile) {
      toast.error('Please upload a paper/document for your project');
      return;
    }
    
    setSubmitting(true);
    
    try {
      // Filter out empty team member emails
      const teamEmails = formData.team_member_emails.filter(email => email.trim() !== '');
      
      // Create the project first
      const response = await projectsApi.create({
        title: formData.title,
        description: formData.description,
        session_id: formData.session_id ? parseInt(formData.session_id) : undefined,
        tag_ids: formData.tag_ids,
        team_member_emails: teamEmails,
        mentor_email: formData.mentor_email.trim() || undefined,
      });
      
      // Upload the paper file
      await projectsApi.uploadPaper(response.data.id, paperFile);
      
      toast.success('Project created with document!');
      setCreateModal(false);
      setFormData({
        title: '',
        description: '',
        session_id: '',
        tag_ids: [],
        team_member_emails: ['', ''],
        mentor_email: '',
      });
      setPaperFile(null);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to create project');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTag = (tagId: number) => {
    setFormData((prev) => ({
      ...prev,
      tag_ids: prev.tag_ids.includes(tagId)
        ? prev.tag_ids.filter((id) => id !== tagId)
        : [...prev.tag_ids, tagId],
    }));
  };

  if (loading) {
    return (
      <DashboardLayout allowedRoles={['student']}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout allowedRoles={['student']}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Projects</h1>
          <p className="text-slate-600 mt-1">Manage your submitted projects</p>
        </div>
        <Button onClick={() => setCreateModal(true)} className="mt-4 sm:mt-0">
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </Button>
      </div>

      {/* Pending Team Invitations */}
      {invitations.length > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardHeader>
            <h2 className="font-semibold text-amber-800">Team Invitations</h2>
          </CardHeader>
          <CardBody className="space-y-3">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-amber-200">
                <div>
                  <p className="font-medium text-slate-900">{inv.project_title}</p>
                  <p className="text-sm text-slate-500">Invited by {inv.invited_by} • {formatDate(inv.created_at)}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleAcceptInvitation(inv.id)}>
                    Accept
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => handleDeclineInvitation(inv.id)}>
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {projects.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<FolderKanban className="w-12 h-12" />}
              title="No Projects Yet"
              description="Submit your first project to get started."
              action={
                <Button onClick={() => setCreateModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Submit Project
                </Button>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Sort and separate projects */}
          {(() => {
            const pendingProjects = projects.filter(p => p.status === 'pending');
            const otherProjects = projects.filter(p => p.status !== 'pending');

            const renderProjectCard = (project: Project) => (
              <Card key={project.id} className={`hover:shadow-md transition-shadow ${project.status === 'pending' ? 'border-amber-200' : ''}`}>
                <CardBody>
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-slate-900">{project.title}</h3>
                        <Badge status={project.status}>{project.status}</Badge>
                      </div>
                      {project.description && (
                        <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                          {project.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 mb-3">
                        {project.tags.map((tag) => (
                          <Badge key={tag.id} variant="gray">
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                      
                      {/* Team Members */}
                      {project.team_members && project.team_members.length > 0 && (
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="w-4 h-4 text-slate-400" />
                          <span className="text-sm text-slate-600">Team:</span>
                          <div className="flex flex-wrap gap-1">
                            {project.team_members.map((member) => (
                              <span key={member.id} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                                {member.full_name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Mentor */}
                      {project.mentor_email && (
                        <div className="flex items-center gap-2 mb-2">
                          <Mail className="w-4 h-4 text-slate-400" />
                          <span className="text-sm text-slate-600">Mentor:</span>
                          <span className="text-sm text-slate-700">{project.mentor_email}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-4 mt-3 text-sm text-slate-500">
                        <span>Submitted {formatDate(project.created_at)}</span>
                        {project.poster_number && (
                          <span>Poster #{project.poster_number}</span>
                        )}
                      </div>
                      
                      {/* Average Score */}
                      {project.review_count && project.review_count > 0 && (
                        <div className="flex items-center gap-2 mt-2">
                          <Star className="w-4 h-4 text-yellow-500 fill-current" />
                          <span className="text-sm font-medium text-slate-700">
                            Avg Score: {project.avg_score?.toFixed(1) ?? 'N/A'}
                          </span>
                          <span className="text-xs text-slate-500">
                            ({project.review_count} {project.review_count === 1 ? 'review' : 'reviews'})
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {project.paper_path && (
                          <div className="p-2 bg-green-100 rounded-lg" title="Paper uploaded">
                            <FileText className="w-4 h-4 text-green-600" />
                          </div>
                        )}
                        {project.slides_path && (
                          <div className="p-2 bg-blue-100 rounded-lg" title="Slides uploaded">
                            <Presentation className="w-4 h-4 text-blue-600" />
                          </div>
                        )}
                        {project.additional_docs_path && (
                          <div className="p-2 bg-purple-100 rounded-lg" title="Docs uploaded">
                            <File className="w-4 h-4 text-purple-600" />
                          </div>
                        )}
                      </div>
                      <Link href={`/projects/${project.id}`}>
                        <Button variant="secondary" size="sm">
                          View Details
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardBody>
              </Card>
            );

            return (
              <>
                {/* Pending Projects */}
                {pendingProjects.length > 0 && (
                  <div>
                    <h2 className="text-lg font-semibold text-amber-700 mb-3 flex items-center gap-2">
                      <span className="w-3 h-3 bg-amber-500 rounded-full"></span>
                      Pending Approval ({pendingProjects.length})
                    </h2>
                    <div className="grid gap-4">
                      {pendingProjects.map(renderProjectCard)}
                    </div>
                  </div>
                )}

                {/* Other Projects */}
                {otherProjects.length > 0 && (
                  <div>
                    {pendingProjects.length > 0 && (
                      <h2 className="text-lg font-semibold text-slate-700 mb-3 flex items-center gap-2">
                        <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                        Reviewed Projects ({otherProjects.length})
                      </h2>
                    )}
                    <div className="grid gap-4">
                      {otherProjects.map(renderProjectCard)}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={createModal}
        onClose={() => setCreateModal(false)}
        title="Submit New Project"
        size="lg"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Project Title"
            placeholder="Enter your project title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
          />
          <Textarea
            label="Description"
            placeholder="Describe your project..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <Select
            label="Session"
            options={[
              { value: '', label: 'Select a session' },
              ...sessions.map((s) => ({ value: s.id.toString(), label: s.name })),
            ]}
            value={formData.session_id}
            onChange={(e) => setFormData({ ...formData, session_id: e.target.value })}
            required
          />
          
          {/* Team Members */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Team Members (Optional)
            </label>
            <p className="text-xs text-slate-500 mb-3">
              Invite up to 2 additional students to your team. They must be registered in the system.
            </p>
            <div className="space-y-2">
              {formData.team_member_emails.map((email, index) => (
                <Input
                  key={index}
                  type="email"
                  placeholder={`Team member ${index + 1} email`}
                  value={email}
                  onChange={(e) => {
                    const newEmails = [...formData.team_member_emails];
                    newEmails[index] = e.target.value;
                    setFormData({ ...formData, team_member_emails: newEmails });
                  }}
                />
              ))}
            </div>
          </div>
          
          {/* Mentor Email */}
          <Input
            label="Mentor Email (Optional)"
            type="email"
            placeholder="Enter your mentor's email address"
            value={formData.mentor_email}
            onChange={(e) => setFormData({ ...formData, mentor_email: e.target.value })}
          />
          
          {/* File Upload - Required */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Paper/Document <span className="text-red-500">*</span>
            </label>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".pdf,.doc,.docx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setPaperFile(file);
                  }
                }}
              />
              {paperFile ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="w-5 h-5 text-green-600" />
                  <span className="text-sm text-slate-700">{paperFile.name}</span>
                  <button
                    type="button"
                    onClick={() => setPaperFile(null)}
                    className="text-red-500 hover:text-red-700 text-sm ml-2"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div>
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-600 mb-2">Upload your project paper</p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose File
                  </Button>
                  <p className="text-xs text-slate-500 mt-2">PDF, DOC, or DOCX (Required)</p>
                </div>
              )}
            </div>
          </div>
          
          {tags.length > 0 && (
            <div>
              <label className="label">Tags</label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      formData.tag_ids.includes(tag.id)
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
            <Button type="button" variant="secondary" onClick={() => setCreateModal(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={submitting}>
              Submit Project
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
