'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { cn, getRoleLabel } from '@/lib/utils';
import {
  LayoutDashboard,
  FolderKanban,
  Calendar,
  Users,
  ClipboardList,
  FileCheck,
  Tags,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Bell,
  Home,
  UserCog,
  BarChart3,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { notificationsApi, authApi, projectsApi } from '@/lib/api';
import { Notification } from '@/types';
import { formatDate } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
}

const navItems: NavItem[] = [
  {
    label: 'Home',
    href: '/',
    icon: Home,
  },
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'My Projects',
    href: '/projects',
    icon: FolderKanban,
    roles: ['student'],
  },
  {
    label: 'Sessions',
    href: '/sessions',
    icon: Calendar,
  },
  {
    label: 'Projects',
    href: '/admin/projects',
    icon: FolderKanban,
    roles: ['admin'],
  },
  {
    label: 'Users',
    href: '/admin/users',
    icon: Users,
    roles: ['admin'],
  },
  {
    label: 'Applications',
    href: '/admin/applications',
    icon: ClipboardList,
    roles: ['admin'],
  },
  {
    label: 'Assignments',
    href: '/admin/assignments',
    icon: UserCog,
    roles: ['admin'],
  },
  {
    label: 'My Applications',
    href: '/applications',
    icon: ClipboardList,
    roles: ['internal_reviewer', 'external_reviewer'],
  },
  {
    label: 'Reviews',
    href: '/reviews',
    icon: FileCheck,
    roles: ['internal_reviewer', 'external_reviewer'],
  },
  {
    label: 'Tags',
    href: '/admin/tags',
    icon: Tags,
    roles: ['admin'],
  },
  {
    label: 'Reports',
    href: '/admin/reports',
    icon: BarChart3,
    roles: ['admin'],
  },
  {
    label: 'Settings',
    href: '/admin/settings',
    icon: Settings,
    roles: ['admin'],
  },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [pendingProjectsCount, setPendingProjectsCount] = useState(0);

  useEffect(() => {
    if (user) {
      loadNotifications();
      // Load pending counts for admins
      if (user.role === 'admin') {
        loadPendingApprovalCount();
        loadPendingProjectsCount();
      }
      // Poll for new notifications every 30 seconds
      const interval = setInterval(() => {
        loadNotifications();
        if (user.role === 'admin') {
          loadPendingApprovalCount();
          loadPendingProjectsCount();
        }
      }, 30000);
      return () => clearInterval(interval);
    } else {
      // Clear notifications when user logs out
      setNotifications([]);
      setUnreadCount(0);
      setPendingApprovalCount(0);
      setPendingProjectsCount(0);
    }
  }, [user]);

  const loadPendingApprovalCount = async () => {
    try {
      const res = await authApi.getPendingApprovalCount();
      setPendingApprovalCount(res.data.pending_count);
    } catch (error) {
      console.error('Failed to load pending approval count:', error);
    }
  };

  const loadPendingProjectsCount = async () => {
    try {
      const res = await projectsApi.getPendingCount();
      setPendingProjectsCount(res.data.pending_count);
    } catch (error) {
      console.error('Failed to load pending projects count:', error);
    }
  };

  const loadNotifications = async () => {
    // Don't load if no token (user logged out)
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
      const [notifRes, countRes] = await Promise.all([
        notificationsApi.list(false),
        notificationsApi.getUnreadCount(),
      ]);
      setNotifications(notifRes.data.slice(0, 5)); // Show only latest 5
      setUnreadCount(countRes.data.unread_count);
    } catch (error) {
      // Silently fail - user might have logged out
      console.error('Failed to load notifications:', error);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await notificationsApi.markAsRead(notification.id);
      loadNotifications();
    }
    if (notification.link) {
      router.push(notification.link);
    }
    setNotificationsOpen(false);
  };

  const handleMarkAllRead = async () => {
    await notificationsApi.markAllAsRead();
    loadNotifications();
  };

  const handleLogout = () => {
    // Clear notifications first to prevent any pending API calls
    setNotifications([]);
    setUnreadCount(0);
    setNotificationsOpen(false);
    setUserMenuOpen(false);
    logout();
    router.replace('/login');
  };

  const filteredNavItems = navItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  );

  if (!user) return null;

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo and Desktop Nav */}
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="text-xl font-bold text-primary-600">
                ConfEval
              </Link>
            </div>
            <div className="hidden md:ml-8 md:flex md:space-x-2">
              {filteredNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'inline-flex items-center px-2.5 py-2 text-sm font-medium rounded-lg transition-colors relative',
                    pathname === item.href || pathname.startsWith(item.href + '/')
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  )}
                >
                  <item.icon className="w-4 h-4 mr-2" />
                  {item.label}
                  {item.href === '/admin/users' && pendingApprovalCount > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-red-500 rounded-full">
                      {pendingApprovalCount}
                    </span>
                  )}
                  {item.href === '/admin/projects' && pendingProjectsCount > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-red-500 rounded-full">
                      {pendingProjectsCount}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>

          {/* User Menu */}
          <div className="hidden md:flex md:items-center md:space-x-4">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative p-2 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Bell className="w-5 h-5 text-slate-600" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-slate-200 py-1 max-h-96 overflow-y-auto">
                  <div className="px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                    <span className="font-semibold text-slate-900">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-xs text-primary-600 hover:text-primary-700"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-slate-500 text-sm">
                      No notifications
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => handleNotificationClick(notif)}
                        className={cn(
                          'px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100',
                          !notif.is_read && 'bg-primary-50'
                        )}
                      >
                        <p className="text-sm font-medium text-slate-900">{notif.title}</p>
                        <p className="text-xs text-slate-600 mt-1">{notif.message}</p>
                        <p className="text-xs text-slate-400 mt-1">{formatDate(notif.created_at)}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary-700">
                    {user.full_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-slate-700">{user.full_name}</p>
                  <p className="text-xs text-slate-500">{getRoleLabel(user.role)}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1">
                  <Link
                    href="/profile"
                    className="flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Profile Settings
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {filteredNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center px-3 py-2 text-base font-medium rounded-lg',
                  pathname === item.href || pathname.startsWith(item.href + '/')
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-slate-600 hover:bg-slate-50'
                )}
                onClick={() => setMobileMenuOpen(false)}
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.label}
                {item.href === '/admin/users' && pendingApprovalCount > 0 && (
                  <span className="ml-auto inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-red-500 rounded-full">
                    {pendingApprovalCount}
                  </span>
                )}
                {item.href === '/admin/projects' && pendingProjectsCount > 0 && (
                  <span className="ml-auto inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-red-500 rounded-full">
                    {pendingProjectsCount}
                  </span>
                )}
              </Link>
            ))}
          </div>
          <div className="border-t border-slate-200 pt-4 pb-3 px-4">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                <span className="text-sm font-medium text-primary-700">
                  {user.full_name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="ml-3">
                <p className="text-base font-medium text-slate-700">{user.full_name}</p>
                <p className="text-sm text-slate-500">{getRoleLabel(user.role)}</p>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              <Link
                href="/profile"
                className="flex items-center px-3 py-2 text-base font-medium text-slate-600 rounded-lg hover:bg-slate-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Settings className="w-5 h-5 mr-3" />
                Profile Settings
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center w-full px-3 py-2 text-base font-medium text-red-600 rounded-lg hover:bg-red-50"
              >
                <LogOut className="w-5 h-5 mr-3" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
