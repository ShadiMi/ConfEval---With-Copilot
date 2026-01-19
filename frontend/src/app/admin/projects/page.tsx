'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import EmptyState from '@/components/ui/EmptyState';
import { projectsApi, sessionsApi, authApi, tagsApi } from '@/lib/api';
import { ProjectWithStudent, Session, User, Tag } from '@/types';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  FolderKanban,
  Check,
  X,
  Eye,
  FileText,
  Presentation,
  File,
  Edit,
  Trash2,
  RefreshCw,
  Users,
  Tag as TagIcon,
  Plus,
  UserPlus,
} from 'lucide-react';

const statusOptions = [
  { value: '', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<ProjectWithStudent[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  
  // Approve modal
  const [approveModal, setApproveModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectWithStudent | null>(null);
  const [posterNumber, setPosterNumber] = useState('');
  
  // Edit/Manage modal
  const [manageModal, setManageModal] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  
  // Edit form for project details
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    mentor_email: '',
  });
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const loadData = async () => {
    try {
      const [projectsRes, sessionsRes, studentsRes, tagsRes] = await Promise.all([
        projectsApi.list({ status: statusFilter || undefined }),
        sessionsApi.list(),
        authApi.getUsers('student'),
        tagsApi.list(),
      ]);
      setProjects(projectsRes.data);
      setSessions(sessionsRes.data);
      setStudents(studentsRes.data);
      setAllTags(tagsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    
    setSubmitting(true);
    try {
      await projectsApi.updateStatus(selectedProject.id, 'approved', posterNumber);
      toast.success('Project approved');
      setApproveModal(false);
      setSelectedProject(null);
      setPosterNumber('');
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to approve project');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async (projectId: number) => {
    if (!confirm('Are you sure you want to reject this project?')) return;
    
    try {
      await projectsApi.updateStatus(projectId, 'rejected');
      toast.success('Project rejected');
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to reject project');
    }
  };

  const handleDelete = async (projectId: number, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) return;
    
    try {
      await projectsApi.delete(projectId);
      toast.success('Project deleted');
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to delete project');
    }
  };

  const openManageModal = async (project: ProjectWithStudent) => {
    setSelectedProject(project);
    setSelectedSessionId(project.session_id?.toString() || '');
    setEditForm({
      title: project.title,
      description: project.description || '',
      mentor_email: project.mentor_email || '',
    });
    setSelectedTagIds(project.tags.map(t => t.id));
    // Load team members
    try {
      const res = await projectsApi.getTeamMembers(project.id);
      setTeamMembers(res.data);
    } catch {
      setTeamMembers([]);
    }
    setManageModal(true);
  };

  const handleReassignSession = async () => {
    if (!selectedProject) return;
    
    setSubmitting(true);
    try {
      const newSessionId = selectedSessionId ? parseInt(selectedSessionId) : null;
      await projectsApi.reassignSession(selectedProject.id, newSessionId);
      toast.success('Session updated');
      loadData();
      setManageModal(false);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to reassign session');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddTeamMember = async (studentId: number) => {
    if (!selectedProject) return;
    
    try {
      await projectsApi.addTeamMember(selectedProject.id, studentId);
      toast.success('Team member added');
      // Reload team members
      const res = await projectsApi.getTeamMembers(selectedProject.id);
      setTeamMembers(res.data);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to add team member');
    }
  };

  const handleRemoveTeamMember = async (studentId: number) => {
    if (!selectedProject) return;
    
    try {
      await projectsApi.removeTeamMember(selectedProject.id, studentId);
      toast.success('Team member removed');
      // Reload team members
      const res = await projectsApi.getTeamMembers(selectedProject.id);
      setTeamMembers(res.data);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to remove team member');
    }
  };

  const handleUpdateProject = async () => {
    if (!selectedProject) return;
    
    setSubmitting(true);
    try {
      await projectsApi.update(selectedProject.id, {
        title: editForm.title,
        description: editForm.description || undefined,
        mentor_email: editForm.mentor_email || undefined,
        tag_ids: selectedTagIds,
      });
      toast.success('Project updated');
      loadData();
      setManageModal(false);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to update project');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTag = (tagId: number) => {
    setSelectedTagIds(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const getSessionOptions = () => {
    const options = [{ value: '', label: 'No Session (Unassigned)' }];
    sessions.forEach(s => options.push({ value: s.id.toString(), label: s.name }));
    return options;
  };

  const getAvailableStudentsForTeam = () => {
    if (!selectedProject) return students;
    const teamMemberIds = teamMembers.map(m => m.id);
    return students.filter(s => 
      s.id !== selectedProject.student_id && !teamMemberIds.includes(s.id)
    );
  };

  const getSessionName = (sessionId: number | undefined) => {
    if (!sessionId) return 'Unassigned';
    const session = sessions.find(s => s.id === sessionId);
    return session?.name || 'Unknown';
  };

  const renderProjectTable = (projectList: ProjectWithStudent[]) => (
    <table className="w-full">
      <thead className="bg-slate-50 border-b border-slate-200">
        <tr>
          <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
            Project
          </th>
          <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
            Student / Team
          </th>
          <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
            Mentor
          </th>
          <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
            Session
          </th>
          <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
            Files
          </th>
          <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
            Status
          </th>
          <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
            Actions
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {projectList.map((project) => (
          <tr key={project.id} className="hover:bg-slate-50">
            <td className="px-4 py-4">
              <div>
                <p className="font-medium text-slate-900">{project.title}</p>
                {project.poster_number && (
                  <p className="text-sm text-primary-600">
                    Poster #{project.poster_number}
                  </p>
                )}
              </div>
            </td>
            <td className="px-4 py-4">
              <div>
                <p className="text-sm font-medium text-slate-900">{project.student.full_name}</p>
                <p className="text-xs text-slate-500">{project.student.email}</p>
                {project.team_members && project.team_members.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Users className="w-3 h-3 text-slate-400 mt-0.5" />
                    {project.team_members.map((member) => (
                      <span key={member.id} className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                        {member.full_name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </td>
            <td className="px-4 py-4">
              {project.mentor_email ? (
                <p className="text-sm text-slate-700">{project.mentor_email}</p>
              ) : (
                <span className="text-xs text-slate-400">No mentor</span>
              )}
            </td>
            <td className="px-4 py-4 whitespace-nowrap">
              <p className="text-sm text-slate-700">{getSessionName(project.session_id)}</p>
            </td>
            <td className="px-4 py-4 whitespace-nowrap">
              <div className="flex gap-1">
                {project.paper_path && (
                  <div className="p-1.5 bg-green-100 rounded" title="Paper">
                    <FileText className="w-3.5 h-3.5 text-green-600" />
                  </div>
                )}
                {project.slides_path && (
                  <div className="p-1.5 bg-blue-100 rounded" title="Slides">
                    <Presentation className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                )}
                {project.additional_docs_path && (
                  <div className="p-1.5 bg-purple-100 rounded" title="Docs">
                    <File className="w-3.5 h-3.5 text-purple-600" />
                  </div>
                )}
              </div>
            </td>
            <td className="px-4 py-4 whitespace-nowrap">
              <Badge status={project.status}>{project.status}</Badge>
            </td>
            <td className="px-4 py-4 whitespace-nowrap text-right">
              <div className="flex items-center justify-end gap-1">
                <Link href={`/projects/${project.id}`}>
                  <Button variant="ghost" size="sm" title="View">
                    <Eye className="w-4 h-4" />
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openManageModal(project)}
                  title="Manage"
                >
                  <Edit className="w-4 h-4 text-primary-600" />
                </Button>
                {project.status === 'pending' && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedProject(project);
                        setApproveModal(true);
                      }}
                      title="Approve"
                    >
                      <Check className="w-4 h-4 text-green-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleReject(project.id)}
                      title="Reject"
                    >
                      <X className="w-4 h-4 text-red-500" />
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(project.id, project.title)}
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  if (loading) {
    return (
      <DashboardLayout allowedRoles={['admin']}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout allowedRoles={['admin']}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Project Management</h1>
          <p className="text-slate-600 mt-1">Review and manage submitted projects</p>
        </div>
        <div className="mt-4 sm:mt-0 w-48">
          <Select
            options={statusOptions}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Sort projects: pending first, then approved, then rejected */}
      {(() => {
        const sortedProjects = [...projects].sort((a, b) => {
          const statusOrder = { pending: 0, approved: 1, rejected: 2 };
          return (statusOrder[a.status as keyof typeof statusOrder] ?? 3) - 
                 (statusOrder[b.status as keyof typeof statusOrder] ?? 3);
        });
        const pendingProjects = sortedProjects.filter(p => p.status === 'pending');
        const otherProjects = sortedProjects.filter(p => p.status !== 'pending');

        return projects.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<FolderKanban className="w-12 h-12" />}
              title="No Projects Found"
              description="No projects match the current filter."
            />
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Pending Projects Section */}
          {pendingProjects.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-amber-700 mb-3 flex items-center gap-2">
                <span className="w-3 h-3 bg-amber-500 rounded-full"></span>
                Pending Approval ({pendingProjects.length})
              </h2>
              <Card className="border-amber-200">
                <CardBody className="p-0">
                  <div className="overflow-x-auto">
                    {renderProjectTable(pendingProjects)}
                  </div>
                </CardBody>
              </Card>
            </div>
          )}

          {/* Other Projects Section */}
          {otherProjects.length > 0 && (
            <div>
              {pendingProjects.length > 0 && (
                <h2 className="text-lg font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <span className="w-3 h-3 bg-slate-400 rounded-full"></span>
                  Reviewed Projects ({otherProjects.length})
                </h2>
              )}
              <Card>
                <CardBody className="p-0">
                  <div className="overflow-x-auto">
                    {renderProjectTable(otherProjects)}
                  </div>
                </CardBody>
              </Card>
            </div>
          )}
        </div>
      );
      })()}

      {/* Approve Modal */}
      <Modal
        isOpen={approveModal}
        onClose={() => {
          setApproveModal(false);
          setSelectedProject(null);
          setPosterNumber('');
        }}
        title="Approve Project"
      >
        <form onSubmit={handleApprove} className="space-y-4">
          <p className="text-slate-600">
            Approving: <strong>{selectedProject?.title}</strong>
          </p>
          <Input
            label="Poster Number (Optional)"
            placeholder="e.g., A-12"
            value={posterNumber}
            onChange={(e) => setPosterNumber(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setApproveModal(false);
                setSelectedProject(null);
                setPosterNumber('');
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="success" isLoading={submitting}>
              <Check className="w-4 h-4 mr-2" />
              Approve
            </Button>
          </div>
        </form>
      </Modal>

      {/* Manage Project Modal */}
      <Modal
        isOpen={manageModal}
        onClose={() => {
          setManageModal(false);
          setSelectedProject(null);
        }}
        title="Manage Project"
      >
        {selectedProject && (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto">
            <div className="pb-4 border-b">
              <Badge status={selectedProject.status} className="mb-2">{selectedProject.status}</Badge>
              <p className="text-sm text-slate-500">
                Current Student: {selectedProject.student.full_name}
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
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                required
              />
              
              <Textarea
                label="Description"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={3}
              />
              
              <Input
                label="Mentor Email"
                type="email"
                value={editForm.mentor_email}
                onChange={(e) => setEditForm({ ...editForm, mentor_email: e.target.value })}
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
                      onClick={() => toggleTag(tag.id)}
                      className={`px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                        selectedTagIds.includes(tag.id)
                          ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-500'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {tag.name}
                      {selectedTagIds.includes(tag.id) && (
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
                onClick={handleUpdateProject}
                isLoading={submitting}
                disabled={!editForm.title.trim()}
                className="w-full"
              >
                Save Changes
              </Button>
            </div>

            <hr />

            {/* Reassign Session */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-slate-500" />
                <h4 className="font-medium text-slate-700">Reassign Session</h4>
              </div>
              <Select
                options={getSessionOptions()}
                value={selectedSessionId}
                onChange={(e) => setSelectedSessionId(e.target.value)}
              />
              <Button
                size="sm"
                onClick={handleReassignSession}
                isLoading={submitting}
                disabled={selectedSessionId === (selectedProject.session_id?.toString() || '')}
              >
                Update Session
              </Button>
            </div>

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
              {teamMembers.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500 font-medium">Team Members</p>
                  {teamMembers.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{member.full_name}</p>
                        <p className="text-xs text-slate-500">{member.email}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveTeamMember(member.id)}
                      >
                        <X className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Add Team Member */}
              {getAvailableStudentsForTeam().length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 font-medium mb-2">Add Team Member</p>
                  <div className="max-h-32 overflow-y-auto space-y-1 border border-slate-200 rounded-lg p-2">
                    {getAvailableStudentsForTeam().map((student) => (
                      <button
                        key={student.id}
                        onClick={() => handleAddTeamMember(student.id)}
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

            <div className="flex justify-between pt-4 border-t">
              <Button
                variant="danger"
                onClick={() => {
                  handleDelete(selectedProject.id, selectedProject.title);
                  setManageModal(false);
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Project
              </Button>
              <Button variant="secondary" onClick={() => setManageModal(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}
