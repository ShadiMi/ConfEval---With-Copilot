'use client';

import { useEffect, useState, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import { useAuthStore } from '@/lib/store';
import { authApi, tagsApi } from '@/lib/api';
import { Tag } from '@/types';
import { getRoleLabel } from '@/lib/utils';
import toast from 'react-hot-toast';
import {
  User,
  Mail,
  Building,
  FileText,
  Tag as TagIcon,
  Upload,
  Save,
  CreditCard,
  Phone,
} from 'lucide-react';

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    full_name: '',
    affiliation: '',
    id_number: '',
    phone_number: '',
  });
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const cvInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name,
        affiliation: user.affiliation || '',
        id_number: user.id_number || '',
        phone_number: user.phone_number || '',
      });
      setSelectedTags(user.interested_tags?.map((t) => t.id) || []);
    }
    loadTags();
  }, [user]);

  const loadTags = async () => {
    try {
      const res = await tagsApi.list();
      setTags(res.data);
    } catch (error) {
      console.error('Error loading tags:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const res = await authApi.updateMe(formData);
      setUser(res.data);
      toast.success('Profile updated successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleTagsUpdate = async () => {
    if (!isReviewer) return;
    
    setSaving(true);
    try {
      const res = await authApi.updateTags(selectedTags);
      setUser(res.data);
      toast.success('Interests updated');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to update interests');
    } finally {
      setSaving(false);
    }
  };

  const handleCVUpload = async (file: File) => {
    setUploading(true);
    try {
      const res = await authApi.uploadCV(file);
      setUser(res.data);
      toast.success('CV uploaded successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to upload CV');
    } finally {
      setUploading(false);
    }
  };

  const toggleTag = (tagId: number) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const isReviewer = user?.role === 'internal_reviewer' || user?.role === 'external_reviewer';

  if (loading || !user) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Profile Settings</h1>
        <p className="text-slate-600 mt-1">Manage your account information</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Card */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-slate-900">Profile Information</h2>
            </CardHeader>
            <CardBody>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
                  <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-2xl font-bold text-primary-700">
                      {user.full_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{user.full_name}</p>
                    <Badge variant="primary">{getRoleLabel(user.role)}</Badge>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Full Name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    required
                  />
                  <Input
                    label="Email"
                    value={user.email}
                    disabled
                    className="bg-slate-50"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="ID Number"
                    placeholder="123456789"
                    value={formData.id_number}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 9);
                      setFormData({ ...formData, id_number: value });
                    }}
                    helperText="Your 9-digit ID card number"
                  />
                  <Input
                    label="Phone Number"
                    placeholder="+1234567890"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  />
                </div>

                {(user.role === 'external_reviewer' || formData.affiliation) && (
                  <Input
                    label="Affiliation"
                    placeholder="University/Organization"
                    value={formData.affiliation}
                    onChange={(e) => setFormData({ ...formData, affiliation: e.target.value })}
                  />
                )}

                <div className="flex justify-end">
                  <Button type="submit" isLoading={saving}>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* CV Upload for Reviewers */}
          {isReviewer && (
            <Card>
              <CardHeader>
                <div className="flex items-center">
                  <FileText className="w-5 h-5 text-slate-400 mr-2" />
                  <h2 className="font-semibold text-slate-900">CV / Resume</h2>
                </div>
              </CardHeader>
              <CardBody>
                <p className="text-sm text-slate-500 mb-4">
                  {user.cv_path ? 'CV uploaded' : 'Upload your CV for admin review'}
                </p>
                <input
                  type="file"
                  ref={cvInputRef}
                  className="hidden"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => e.target.files?.[0] && handleCVUpload(e.target.files[0])}
                />
                <Button
                  variant={user.cv_path ? 'secondary' : 'primary'}
                  className="w-full"
                  onClick={() => cvInputRef.current?.click()}
                  isLoading={uploading}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {user.cv_path ? 'Replace CV' : 'Upload CV'}
                </Button>
              </CardBody>
            </Card>
          )}

          {/* Interests for Reviewers */}
          {isReviewer && tags.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center">
                  <TagIcon className="w-5 h-5 text-slate-400 mr-2" />
                  <h2 className="font-semibold text-slate-900">Research Interests</h2>
                </div>
              </CardHeader>
              <CardBody>
                <p className="text-sm text-slate-500 mb-4">
                  Select topics you're interested in reviewing
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {tags.map((tag) => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        selectedTags.includes(tag.id)
                          ? 'bg-primary-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={handleTagsUpdate}
                  isLoading={saving}
                >
                  Update Interests
                </Button>
              </CardBody>
            </Card>
          )}

          {/* Account Info */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-slate-900">Account</h2>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="flex items-center text-sm">
                <User className="w-4 h-4 text-slate-400 mr-2" />
                <span className="text-slate-500">Role:</span>
                <span className="ml-2 font-medium text-slate-900">
                  {getRoleLabel(user.role)}
                </span>
              </div>
              <div className="flex items-center text-sm">
                <Mail className="w-4 h-4 text-slate-400 mr-2" />
                <span className="text-slate-500">Email:</span>
                <span className="ml-2 font-medium text-slate-900">{user.email}</span>
              </div>
              {user.affiliation && (
                <div className="flex items-center text-sm">
                  <Building className="w-4 h-4 text-slate-400 mr-2" />
                  <span className="text-slate-500">Affiliation:</span>
                  <span className="ml-2 font-medium text-slate-900">{user.affiliation}</span>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
