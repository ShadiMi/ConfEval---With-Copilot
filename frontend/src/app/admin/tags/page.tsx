'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import EmptyState from '@/components/ui/EmptyState';
import { tagsApi } from '@/lib/api';
import { Tag } from '@/types';
import toast from 'react-hot-toast';
import {
  Tags,
  Plus,
  Edit,
  Trash2,
} from 'lucide-react';

export default function AdminTagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadTags();
  }, []);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      if (editingTag) {
        await tagsApi.update(editingTag.id, formData);
        toast.success('Tag updated');
      } else {
        await tagsApi.create(formData);
        toast.success('Tag created');
      }
      setModalOpen(false);
      resetForm();
      loadTags();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to save tag');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this tag?')) return;
    
    try {
      await tagsApi.delete(id);
      toast.success('Tag deleted');
      loadTags();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to delete tag');
    }
  };

  const openEditModal = (tag: Tag) => {
    setEditingTag(tag);
    setFormData({
      name: tag.name,
      description: tag.description || '',
    });
    setModalOpen(true);
  };

  const resetForm = () => {
    setEditingTag(null);
    setFormData({ name: '', description: '' });
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tag Management</h1>
          <p className="text-slate-600 mt-1">Manage research area tags</p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setModalOpen(true);
          }}
          className="mt-4 sm:mt-0"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Tag
        </Button>
      </div>

      {tags.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<Tags className="w-12 h-12" />}
              title="No Tags Found"
              description="Create tags to categorize projects."
              action={
                <Button
                  onClick={() => {
                    resetForm();
                    setModalOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Tag
                </Button>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tags.map((tag) => (
            <Card key={tag.id}>
              <CardBody>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">{tag.name}</h3>
                    {tag.description && (
                      <p className="text-sm text-slate-500 mt-1">{tag.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEditModal(tag)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(tag.id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Tag Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          resetForm();
        }}
        title={editingTag ? 'Edit Tag' : 'Create Tag'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Tag Name"
            placeholder="e.g., Machine Learning"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <Textarea
            label="Description (Optional)"
            placeholder="Describe this research area..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setModalOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={submitting}>
              {editingTag ? 'Update' : 'Create'} Tag
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
