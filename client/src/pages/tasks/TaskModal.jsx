import { useState, useEffect } from 'react';
import { taskApi } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input, Textarea, Select } from '../../components/ui/Input';

export default function TaskModal({ open, onClose, editing, subjects, defaultSubject, onSaved }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', subject: defaultSubject || '', priority: 'medium',
    status: 'todo', dueDate: '', estimatedMinutes: 0, tags: ''
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      if (editing) {
        setForm({
          title: editing.title,
          description: editing.description || '',
          subject: editing.subject?._id || '',
          priority: editing.priority || 'medium',
          status: editing.status,
          dueDate: editing.dueDate ? new Date(editing.dueDate).toISOString().slice(0, 10) : '',
          estimatedMinutes: editing.estimatedMinutes || 0,
          tags: (editing.tags || []).join(', ')
        });
      } else {
        setForm({
          title: '', description: '', subject: defaultSubject || '', priority: 'medium',
          status: 'todo', dueDate: '', estimatedMinutes: 0, tags: ''
        });
      }
      setErrors({});
    }
  }, [open, editing, defaultSubject]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setErrors({ title: 'Title is required' }); return; }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        subject: form.subject || null,
        priority: form.priority,
        status: form.status,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
        estimatedMinutes: Number(form.estimatedMinutes) || 0,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean)
      };
      if (editing) {
        await taskApi.update(editing._id, payload);
        toast.success('Task updated');
      } else {
        await taskApi.create(payload);
        toast.success('Task created');
      }
      onSaved();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit task' : 'New task'}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Input
            label="Title *"
            placeholder="e.g. Study for Network Security exam"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            error={errors.title}
            autoFocus
          />
        </div>
        <Textarea
          label="Description"
          placeholder="Notes, links, context…"
          rows={3}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
            <option value="">No subject</option>
            {subjects.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </Select>
          <Select label="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="todo">To do</option>
            <option value="in-progress">In progress</option>
            <option value="completed">Completed</option>
          </Select>
          <Input
            label="Due date"
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Estimated time (minutes)"
            type="number"
            min="0"
            placeholder="45"
            value={form.estimatedMinutes}
            onChange={(e) => setForm({ ...form, estimatedMinutes: e.target.value })}
          />
          <Input
            label="Tags"
            placeholder="exam, chapter-4 (comma separated)"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>{editing ? 'Save changes' : 'Create task'}</Button>
        </div>
      </form>
    </Modal>
  );
}