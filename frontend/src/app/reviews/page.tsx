'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Textarea from '@/components/ui/Textarea';
import Input from '@/components/ui/Input';
import EmptyState from '@/components/ui/EmptyState';
import { useAuthStore } from '@/lib/store';
import { projectsApi, reviewsApi, criteriaApi } from '@/lib/api';
import { ProjectWithStudent, Review, Criteria, CriteriaScoreCreate } from '@/types';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  FileCheck,
  Star,
  ChevronRight,
  Eye,
  Edit,
} from 'lucide-react';

export default function ReviewsPage() {
  const { user } = useAuthStore();
  const [projects, setProjects] = useState<ProjectWithStudent[]>([]);
  const [myReviews, setMyReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewModal, setReviewModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectWithStudent | null>(null);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [criteria, setCriteria] = useState<Criteria[]>([]);
  const [reviewForm, setReviewForm] = useState({
    comments: '',
    scores: {} as Record<number, number>,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [projectsRes, reviewsRes] = await Promise.all([
        projectsApi.list({ status: 'approved' }),
        reviewsApi.getMyReviews(),
      ]);
      setProjects(projectsRes.data);
      setMyReviews(reviewsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const openReviewModal = async (project: ProjectWithStudent) => {
    setSelectedProject(project);
    
    // Load criteria for the session
    if (project.session_id) {
      try {
        const res = await criteriaApi.listForSession(project.session_id);
        setCriteria(res.data);
        
        // Initialize scores
        const scores: Record<number, number> = {};
        res.data.forEach((c: Criteria) => {
          scores[c.id] = 0;
        });
        setReviewForm({ comments: '', scores });
      } catch (error) {
        toast.error('Failed to load criteria');
        return;
      }
    }
    
    setReviewModal(true);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    
    setSubmitting(true);
    
    try {
      const criteriaScores: CriteriaScoreCreate[] = Object.entries(reviewForm.scores).map(
        ([criteriaId, score]) => ({
          criteria_id: parseInt(criteriaId),
          score,
        })
      );
      
      await reviewsApi.create({
        project_id: selectedProject.id,
        comments: reviewForm.comments,
        criteria_scores: criteriaScores,
      });
      
      toast.success('Review submitted successfully');
      setReviewModal(false);
      setSelectedProject(null);
      setReviewForm({ comments: '', scores: {} });
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = async (review: Review) => {
    setSelectedReview(review);
    
    // Find the project for this review
    const project = projects.find(p => p.id === review.project_id);
    if (project?.session_id) {
      try {
        const res = await criteriaApi.listForSession(project.session_id);
        setCriteria(res.data);
        
        // Initialize scores from existing review
        const scores: Record<number, number> = {};
        review.criteria_scores.forEach((cs) => {
          scores[cs.criteria_id] = cs.score;
        });
        setReviewForm({ comments: review.comments || '', scores });
      } catch (error) {
        toast.error('Failed to load criteria');
        return;
      }
    }
    
    setEditModal(true);
  };

  const handleUpdateReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReview) return;
    
    setSubmitting(true);
    
    try {
      const criteriaScores: CriteriaScoreCreate[] = Object.entries(reviewForm.scores).map(
        ([criteriaId, score]) => ({
          criteria_id: parseInt(criteriaId),
          score,
        })
      );
      
      await reviewsApi.update(selectedReview.id, {
        comments: reviewForm.comments,
        criteria_scores: criteriaScores,
      });
      
      toast.success('Review updated successfully');
      setEditModal(false);
      setSelectedReview(null);
      setReviewForm({ comments: '', scores: {} });
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to update review');
    } finally {
      setSubmitting(false);
    }
  };

  const getProjectTitle = (projectId: number) => {
    const project = projects.find(p => p.id === projectId);
    return project?.title || `Project #${projectId}`;
  };

  const hasReviewed = (projectId: number) => {
    return myReviews.some((r) => r.project_id === projectId);
  };

  // Filter to show only projects user can review
  const reviewableProjects = projects.filter((p) => !hasReviewed(p.id));

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
        <h1 className="text-2xl font-bold text-slate-900">Reviews</h1>
        <p className="text-slate-600 mt-1">Review assigned projects</p>
      </div>

      {/* My Reviews */}
      {myReviews.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">My Reviews</h2>
          <div className="grid gap-4">
            {myReviews.map((review) => (
              <Card key={review.id}>
                <CardBody>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <p className="font-medium text-slate-900">{getProjectTitle(review.project_id)}</p>
                      <p className="text-sm text-slate-500 mt-1">
                        Reviewed on {formatDate(review.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {review.total_score !== null && review.total_score !== undefined && (
                        <div className="flex items-center text-yellow-500">
                          <Star className="w-4 h-4 fill-current mr-1" />
                          <span className="font-medium">{review.total_score.toFixed(1)}</span>
                        </div>
                      )}
                      <Badge variant={review.is_completed ? 'success' : 'warning'}>
                        {review.is_completed ? 'Completed' : 'Draft'}
                      </Badge>
                      <Link href={`/projects/${review.project_id}`}>
                        <Button variant="secondary" size="sm">
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      </Link>
                      <Button variant="primary" size="sm" onClick={() => openEditModal(review)}>
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Projects to Review */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Projects to Review ({reviewableProjects.length})
        </h2>
        
        {reviewableProjects.length === 0 ? (
          <Card>
            <CardBody>
              <EmptyState
                icon={<FileCheck className="w-12 h-12" />}
                title="No Projects to Review"
                description="You've reviewed all available projects."
              />
            </CardBody>
          </Card>
        ) : (
          <div className="grid gap-4">
            {reviewableProjects.map((project) => (
              <Card key={project.id} className="hover:shadow-md transition-shadow">
                <CardBody>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-slate-900">{project.title}</h3>
                      <p className="text-sm text-slate-500 mt-1">
                        By {project.student.full_name}
                      </p>
                      {project.description && (
                        <p className="text-sm text-slate-600 mt-2 line-clamp-2">
                          {project.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {project.tags.map((tag) => (
                          <Badge key={tag.id} variant="gray">
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <Link href={`/projects/${project.id}`}>
                        <Button variant="secondary" size="sm">
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </Button>
                      </Link>
                      <Button size="sm" onClick={() => openReviewModal(project)}>
                        <Star className="w-4 h-4 mr-2" />
                        Review
                      </Button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Review Modal */}
      <Modal
        isOpen={reviewModal}
        onClose={() => {
          setReviewModal(false);
          setSelectedProject(null);
        }}
        title={`Review: ${selectedProject?.title}`}
        size="lg"
      >
        <form onSubmit={handleSubmitReview} className="space-y-6">
          {/* Criteria Scores */}
          {criteria.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-medium text-slate-900">Scoring Criteria (0-100)</h3>
              {criteria.map((c) => (
                <div key={c.id} className="p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium text-slate-900">{c.name}</p>
                      {c.description && (
                        <p className="text-sm text-slate-500">{c.description}</p>
                      )}
                    </div>
                    <span className="text-xs text-slate-400">Weight: {c.weight}x</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <input
                      type="number"
                      min={0}
                      max={c.max_score}
                      value={reviewForm.scores[c.id] || 0}
                      onChange={(e) => {
                        let val = parseInt(e.target.value) || 0;
                        if (val < 0) val = 0;
                        if (val > c.max_score) val = c.max_score;
                        setReviewForm({
                          ...reviewForm,
                          scores: {
                            ...reviewForm.scores,
                            [c.id]: val,
                          },
                        });
                      }}
                      className="w-24 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    <span className="text-sm text-slate-500">/ {c.max_score}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <Textarea
            label="Comments"
            placeholder="Provide feedback for the student..."
            value={reviewForm.comments}
            onChange={(e) => setReviewForm({ ...reviewForm, comments: e.target.value })}
            rows={4}
          />
          
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setReviewModal(false);
                setSelectedProject(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={submitting}>
              <Star className="w-4 h-4 mr-2" />
              Submit Review
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Review Modal */}
      <Modal
        isOpen={editModal && selectedReview !== null}
        onClose={() => {
          setEditModal(false);
          setSelectedReview(null);
        }}
        title={`Edit Review: ${getProjectTitle(selectedReview?.project_id || 0)}`}
        size="lg"
      >
        <form onSubmit={handleUpdateReview} className="space-y-6">
          {/* Criteria Scores */}
          {criteria.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-medium text-slate-900">Scoring Criteria (0-100)</h3>
              {criteria.map((c) => (
                <div key={c.id} className="p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium text-slate-900">{c.name}</p>
                      {c.description && (
                        <p className="text-sm text-slate-500">{c.description}</p>
                      )}
                    </div>
                    <span className="text-xs text-slate-400">Weight: {c.weight}x</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <input
                      type="number"
                      min={0}
                      max={c.max_score}
                      value={reviewForm.scores[c.id] || 0}
                      onChange={(e) => {
                        let val = parseInt(e.target.value) || 0;
                        if (val < 0) val = 0;
                        if (val > c.max_score) val = c.max_score;
                        setReviewForm({
                          ...reviewForm,
                          scores: {
                            ...reviewForm.scores,
                            [c.id]: val,
                          },
                        });
                      }}
                      className="w-24 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    <span className="text-sm text-slate-500">/ {c.max_score}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <Textarea
            label="Comments"
            placeholder="Provide feedback for the student..."
            value={reviewForm.comments}
            onChange={(e) => setReviewForm({ ...reviewForm, comments: e.target.value })}
            rows={4}
          />
          
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setEditModal(false);
                setSelectedReview(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={submitting}>
              <Star className="w-4 h-4 mr-2" />
              Update Review
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
