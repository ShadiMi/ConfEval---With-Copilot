'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { authApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Building, LifeBuoy, Save } from 'lucide-react';

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSupport, setSavingSupport] = useState(false);
  const [internalAffiliation, setInternalAffiliation] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportPhone, setSupportPhone] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [affRes, emailRes, phoneRes] = await Promise.all([
        authApi.getSetting('internal_reviewer_affiliation'),
        authApi.getSetting('support_email'),
        authApi.getSetting('support_phone'),
      ]);
      setInternalAffiliation(affRes.data?.value || '');
      setSupportEmail(emailRes.data?.value || '');
      setSupportPhone(phoneRes.data?.value || '');
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      await authApi.updateSetting('internal_reviewer_affiliation', internalAffiliation);
      toast.success('Settings saved successfully. Internal reviewers will be updated.');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSupport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) {
      toast.error('Please enter a valid support email address.');
      return;
    }
    setSavingSupport(true);
    try {
      await Promise.all([
        authApi.updateSetting('support_email', supportEmail),
        authApi.updateSetting('support_phone', supportPhone),
      ]);
      toast.success('Support contact info saved.');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to save support info');
    } finally {
      setSavingSupport(false);
    }
  };

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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">System Settings</h1>
        <p className="text-slate-600 mt-1">Configure system-wide settings</p>
      </div>

      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <Building className="w-5 h-5 text-slate-400 mr-2" />
              <h2 className="font-semibold text-slate-900">Internal Reviewer Settings</h2>
            </div>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleSave} className="space-y-4">
              <Input
                label="Default Affiliation for Internal Reviewers"
                placeholder="e.g., University of Example"
                value={internalAffiliation}
                onChange={(e) => setInternalAffiliation(e.target.value)}
                helperText="This affiliation will be automatically assigned to all internal reviewers. Changing this will update all existing internal reviewers."
              />

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-sm text-blue-700">
                  <p className="font-medium">Note:</p>
                  <p className="mt-1">
                    When you update this setting, all internal reviewers will have their 
                    affiliation changed to match. New internal reviewers will automatically 
                    receive this affiliation upon registration.
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" isLoading={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Settings
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center">
              <LifeBuoy className="w-5 h-5 text-slate-400 mr-2" />
              <h2 className="font-semibold text-slate-900">Support Contact Info</h2>
            </div>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleSaveSupport} className="space-y-4">
              <Input
                label="Support email"
                type="email"
                placeholder="support@example.org"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                helperText="Shown to users in the in-app tutorial and footer for technical issues."
              />
              <Input
                label="Support phone"
                placeholder="+1 555 123 4567"
                value={supportPhone}
                onChange={(e) => setSupportPhone(e.target.value)}
                helperText="Optional. Shown alongside the support email."
              />
              <div className="flex justify-end">
                <Button type="submit" isLoading={savingSupport}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Support Info
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </DashboardLayout>
  );
}
