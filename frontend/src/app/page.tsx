'use client';

import Logo from '@/components/Logo';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { sessionsApi, statsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { formatDate } from '@/lib/utils';
import { Session } from '@/types';
import {
    ArrowRight,
    Award,
    BookOpen,
    Calendar,
    CheckCircle2,
    ChevronRight,
    ClipboardCheck,
    Clock,
    FileText,
    GraduationCap,
    LogIn,
    MapPin,
    MessageSquare,
    Shield,
    Star,
    Target,
    TrendingUp,
    Upload,
    UserPlus,
    Users,
    Zap
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function HomePage() {
  const { isAuthenticated, user } = useAuthStore();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [sessionsRes, statsRes] = await Promise.all([
        sessionsApi.listPublic(),
        statsApi.get().catch(() => ({ data: null })),
      ]);
      setSessions(sessionsRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const activeSessions = sessions.filter(s => s.status === 'active');
  const upcomingSessions = sessions.filter(s => s.status === 'upcoming');

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-3">
              <Logo size={40} />
              <div>
                <span className="text-xl font-bold text-slate-900">ConfEval</span>
                <span className="hidden sm:inline text-xs text-slate-500 ml-2">Conference Review System</span>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {isAuthenticated ? (
                <Link href="/dashboard">
                  <Button>
                    Dashboard
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href="/login">
                    <Button variant="ghost" size="sm">
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button size="sm">
                      Get Started
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-white">
        {/* Background Pattern */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-100 rounded-full blur-3xl opacity-50"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent-100 rounded-full blur-3xl opacity-50"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div>
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary-50 border border-primary-100 text-primary-700 text-sm font-medium mb-6">
                <Zap className="w-4 h-4 mr-2" />
                Streamlined Academic Review Process
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 mb-6 leading-tight">
                Conference & Poster
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-accent-600"> Review System</span>
              </h1>
              <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                A comprehensive platform for managing academic conference submissions. 
                Submit research, receive expert reviews, and track your projects through 
                a streamlined evaluation process.
              </p>
              
              {!isAuthenticated && (
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link href="/register">
                    <Button size="lg" className="w-full sm:w-auto shadow-lg shadow-primary-600/20">
                      <GraduationCap className="w-5 h-5 mr-2" />
                      Submit Your Research
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                      <Award className="w-5 h-5 mr-2" />
                      Join as Reviewer
                    </Button>
                  </Link>
                </div>
              )}
              
              {isAuthenticated && (
                <Link href="/dashboard">
                  <Button size="lg" className="shadow-lg shadow-primary-600/20">
                    Go to Dashboard
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              )}
            </div>
            
            {/* Right Content - Feature Cards */}
            <div className="hidden lg:grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <Card className="border-2 border-primary-100 bg-gradient-to-br from-primary-50 to-white">
                  <CardBody className="p-5">
                    <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center mb-3">
                      <Upload className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-semibold text-slate-900 mb-1">Easy Submission</h3>
                    <p className="text-sm text-slate-600">Upload papers, slides, and posters with a simple interface</p>
                  </CardBody>
                </Card>
                <Card className="border-2 border-accent-100 bg-gradient-to-br from-accent-50 to-white">
                  <CardBody className="p-5">
                    <div className="w-10 h-10 bg-accent-600 rounded-lg flex items-center justify-center mb-3">
                      <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-semibold text-slate-900 mb-1">Expert Feedback</h3>
                    <p className="text-sm text-slate-600">Get detailed reviews from qualified reviewers</p>
                  </CardBody>
                </Card>
              </div>
              <div className="space-y-4 pt-8">
                <Card className="border-2 border-green-100 bg-gradient-to-br from-green-50 to-white">
                  <CardBody className="p-5">
                    <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center mb-3">
                      <Target className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-semibold text-slate-900 mb-1">Criteria-Based</h3>
                    <p className="text-sm text-slate-600">Structured evaluation with custom rubrics</p>
                  </CardBody>
                </Card>
                <Card className="border-2 border-amber-100 bg-gradient-to-br from-amber-50 to-white">
                  <CardBody className="p-5">
                    <div className="w-10 h-10 bg-amber-600 rounded-lg flex items-center justify-center mb-3">
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="font-semibold text-slate-900 mb-1">Track Progress</h3>
                    <p className="text-sm text-slate-600">Monitor submission status in real-time</p>
                  </CardBody>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      {stats && (
        <section className="py-12 bg-slate-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="text-center">
                <p className="text-4xl font-bold text-white mb-1">{stats.total_sessions || 0}</p>
                <p className="text-slate-400 text-sm">Total Sessions</p>
              </div>
              <div className="text-center">
                <p className="text-4xl font-bold text-white mb-1">{stats.total_projects || 0}</p>
                <p className="text-slate-400 text-sm">Projects Submitted</p>
              </div>
              <div className="text-center">
                <p className="text-4xl font-bold text-white mb-1">{stats.total_reviews || 0}</p>
                <p className="text-slate-400 text-sm">Reviews Completed</p>
              </div>
              <div className="text-center">
                <p className="text-4xl font-bold text-white mb-1">{stats.total_users || 0}</p>
                <p className="text-slate-400 text-sm">Registered Users</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Active Sessions */}
      {activeSessions.length > 0 && (
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-10">
              <div>
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-green-50 border border-green-100 text-green-700 text-sm font-medium mb-3">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                  Now Accepting Submissions
                </div>
                <h2 className="text-3xl font-bold text-slate-900">Active Sessions</h2>
              </div>
              {isAuthenticated && (
                <Link href="/sessions" className="mt-4 md:mt-0">
                  <Button variant="ghost" size="sm">
                    View All Sessions
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              )}
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeSessions.map((session) => (
                <Card key={session.id} className="group hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300 border-2 hover:border-primary-200">
                  <CardBody className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <Badge status="active" className="px-3 py-1">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                        Active
                      </Badge>
                      {session.tags && session.tags.length > 0 && (
                        <span className="text-xs text-slate-500">{session.tags.length} topics</span>
                      )}
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-2 group-hover:text-primary-600 transition-colors">
                      {session.name}
                    </h3>
                    {session.description && (
                      <p className="text-slate-600 text-sm mb-4 line-clamp-2">{session.description}</p>
                    )}
                    <div className="space-y-2 text-sm text-slate-500 mb-5">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-2 text-slate-400" />
                        <span>{formatDate(session.start_date)} – {formatDate(session.end_date)}</span>
                      </div>
                      {session.location && (
                        <div className="flex items-center">
                          <MapPin className="w-4 h-4 mr-2 text-slate-400" />
                          {session.location}
                        </div>
                      )}
                    </div>
                    {session.tags && session.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-5">
                        {session.tags.slice(0, 3).map((tag) => (
                          <span 
                            key={tag.id} 
                            className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs"
                          >
                            {tag.name}
                          </span>
                        ))}
                        {session.tags.length > 3 && (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-xs">
                            +{session.tags.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                    {isAuthenticated ? (
                      <Link href={`/sessions/${session.id}`}>
                        <Button variant="primary" className="w-full">
                          View Details
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </Link>
                    ) : (
                      <Link href="/register">
                        <Button variant="secondary" className="w-full group-hover:bg-primary-600 group-hover:text-white transition-colors">
                          <Upload className="w-4 h-4 mr-2" />
                          Sign Up to Submit
                        </Button>
                      </Link>
                    )}
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Upcoming Sessions */}
      {upcomingSessions.length > 0 && (
        <section className="py-20 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-10">
              <div>
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-sm font-medium mb-3">
                  <Clock className="w-4 h-4 mr-2" />
                  Coming Soon
                </div>
                <h2 className="text-3xl font-bold text-slate-900">Upcoming Sessions</h2>
              </div>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingSessions.map((session) => (
                <Card key={session.id} className="hover:shadow-lg transition-shadow bg-white">
                  <CardBody className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <Badge status="upcoming" className="px-3 py-1">
                        <Clock className="w-3 h-3 mr-1.5" />
                        Upcoming
                      </Badge>
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">{session.name}</h3>
                    {session.description && (
                      <p className="text-slate-600 text-sm mb-4 line-clamp-2">{session.description}</p>
                    )}
                    <div className="space-y-2 text-sm text-slate-500 mb-4">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-2 text-slate-400" />
                        <span>Starts {formatDate(session.start_date)}</span>
                      </div>
                      {session.location && (
                        <div className="flex items-center">
                          <MapPin className="w-4 h-4 mr-2 text-slate-400" />
                          {session.location}
                        </div>
                      )}
                    </div>
                    {!isAuthenticated && (
                      <Link href="/register">
                        <Button variant="ghost" className="w-full">
                          <UserPlus className="w-4 h-4 mr-2" />
                          Register for Updates
                        </Button>
                      </Link>
                    )}
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Empty State */}
      {!loading && sessions.length === 0 && (
        <section className="py-24 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Calendar className="w-10 h-10 text-slate-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">No Active Sessions</h2>
            <p className="text-slate-600 mb-8 max-w-md mx-auto">
              There are currently no active or upcoming sessions. Check back later or create an account to be notified when new sessions are announced.
            </p>
            {!isAuthenticated && (
              <Link href="/register">
                <Button size="lg">
                  <UserPlus className="w-5 h-5 mr-2" />
                  Create an Account
                </Button>
              </Link>
            )}
          </div>
        </section>
      )}

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">
              Everything You Need for Academic Reviews
            </h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              A complete platform designed for students, reviewers, and conference administrators
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors">
              <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Multi-Format Submissions</h3>
              <p className="text-slate-600 text-sm">
                Support for papers, presentations, and poster uploads with file validation.
              </p>
            </div>
            
            <div className="p-6 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors">
              <div className="w-12 h-12 bg-accent-100 rounded-xl flex items-center justify-center mb-4">
                <Target className="w-6 h-6 text-accent-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Custom Evaluation Criteria</h3>
              <p className="text-slate-600 text-sm">
                Define specific rubrics and scoring criteria for different session types.
              </p>
            </div>
            
            <div className="p-6 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Reviewer Assignment</h3>
              <p className="text-slate-600 text-sm">
                Intelligent reviewer matching based on expertise areas and interest tags.
              </p>
            </div>
            
            <div className="p-6 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Blind Review Support</h3>
              <p className="text-slate-600 text-sm">
                Optional anonymous review mode to ensure fair and unbiased evaluations.
              </p>
            </div>
            
            <div className="p-6 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                <BookOpen className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Detailed Feedback</h3>
              <p className="text-slate-600 text-sm">
                Structured review forms with scores and comments for comprehensive feedback.
              </p>
            </div>
            
            <div className="p-6 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors">
              <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-rose-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Analytics Dashboard</h3>
              <p className="text-slate-600 text-sm">
                Real-time statistics and insights for administrators and session managers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Simple steps to participate in conference reviews
            </p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <UserPlus className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">1. Create Account</h3>
              <p className="text-slate-400 text-sm">
                Sign up as a student or reviewer with your academic credentials
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-accent-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">2. Submit Work</h3>
              <p className="text-slate-400 text-sm">
                Upload your research papers, slides, or poster presentations
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Star className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">3. Get Reviewed</h3>
              <p className="text-slate-400 text-sm">
                Expert reviewers evaluate your work using structured criteria
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">4. Receive Feedback</h3>
              <p className="text-slate-400 text-sm">
                Get detailed scores and comments to improve your research
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* User Types */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">For Everyone in Academia</h2>
            <p className="text-slate-600">Different roles, tailored experiences</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-2 hover:border-primary-200 transition-colors">
              <CardBody className="p-8 text-center">
                <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <GraduationCap className="w-8 h-8 text-primary-600" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-3">Students</h3>
                <p className="text-slate-600 mb-6">
                  Submit your research projects, track review progress, and receive valuable feedback.
                </p>
                <ul className="text-left text-sm space-y-2 text-slate-600 mb-6">
                  <li className="flex items-center">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                    Easy project submission
                  </li>
                  <li className="flex items-center">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                    Real-time status tracking
                  </li>
                  <li className="flex items-center">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                    Detailed review feedback
                  </li>
                </ul>
                {!isAuthenticated && (
                  <Link href="/register">
                    <Button className="w-full">Get Started as Student</Button>
                  </Link>
                )}
              </CardBody>
            </Card>
            
            <Card className="border-2 hover:border-accent-200 transition-colors">
              <CardBody className="p-8 text-center">
                <div className="w-16 h-16 bg-accent-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Award className="w-8 h-8 text-accent-600" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-3">Reviewers</h3>
                <p className="text-slate-600 mb-6">
                  Contribute to academia by reviewing submissions in your areas of expertise.
                </p>
                <ul className="text-left text-sm space-y-2 text-slate-600 mb-6">
                  <li className="flex items-center">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                    Interest-based assignments
                  </li>
                  <li className="flex items-center">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                    Structured review forms
                  </li>
                  <li className="flex items-center">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                    Flexible scheduling
                  </li>
                </ul>
                {!isAuthenticated && (
                  <Link href="/register">
                    <Button variant="secondary" className="w-full">Join as Reviewer</Button>
                  </Link>
                )}
              </CardBody>
            </Card>
            
            <Card className="border-2 hover:border-amber-200 transition-colors">
              <CardBody className="p-8 text-center">
                <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Shield className="w-8 h-8 text-amber-600" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-3">Administrators</h3>
                <p className="text-slate-600 mb-6">
                  Manage sessions, users, and the entire review process with powerful admin tools.
                </p>
                <ul className="text-left text-sm space-y-2 text-slate-600 mb-6">
                  <li className="flex items-center">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                    Session management
                  </li>
                  <li className="flex items-center">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                    User & role control
                  </li>
                  <li className="flex items-center">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                    Analytics & reports
                  </li>
                </ul>
                {!isAuthenticated && (
                  <Link href="/login">
                    <Button variant="ghost" className="w-full">Admin Login</Button>
                  </Link>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      {!isAuthenticated && (
        <section className="py-20 bg-gradient-to-br from-primary-600 via-primary-700 to-accent-600">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-primary-100 mb-8 text-lg max-w-2xl mx-auto">
              Join our community of researchers, students, and reviewers. Start submitting your work or contribute as a reviewer today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register">
                <Button size="lg" className="w-full sm:w-auto bg-white text-primary-600 hover:bg-slate-100 shadow-xl">
                  <UserPlus className="w-5 h-5 mr-2" />
                  Create Free Account
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="ghost" size="lg" className="w-full sm:w-auto text-white border-2 border-white/30 hover:bg-white/10 hover:border-white/50">
                  <LogIn className="w-5 h-5 mr-2" />
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
                  <ClipboardCheck className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-white">ConfEval</span>
              </div>
              <p className="text-slate-400 text-sm max-w-sm">
                A comprehensive platform for managing academic conference submissions, reviews, and evaluations.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/login" className="hover:text-white transition-colors">Sign In</Link></li>
                <li><Link href="/register" className="hover:text-white transition-colors">Create Account</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">For Users</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/register" className="hover:text-white transition-colors">Submit Research</Link></li>
                <li><Link href="/register" className="hover:text-white transition-colors">Become a Reviewer</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm">
              © {new Date().getFullYear()} ConfEval. Conference & Poster Review System.
            </p>
            <p className="text-sm text-slate-500 mt-2 md:mt-0">
              Built for academic excellence
            </p>
          </div>
        </div>
      </footer>

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
            <p className="text-slate-600">Loading...</p>
          </div>
        </div>
      )}
    </div>
  );
}
