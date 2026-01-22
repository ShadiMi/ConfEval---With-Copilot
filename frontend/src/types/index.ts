// User types
export type UserRole = 'student' | 'internal_reviewer' | 'external_reviewer' | 'admin';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  id_number?: string;
  phone_number?: string;
  affiliation?: string;
  cv_path?: string;
  google_id?: string;
  is_active: boolean;
  is_approved: boolean;
  created_at: string;
  interested_tags?: Tag[];
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  id_number?: string;
  phone_number?: string;
  affiliation?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

// Tag types
export interface Tag {
  id: number;
  name: string;
  description?: string;
}

export interface TagCreate {
  name: string;
  description?: string;
}

// Session types
export type SessionStatus = 'upcoming' | 'active' | 'completed';

export interface Session {
  id: number;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  location?: string;
  status: SessionStatus;
  max_projects: number;
  created_at: string;
}

export interface SessionWithDetails extends Session {
  criteria: Criteria[];
  reviewers: User[];
  tags: Tag[];
  project_count: number;
}

export interface SessionCreate {
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  location?: string;
  max_projects?: number;
}

// Project types
export type ProjectStatus = 'pending' | 'approved' | 'rejected';
export type TeamInvitationStatus = 'pending' | 'accepted' | 'declined';

export interface TeamInvitation {
  id: number;
  email: string;
  status: TeamInvitationStatus;
  created_at: string;
}

export interface PendingInvitation {
  id: number;
  project_id: number;
  project_title: string;
  invited_by: string;
  created_at: string;
}

export interface Project {
  id: number;
  title: string;
  description?: string;
  student_id: number;
  session_id?: number;
  status: ProjectStatus;
  mentor_email?: string;
  paper_path?: string;
  slides_path?: string;
  additional_docs_path?: string;
  poster_number?: string;
  created_at: string;
  tags: Tag[];
  team_members?: User[];
  pending_invitations?: TeamInvitation[];
  avg_score?: number;
  review_count?: number;
}

export interface ProjectWithStudent extends Project {
  student: User;
  assigned_reviewers?: { id: number; full_name: string; email: string }[];
  session?: Session;
}

export interface ProjectCreate {
  title: string;
  description?: string;
  session_id?: number;
  tag_ids?: number[];
  team_member_emails?: string[];
  mentor_email?: string;
}

// Criteria types
export interface Criteria {
  id: number;
  session_id: number;
  name: string;
  description?: string;
  max_score: number;
  weight: number;
  order: number;
}

export interface CriteriaCreate {
  session_id: number;
  name: string;
  description?: string;
  max_score?: number;
  weight?: number;
}

// Review types
export interface CriteriaScore {
  id: number;
  criteria_id: number;
  score: number;
  criteria: Criteria;
}

export interface Review {
  id: number;
  project_id: number;
  reviewer_id: number;
  comments?: string;
  total_score?: number;
  is_completed: boolean;
  created_at: string;
  criteria_scores: CriteriaScore[];
  reviewer: User;
}

export interface CriteriaScoreCreate {
  criteria_id: number;
  score: number;
}

export interface ReviewCreate {
  project_id: number;
  comments?: string;
  criteria_scores: CriteriaScoreCreate[];
}

// Application types
export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface ReviewerApplication {
  id: number;
  reviewer_id: number;
  session_id: number;
  status: ApplicationStatus;
  message?: string;
  created_at: string;
  reviewer: User;
  session: Session;
}

export interface ApplicationCreate {
  session_id: number;
  message?: string;
}

// Stats
export interface Stats {
  total_users: number;
  total_sessions: number;
  total_projects: number;
  total_reviews: number;
}

// Notification types
export type NotificationType = 
  | 'project_approved' 
  | 'project_rejected' 
  | 'review_submitted' 
  | 'application_approved' 
  | 'application_rejected' 
  | 'session_assigned' 
  | 'general';

export interface Notification {
  id: number;
  user_id: number;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}
