'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import { authApi } from '@/lib/api';
import { User } from '@/types';
import { formatDate, getRoleLabel } from '@/lib/utils';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  Users,
  UserCheck,
  UserX,
  Eye,
  FileText,
  ShieldCheck,
  ShieldX,
  Edit,
  Trash2,
} from 'lucide-react';

const roleOptions = [
  { value: '', label: 'All Roles' },
  { value: 'student', label: 'Students' },
  { value: 'internal_reviewer', label: 'Internal Reviewers' },
  { value: 'external_reviewer', label: 'External Reviewers' },
  { value: 'admin', label: 'Admins' },
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');

  useEffect(() => {
    loadUsers();
  }, [roleFilter]);

  const loadUsers = async () => {
    try {
      const res = await authApi.getUsers(roleFilter || undefined);
      setUsers(res.data);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (userId: number, isActive: boolean) => {
    try {
      await authApi.toggleUserStatus(userId, isActive);
      toast.success(`User ${isActive ? 'activated' : 'deactivated'}`);
      loadUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to update user');
    }
  };

  const handleApproveReviewer = async (userId: number, isApproved: boolean) => {
    try {
      await authApi.approveReviewer(userId, isApproved);
      toast.success(`Reviewer ${isApproved ? 'approved' : 'rejected'}`);
      loadUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to update reviewer');
    }
  };

  const isReviewer = (role: string) => 
    role === 'internal_reviewer' || role === 'external_reviewer';

  // State for delete confirmation modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  
  // State for role editing
  const [editingRoleUserId, setEditingRoleUserId] = useState<number | null>(null);

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await authApi.deleteUser(userToDelete.id);
      toast.success('User deleted successfully');
      setDeleteModalOpen(false);
      setUserToDelete(null);
      loadUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to delete user');
    }
  };

  const handleUpdateRole = async (userId: number, newRole: string) => {
    try {
      await authApi.updateUserRole(userId, newRole);
      toast.success('User role updated');
      setEditingRoleUserId(null);
      loadUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to update role');
    }
  };

  const openDeleteModal = (user: User) => {
    setUserToDelete(user);
    setDeleteModalOpen(true);
  };

  // Get pending reviewers
  const pendingReviewers = users.filter(
    (user) => isReviewer(user.role) && !user.is_approved
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
          <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          <p className="text-slate-600 mt-1">Manage system users</p>
        </div>
        <div className="mt-4 sm:mt-0 w-48">
          <Select
            options={roleOptions}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Pending Reviewers Section */}
      {pendingReviewers.length > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
              <h2 className="font-semibold text-amber-900">
                Pending Reviewer Approvals ({pendingReviewers.length})
              </h2>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <div className="divide-y divide-amber-200">
              {pendingReviewers.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 gap-4"
                >
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center mr-3">
                      <span className="text-sm font-medium text-amber-800">
                        {user.full_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{user.full_name}</p>
                      <p className="text-sm text-slate-500">{user.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="primary">{getRoleLabel(user.role)}</Badge>
                        {user.affiliation && (
                          <span className="text-xs text-slate-500">{user.affiliation}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:ml-4">
                    {user.cv_path && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => authApi.downloadCV(user.id)}
                      >
                        <FileText className="w-4 h-4 mr-1" />
                        View CV
                      </Button>
                    )}
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleApproveReviewer(user.id, true)}
                    >
                      <ShieldCheck className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleApproveReviewer(user.id, false)}
                    >
                      <ShieldX className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Approval
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center mr-3">
                          <span className="text-sm font-medium text-primary-700">
                            {user.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{user.full_name}</p>
                          <p className="text-sm text-slate-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant="primary">{getRoleLabel(user.role)}</Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={user.is_active ? 'success' : 'danger'}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {isReviewer(user.role) ? (
                        <Badge variant={user.is_approved ? 'success' : 'warning'}>
                          {user.is_approved ? 'Approved' : 'Pending'}
                        </Badge>
                      ) : (
                        <span className="text-sm text-slate-400">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        {user.cv_path && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            title="View CV"
                            onClick={() => authApi.downloadCV(user.id)}
                          >
                            <FileText className="w-4 h-4 text-blue-500" />
                          </Button>
                        )}
                        {isReviewer(user.role) && !user.is_approved && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleApproveReviewer(user.id, true)}
                            title="Approve Reviewer"
                          >
                            <ShieldCheck className="w-4 h-4 text-green-500" />
                          </Button>
                        )}
                        {isReviewer(user.role) && user.is_approved && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleApproveReviewer(user.id, false)}
                            title="Revoke Approval"
                          >
                            <ShieldX className="w-4 h-4 text-orange-500" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleStatus(user.id, !user.is_active)}
                          title={user.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {user.is_active ? (
                            <UserX className="w-4 h-4 text-red-500" />
                          ) : (
                            <UserCheck className="w-4 h-4 text-green-500" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingRoleUserId(editingRoleUserId === user.id ? null : user.id)}
                          title="Edit Role"
                        >
                          <Edit className="w-4 h-4 text-blue-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteModal(user)}
                          title="Delete User"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                      {editingRoleUserId === user.id && (
                        <div className="mt-2 flex items-center gap-2">
                          <select
                            className="text-sm border rounded px-2 py-1"
                            defaultValue={user.role}
                            onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                          >
                            <option value="student">Student</option>
                            <option value="internal_reviewer">Internal Reviewer</option>
                            <option value="external_reviewer">External Reviewer</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setUserToDelete(null);
        }}
        title="Delete User"
      >
        <div className="space-y-4">
          <p className="text-slate-600">
            Are you sure you want to delete <strong>{userToDelete?.full_name}</strong>? 
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setDeleteModalOpen(false);
                setUserToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteUser}>
              Delete User
            </Button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
