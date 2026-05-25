'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import { projectsApi, sessionsApi, conferencesApi } from '@/lib/api';
import { Session, Tag } from '@/types';
import toast from 'react-hot-toast';
import {
  Users,
  FileText,
  Wand2,
  Trash2,
  Plus,
  X,
  RefreshCw,
  Filter,
  Check,
  AlertCircle,
  Download,
} from 'lucide-react';

interface ReviewerForAssignment {
  id: number;
  full_name: string;
  email: string;
  role: string;
  affiliation?: string;
  tags: Tag[];
  assigned_projects_count: number;
}

interface TeamMember {
  id: number;
  full_name: string;
  email: string;
}

interface ProjectForAssignment {
  id: number;
  title: string;
  poster_number: string | null;
  session_id: number | null;
  session_name: string | null;
  student_name: string;
  student_email: string;
  team_members: TeamMember[];
  advisor_email: string | null;
  supervisor1_email: string | null;
  supervisor2_email: string | null;
  tags: Tag[];
  assigned_reviewers: {
    id: number;
    full_name: string;
    email: string;
    tag_ids: number[];
    touched_session_ids: number[];
  }[];
  reviews_count: number;
}

// Track pending assignment changes
interface PendingAssignment {
  projectId: number;
  reviewerId: number;
  reviewerName: string;
  action: 'assign' | 'unassign';
}

export default function AdminAssignmentsPage() {
  const [projects, setProjects] = useState<ProjectForAssignment[]>([]);
  const [reviewers, setReviewers] = useState<ReviewerForAssignment[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [reviewersPerProject, setReviewersPerProject] = useState(2);
  const [maxPerSession, setMaxPerSession] = useState(3);
  const [maxTotal, setMaxTotal] = useState(9);
  const [requireUntouchedSession, setRequireUntouchedSession] = useState(true);
  // Auto-assign scope filters (in addition to the global session selector).
  const [conferences, setConferences] = useState<Array<{ id: number; name: string }>>([]);
  const [autoAssignConferenceId, setAutoAssignConferenceId] = useState<string>('');
  const [autoAssignSessionIds, setAutoAssignSessionIds] = useState<number[]>([]);
  const [autoAssignReviewerIds, setAutoAssignReviewerIds] = useState<number[]>([]);
  const [unassignableProjects, setUnassignableProjects] = useState<Array<{ project_id: number; title: string; reason: string }>>([]);
  
  // Pending assignment changes (batch mode)
  const [pendingChanges, setPendingChanges] = useState<PendingAssignment[]>([]);
  const [applyingChanges, setApplyingChanges] = useState(false);
  
  // Modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectForAssignment | null>(null);
  const [autoAssignModalOpen, setAutoAssignModalOpen] = useState(false);
  const [clearModalOpen, setClearModalOpen] = useState(false);

  useEffect(() => {
    loadSessions();
    loadConferences();
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedSession]);

  const loadSessions = async () => {
    try {
      const res = await sessionsApi.list();
      setSessions(res.data);
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };

  const loadConferences = async () => {
    try {
      const res = await conferencesApi.list();
      setConferences((res.data || []).map((c: { id: number; name: string }) => ({ id: c.id, name: c.name })));
    } catch (error) {
      console.error('Error loading conferences:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const sessionIdNum = selectedSession ? parseInt(selectedSession) : undefined;
      const [projectsRes, reviewersRes] = await Promise.all([
        projectsApi.getAllProjectsForAssignment(sessionIdNum),
        projectsApi.getAllReviewersForAssignment(sessionIdNum),
      ]);
      setProjects(projectsRes.data);
      setReviewers(reviewersRes.data);
      // Clear pending changes when data is refreshed
      setPendingChanges([]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load assignment data');
    } finally {
      setLoading(false);
    }
  };

  // Stage an assignment (add to pending changes)
  const handleStageAssignment = (projectId: number, reviewer: { id: number; full_name: string }) => {
    // Remove any existing pending change for this project-reviewer pair
    setPendingChanges(prev => {
      const filtered = prev.filter(
        p => !(p.projectId === projectId && p.reviewerId === reviewer.id)
      );
      return [...filtered, {
        projectId,
        reviewerId: reviewer.id,
        reviewerName: reviewer.full_name,
        action: 'assign',
      }];
    });
    
    // Update local projects state to show the staged assignment
    setProjects(prev => prev.map(p => {
      if (p.id === projectId) {
        const isAlreadyAssigned = p.assigned_reviewers.some(r => r.id === reviewer.id);
        if (!isAlreadyAssigned) {
          return {
            ...p,
            assigned_reviewers: [...p.assigned_reviewers, { id: reviewer.id, full_name: reviewer.full_name, email: '', tag_ids: [], touched_session_ids: [] }],
          };
        }
      }
      return p;
    }));
    
    // Also update selectedProject if it's the current one
    if (selectedProject?.id === projectId) {
      setSelectedProject(prev => {
        if (!prev) return prev;
        const isAlreadyAssigned = prev.assigned_reviewers.some(r => r.id === reviewer.id);
        if (!isAlreadyAssigned) {
          return {
            ...prev,
            assigned_reviewers: [...prev.assigned_reviewers, { id: reviewer.id, full_name: reviewer.full_name, email: '', tag_ids: [], touched_session_ids: [] }],
          };
        }
        return prev;
      });
    }
  };

  // Stage an unassignment (add to pending changes)
  const handleStageUnassignment = (projectId: number, reviewer: { id: number; full_name: string }) => {
    // Check if this was a pending new assignment - if so, just remove it
    const wasPending = pendingChanges.find(
      p => p.projectId === projectId && p.reviewerId === reviewer.id && p.action === 'assign'
    );
    
    if (wasPending) {
      // Just remove the pending assignment
      setPendingChanges(prev => prev.filter(
        p => !(p.projectId === projectId && p.reviewerId === reviewer.id)
      ));
    } else {
      // Add unassignment to pending changes
      setPendingChanges(prev => {
        const filtered = prev.filter(
          p => !(p.projectId === projectId && p.reviewerId === reviewer.id)
        );
        return [...filtered, {
          projectId,
          reviewerId: reviewer.id,
          reviewerName: reviewer.full_name,
          action: 'unassign',
        }];
      });
    }
    
    // Update local projects state to hide the staged unassignment
    setProjects(prev => prev.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          assigned_reviewers: p.assigned_reviewers.filter(r => r.id !== reviewer.id),
        };
      }
      return p;
    }));
  };

  // Apply all pending changes
  const handleApplyChanges = async () => {
    if (pendingChanges.length === 0) {
      toast.error('No pending changes to apply');
      return;
    }
    
    setApplyingChanges(true);
    let successCount = 0;
    let errorCount = 0;
    
    try {
      for (const change of pendingChanges) {
        try {
          if (change.action === 'assign') {
            await projectsApi.assignReviewer(change.projectId, change.reviewerId);
          } else {
            await projectsApi.unassignReviewer(change.projectId, change.reviewerId);
          }
          successCount++;
        } catch (error: any) {
          console.error(`Failed to ${change.action} reviewer ${change.reviewerId} for project ${change.projectId}:`, error);
          errorCount++;
        }
      }
      
      if (errorCount === 0) {
        toast.success(`Successfully applied ${successCount} assignment change${successCount > 1 ? 's' : ''}`);
      } else {
        toast.error(`Applied ${successCount} changes, ${errorCount} failed`);
      }
      
      setPendingChanges([]);
      loadData();
    } catch (error) {
      toast.error('Failed to apply changes');
    } finally {
      setApplyingChanges(false);
    }
  };

  // Discard all pending changes
  const handleDiscardChanges = () => {
    setPendingChanges([]);
    loadData();
  };

  // Check if a reviewer is pending assignment/unassignment for a project
  const getPendingStatus = (projectId: number, reviewerId: number) => {
    return pendingChanges.find(
      p => p.projectId === projectId && p.reviewerId === reviewerId
    );
  };

  // For each reviewer, derive the set of session ids they currently touch.
  // Prefer the server-provided per-reviewer list (independent of any session
  // filter on this page); fall back to deriving from the current rows.
  const reviewerTouchedSessions = useMemo(() => {
    const map = new Map<number, Set<number>>();
    for (const p of projects) {
      for (const r of p.assigned_reviewers) {
        let set = map.get(r.id);
        if (!set) {
          set = new Set<number>();
          map.set(r.id, set);
        }
        if (r.touched_session_ids && r.touched_session_ids.length > 0) {
          for (const sid of r.touched_session_ids) set.add(sid);
        } else if (p.session_id != null) {
          set.add(p.session_id);
        }
      }
    }
    return map;
  }, [projects]);
  const totalSessions = sessions.length;

  const exportCsv = () => {
    if (projects.length === 0) return;
    // Hebrew column layout. We write the file in REVERSED column order so that
    // when Excel opens it left-to-right, the user sees the columns laid out
    // right-to-left as in the SCE evaluation sheet:
    //   מספר פרויקט | מושב- מסך | מושב | מסך | מנחה 1 | מנחה 2 | מלווה 1 |
    //   מלווה 2 | שם פרויקט | סטודנט 1 | סטודנט 2 | סטודנט 3 | שופט 1 | שופט 2
    const headers = [
      'מספר פרויקט',
      'מושב- מסך',
      'מושב',
      'מסך',
      'מנחה 1',
      'מנחה 2',
      'מלווה 1',
      'מלווה 2',
      'שם פרויקט',
      'סטודנט 1',
      'סטודנט 2',
      'סטודנט 3',
      'שופט 1',
      'שופט 2',
    ];
    const escape = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    // Build an email -> full_name lookup so advisor/supervisor columns show
    // names rather than raw emails. Supervisors and advisors are almost always
    // in the reviewers list (internal staff), so this resolves most cases.
    const nameByEmail = new Map<string, string>();
    for (const r of reviewers) {
      if (r.email) nameByEmail.set(r.email.toLowerCase(), r.full_name);
    }
    const resolveName = (email: string | null | undefined): string => {
      if (!email) return '';
      return nameByEmail.get(email.toLowerCase()) ?? email;
    };
    // Split poster_number "A-1" into מושב ("A") and מסך ("1").
    const splitPoster = (poster: string | null): [string, string] => {
      if (!poster) return ['', ''];
      const idx = poster.indexOf('-');
      if (idx === -1) return [poster, ''];
      return [poster.slice(0, idx), poster.slice(idx + 1)];
    };
    const rows = projects.map((p, idx) => {
      const [mosav, masach] = splitPoster(p.poster_number);
      const students = [p.student_name, ...p.team_members.map((tm) => tm.full_name)];
      const reviewerNames = p.assigned_reviewers.map((r) => r.full_name);
      return [
        idx + 1,                                     // מספר פרויקט (sequential)
        p.poster_number ?? '',                        // מושב- מסך
        mosav,                                        // מושב
        masach,                                       // מסך
        resolveName(p.supervisor1_email),             // מנחה 1
        resolveName(p.supervisor2_email),             // מנחה 2
        resolveName(p.advisor_email),                 // מלווה 1
        '',                                           // מלווה 2 (only one advisor in model)
        p.title,                                      // שם פרויקט
        students[0] ?? '',                            // סטודנט 1
        students[1] ?? '',                            // סטודנט 2
        students[2] ?? '',                            // סטודנט 3
        reviewerNames[0] ?? '',                       // שופט 1
        reviewerNames[1] ?? '',                       // שופט 2
      ];
    });
    // Reverse each row + the header so the physical CSV column order is RTL.
    const reversedHeaders = [...headers].reverse();
    const reversedRows = rows.map((row) => [...row].reverse());
    const csv = [reversedHeaders, ...reversedRows].map((row) => row.map(escape).join(',')).join('\n');
    // Prepend UTF-8 BOM so Excel renders Hebrew correctly
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const sessionPart = selectedSession
      ? `-${sessions.find((s) => s.id.toString() === selectedSession)?.name ?? 'session'}`
      : '';
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `assignments${sessionPart}-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${projects.length} projects`);
  };

  const handleAutoAssign = async () => {
    try {
      // Effective session scope: the multi-select takes precedence; if empty,
      // fall back to the single global session selector for backwards compat.
      const effectiveSessionIds = autoAssignSessionIds.length > 0
        ? autoAssignSessionIds
        : (selectedSession ? [parseInt(selectedSession)] : undefined);
      // Use preview mode to get proposed assignments without applying
      const res = await projectsApi.autoAssignReviewers(
        undefined, // session_id (legacy single) — folded into sessionIds below
        reviewersPerProject,
        true, // preview mode
        maxPerSession,
        maxTotal,
        requireUntouchedSession,
        effectiveSessionIds,
        autoAssignReviewerIds.length > 0 ? autoAssignReviewerIds : undefined,
      );
      
      const proposedAssignments = res.data.proposed_assignments || [];
      const unassignable = res.data.unassignable_projects || [];
      setUnassignableProjects(unassignable);
      
      if (proposedAssignments.length === 0) {
        toast.error('No assignments could be made. All projects may already have enough reviewers, or constraints could not be satisfied.');
        setAutoAssignModalOpen(false);
        return;
      }
      
      // Stage all proposed assignments
      for (const assignment of proposedAssignments) {
        // Add to pending changes
        setPendingChanges(prev => {
          const filtered = prev.filter(
            p => !(p.projectId === assignment.project_id && p.reviewerId === assignment.reviewer_id)
          );
          return [...filtered, {
            projectId: assignment.project_id,
            reviewerId: assignment.reviewer_id,
            reviewerName: assignment.reviewer_name,
            action: 'assign' as const,
          }];
        });
        
        // Update local projects state
        setProjects(prev => prev.map(p => {
          if (p.id === assignment.project_id) {
            const isAlreadyAssigned = p.assigned_reviewers.some(r => r.id === assignment.reviewer_id);
            if (!isAlreadyAssigned) {
              return {
                ...p,
                assigned_reviewers: [...p.assigned_reviewers, { 
                  id: assignment.reviewer_id, 
                  full_name: assignment.reviewer_name, 
                  email: '',
                  tag_ids: [],
                  touched_session_ids: [],
                }],
              };
            }
          }
          return p;
        }));
      }
      
      toast.success(`Staged ${proposedAssignments.length} assignments. Click "Apply Changes" to confirm.`);
      if (unassignable.length > 0) {
        toast(`${unassignable.length} project(s) could not be assigned. See list below.`, { icon: '⚠️' });
      }
      setAutoAssignModalOpen(false);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Auto-assign failed');
    }
  };

  const handleClearAssignments = async () => {
    try {
      const res = await projectsApi.clearAllAssignments(
        selectedSession ? parseInt(selectedSession) : undefined
      );
      toast.success(res.data.message);
      setClearModalOpen(false);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to clear assignments');
    }
  };

  const openAssignModal = (project: ProjectForAssignment) => {
    setSelectedProject(project);
    setAssignModalOpen(true);
  };

  // Get reviewers not already assigned to the selected project
  // Also filter out reviewers who have reached the 4-project limit for the session
  const getAvailableReviewers = () => {
    if (!selectedProject) return reviewers;
    const assignedIds = new Set(selectedProject.assigned_reviewers.map(r => r.id));
    return reviewers.filter(r => {
      // Skip if already assigned to this project
      if (assignedIds.has(r.id)) return false;
      // Skip if at 4-project limit for this session (when session filter is applied)
      if (selectedSession && r.assigned_projects_count >= 4) return false;
      return true;
    });
  };

  // Check if reviewer is at limit
  const isAtLimit = (reviewer: ReviewerForAssignment) => {
    return selectedSession && reviewer.assigned_projects_count >= 4;
  };

  // Calculate tag match for a reviewer against a project
  const getTagMatchCount = (reviewer: ReviewerForAssignment, project: ProjectForAssignment) => {
    const projectTagIds = new Set(project.tags.map(t => t.id));
    return reviewer.tags.filter(t => projectTagIds.has(t.id)).length;
  };

  const sessionOptions = [
    { value: '', label: 'All Sessions' },
    ...sessions.map(s => ({ value: s.id.toString(), label: s.name })),
  ];

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reviewer Assignments</h1>
          <p className="text-slate-500 mt-1">Assign reviewers to projects manually or automatically</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportCsv} disabled={projects.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="secondary" onClick={() => setClearModalOpen(true)}>
            <Trash2 className="w-4 h-4 mr-2" />
            Clear All
          </Button>
          <Button variant="primary" onClick={() => setAutoAssignModalOpen(true)}>
            <Wand2 className="w-4 h-4 mr-2" />
            Auto Assign
          </Button>
        </div>
      </div>

      {/* Pending Changes Banner */}
      {pendingChanges.length > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800">
                You have {pendingChanges.length} pending assignment change{pendingChanges.length > 1 ? 's' : ''}
              </p>
              <p className="text-sm text-amber-600">
                {pendingChanges.filter(c => c.action === 'assign').length} assignments, {' '}
                {pendingChanges.filter(c => c.action === 'unassign').length} removals
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDiscardChanges}
              disabled={applyingChanges}
            >
              <X className="w-4 h-4 mr-1" />
              Discard
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleApplyChanges}
              isLoading={applyingChanges}
            >
              <Check className="w-4 h-4 mr-1" />
              Apply Changes
            </Button>
          </div>
        </div>
      )}

      {/* Unassignable Projects Banner */}
      {unassignableProjects.length > 0 && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-lg">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5" />
              <div>
                <p className="font-medium text-rose-800">
                  {unassignableProjects.length} project{unassignableProjects.length > 1 ? 's' : ''} could not be auto-assigned
                </p>
                <p className="text-sm text-rose-600">
                  Review the reasons below and assign manually or adjust project supervisors.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="text-rose-700 hover:text-rose-900 text-sm"
              onClick={() => setUnassignableProjects([])}
            >
              Dismiss
            </button>
          </div>
          <ul className="text-sm text-rose-800 list-disc pl-8 space-y-1">
            {unassignableProjects.map((u) => (
              <li key={u.project_id}>
                <span className="font-medium">{u.title}</span> — {u.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Filters */}
      <Card className="mb-6">
        <CardBody>
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">Filter by Session:</span>
            </div>
            <Select
              options={sessionOptions}
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="w-64"
            />
            <Button variant="ghost" size="sm" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
            <div className="ml-auto text-sm text-slate-500">
              {projects.length} projects, {reviewers.length} reviewers
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Projects Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : projects.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No approved projects</h3>
            <p className="text-slate-500">Approve some projects first to assign reviewers.</p>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Project
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Session
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Students
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Advisor / Supervisors
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Assigned Reviewers
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Reviews
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {projects.map((project) => (
                    <tr key={project.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-slate-900 line-clamp-2">{project.title}</p>
                          {project.poster_number && (
                            <p className="text-xs text-slate-500 mt-0.5">Poster: {project.poster_number}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-600">
                          {project.session_name || 'No session'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <ul className="text-sm text-slate-700 space-y-0.5">
                          <li>
                            <span className="font-medium">{project.student_name}</span>
                            <span className="text-xs text-slate-400 ml-1">(owner)</span>
                          </li>
                          {project.team_members.map((tm) => (
                            <li key={tm.id} className="text-slate-600">{tm.full_name}</li>
                          ))}
                        </ul>
                      </td>
                      <td className="px-6 py-4">
                        <ul className="text-xs text-slate-600 space-y-0.5">
                          {project.advisor_email && (
                            <li>
                              <span className="text-slate-400">Advisor:</span> {project.advisor_email}
                            </li>
                          )}
                          {project.supervisor1_email && (
                            <li>
                              <span className="text-slate-400">Sup. 1:</span> {project.supervisor1_email}
                            </li>
                          )}
                          {project.supervisor2_email && (
                            <li>
                              <span className="text-slate-400">Sup. 2:</span> {project.supervisor2_email}
                            </li>
                          )}
                          {!project.advisor_email && !project.supervisor1_email && !project.supervisor2_email && (
                            <li className="text-slate-400">—</li>
                          )}
                        </ul>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {project.assigned_reviewers.length > 0 ? (
                            project.assigned_reviewers.map((reviewer) => {
                              const pendingStatus = getPendingStatus(project.id, reviewer.id);
                              const isPendingAssign = pendingStatus?.action === 'assign';
                              const projectTagIds = project.tags.map((t) => t.id);
                              const reviewerTagSet = new Set(reviewer.tag_ids ?? []);
                              const matchedCount = projectTagIds.filter((id) => reviewerTagSet.has(id)).length;
                              const fullMatch =
                                projectTagIds.length > 0 && matchedCount === projectTagIds.length;
                              const partialMatch = !fullMatch && matchedCount > 0;
                              const touched = reviewerTouchedSessions.get(reviewer.id);
                              const violatesUntouched =
                                totalSessions > 0 &&
                                touched !== undefined &&
                                touched.size >= totalSessions;
                              let pillClass: string;
                              if (isPendingAssign) {
                                pillClass = 'bg-amber-50 text-amber-700 border border-amber-300 border-dashed';
                              } else if (violatesUntouched) {
                                pillClass = 'bg-red-100 text-red-800';
                              } else if (fullMatch) {
                                pillClass = 'bg-green-100 text-green-800';
                              } else if (partialMatch) {
                                pillClass = 'bg-blue-50 text-blue-700';
                              } else {
                                pillClass = 'bg-slate-100 text-slate-700';
                              }
                              const tagTitle =
                                projectTagIds.length === 0
                                  ? 'Project has no tags'
                                  : `${matchedCount} / ${projectTagIds.length} project tags matched`;
                              const matchTitle = violatesUntouched
                                ? `Assigned in all ${totalSessions} sessions \u2014 violates untouched-session rule. ${tagTitle}`
                                : tagTitle;
                              return (
                                <div
                                  key={reviewer.id}
                                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${pillClass}`}
                                  title={matchTitle}
                                >
                                  {isPendingAssign && <Plus className="w-3 h-3" />}
                                  {reviewer.full_name}
                                  <button
                                    onClick={() => handleStageUnassignment(project.id, reviewer)}
                                    className="hover:text-red-500"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              );
                            })
                          ) : (
                            <span className="text-sm text-slate-400">None assigned</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-600">
                          {project.reviews_count} / {project.assigned_reviewers.length}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openAssignModal(project)}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Assign
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Assign Reviewer Modal */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => {
          setAssignModalOpen(false);
          setSelectedProject(null);
        }}
        title={`Assign Reviewers to: ${selectedProject?.title || ''}`}
      >
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {selectedProject && (
            <>
              <div className="mb-4">
                <p className="text-sm text-slate-600 mb-2">Project Tags:</p>
                <div className="flex flex-wrap gap-1">
                  {selectedProject.tags.map((tag) => (
                    <Badge key={tag.id} variant="primary" className="text-xs">
                      {tag.name}
                    </Badge>
                  ))}
                  {selectedProject.tags.length === 0 && (
                    <span className="text-sm text-slate-400">No tags</span>
                  )}
                </div>
              </div>
              <hr />
              <p className="text-sm font-medium text-slate-700">Available Reviewers:</p>
              {getAvailableReviewers().length === 0 ? (
                <p className="text-sm text-slate-500">All reviewers are already assigned.</p>
              ) : (
                <div className="space-y-2">
                  {getAvailableReviewers()
                    .sort((a, b) => getTagMatchCount(b, selectedProject) - getTagMatchCount(a, selectedProject))
                    .map((reviewer) => {
                      const matchCount = getTagMatchCount(reviewer, selectedProject);
                      return (
                        <div
                          key={reviewer.id}
                          className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                        >
                          <div>
                            <p className="font-medium text-slate-900">{reviewer.full_name}</p>
                            <p className="text-sm text-slate-500">{reviewer.email}</p>
                            {reviewer.affiliation && (
                              <p className="text-xs text-slate-400">{reviewer.affiliation}</p>
                            )}
                            <div className="flex flex-wrap gap-1 mt-1">
                              {reviewer.tags.map((tag) => {
                                const isMatch = selectedProject.tags.some(t => t.id === tag.id);
                                return (
                                  <Badge
                                    key={tag.id}
                                    variant={isMatch ? 'success' : 'gray'}
                                    className="text-xs"
                                  >
                                    {tag.name}
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {matchCount > 0 && (
                              <span className="text-xs text-green-600 font-medium">
                                {matchCount} tag match{matchCount > 1 ? 'es' : ''}
                              </span>
                            )}
                            <span className={`text-xs ${reviewer.assigned_projects_count >= 4 ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                              {reviewer.assigned_projects_count}/4 projects
                            </span>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleStageAssignment(selectedProject.id, reviewer)}
                            >
                              Assign
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </>
          )}
        </div>
      </Modal>

      {/* Auto Assign Modal */}
      <Modal
        isOpen={autoAssignModalOpen}
        onClose={() => setAutoAssignModalOpen(false)}
        title="Auto-Assign Reviewers"
      >
        <div className="space-y-4">
          <p className="text-slate-600">
            Automatically assign reviewers under these rules: the first reviewer must be one
            of the project's two supervisors; the second reviewer cannot be the other supervisor
            or the project advisor. Tag/interest overlap is used as a tie-breaker.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Reviewers per project
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={reviewersPerProject}
                onChange={(e) => setReviewersPerProject(parseInt(e.target.value) || 2)}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Max per session
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={maxPerSession}
                onChange={(e) => setMaxPerSession(parseInt(e.target.value) || 3)}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Max total
              </label>
              <input
                type="number"
                min="1"
                max="200"
                value={maxTotal}
                onChange={(e) => setMaxTotal(parseInt(e.target.value) || 9)}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
          </div>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={requireUntouchedSession}
              onChange={(e) => setRequireUntouchedSession(e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm text-slate-700">
              <span className="font-medium">Require each reviewer to keep at least one untouched session</span>
              <span className="block text-slate-500">
                When enabled, every reviewer must have at least one session in the system with zero assignments.
                Uncheck this if you have few reviewers and many sessions (e.g. 13 reviewers across 6 sessions),
                otherwise supervisors can become unassignable for projects in their 6th session.
              </span>
            </span>
          </label>

          {/* ─── Scope filters: conference / sessions / reviewers ─── */}
          <div className="border-t pt-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Conference (optional — auto-selects all its sessions)
              </label>
              <select
                value={autoAssignConferenceId}
                onChange={(e) => {
                  const cid = e.target.value;
                  setAutoAssignConferenceId(cid);
                  if (cid === '') {
                    setAutoAssignSessionIds([]);
                  } else {
                    const cidNum = parseInt(cid);
                    setAutoAssignSessionIds(
                      sessions.filter((s) => s.conference_id === cidNum).map((s) => s.id)
                    );
                  }
                }}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">— Any conference —</option>
                {conferences.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-slate-700">
                  Sessions ({autoAssignSessionIds.length} selected)
                </label>
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    className="text-blue-600 hover:underline"
                    onClick={() => setAutoAssignSessionIds(sessions.map((s) => s.id))}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    className="text-slate-500 hover:underline"
                    onClick={() => { setAutoAssignSessionIds([]); setAutoAssignConferenceId(''); }}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="max-h-32 overflow-y-auto border rounded-lg p-2 grid grid-cols-2 gap-1">
                {sessions.length === 0 && (
                  <p className="text-xs text-slate-400 col-span-2">No sessions available.</p>
                )}
                {sessions.map((s) => {
                  const checked = autoAssignSessionIds.includes(s.id);
                  return (
                    <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setAutoAssignSessionIds((prev) =>
                            e.target.checked
                              ? [...prev, s.id]
                              : prev.filter((id) => id !== s.id)
                          );
                          // Clear conference shortcut if the user starts hand-picking.
                          if (!e.target.checked) setAutoAssignConferenceId('');
                        }}
                      />
                      <span className="truncate">{s.name}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Empty = use the page&apos;s session filter (or all sessions if none selected).
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-slate-700">
                  Reviewers ({autoAssignReviewerIds.length} selected)
                </label>
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    className="text-blue-600 hover:underline"
                    onClick={() => setAutoAssignReviewerIds(reviewers.map((r) => r.id))}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    className="text-slate-500 hover:underline"
                    onClick={() => setAutoAssignReviewerIds([])}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="max-h-40 overflow-y-auto border rounded-lg p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                {reviewers.length === 0 && (
                  <p className="text-xs text-slate-400 col-span-2">No reviewers available.</p>
                )}
                {reviewers.map((r) => {
                  const checked = autoAssignReviewerIds.includes(r.id);
                  return (
                    <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setAutoAssignReviewerIds((prev) =>
                            e.target.checked
                              ? [...prev, r.id]
                              : prev.filter((id) => id !== r.id)
                          )
                        }
                      />
                      <span className="truncate">{r.full_name}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Empty = consider every approved reviewer. Note: a project&apos;s supervisor must be in this pool, otherwise the project will be unassignable.
              </p>
            </div>
          </div>

          {autoAssignSessionIds.length === 0 && selectedSession && (
            <p className="text-sm text-blue-600">
              Will only assign to projects in: {sessions.find(s => s.id.toString() === selectedSession)?.name}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setAutoAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleAutoAssign}>
              <Wand2 className="w-4 h-4 mr-2" />
              Auto Assign
            </Button>
          </div>
        </div>
      </Modal>

      {/* Clear Assignments Modal */}
      <Modal
        isOpen={clearModalOpen}
        onClose={() => setClearModalOpen(false)}
        title="Clear All Assignments"
      >
        <div className="space-y-4">
          <p className="text-slate-600">
            Are you sure you want to clear all reviewer assignments?
            {selectedSession && (
              <span className="block mt-2 text-blue-600">
                This will only clear assignments for: {sessions.find(s => s.id.toString() === selectedSession)?.name}
              </span>
            )}
          </p>
          <p className="text-red-600 text-sm">
            This action cannot be undone. Existing reviews will not be affected.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setClearModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleClearAssignments}>
              Clear Assignments
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
