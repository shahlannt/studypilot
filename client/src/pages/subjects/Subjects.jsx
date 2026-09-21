import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { subjectApi } from '../../services/api';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input, Textarea, Select } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Spinner } from '../../components/ui/LoadingSpinner';
import {
  BookOpen, Plus, MoreVertical, Trash2, Pencil, Clock, CheckSquare,
  StickyNote, GraduationCap, FolderOpen, Users
} from 'lucide-react';
import { Dropdown, DropdownItem } from '../../components/ui/Dropdown';
import { useForm } from 'react-hook-form';
import { formatMinutes } from '../../utils/format';

const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6'];

export default function Subjects() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data, loading, error, refetch } = useFetch(() => subjectApi.list());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const subjects = data?.subjects || [];

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Subjects</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Your courses and study areas.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4" /> New subject
        </Button>
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <EmptyState icon={BookOpen} title="Couldn't load subjects" description={error} actionLabel="Retry" onAction={refetch} />
      ) : subjects.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No subjects yet"
          description="Create your first subject — like Computer Networks or Calculus — to start organizing your studies."
          actionLabel="Create your first subject"
          onAction={() => { setEditing(null); setModalOpen(true); }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {subjects.map((s) => (
            <div key={s._id} className="card p-5 group hover:shadow-cardHover transition-shadow flex flex-col">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${s.color}1a` }}>
                    <BookOpen className="h-5 w-5" style={{ color: s.color }} />
                  </div>
                  <div className="min-w-0">
                    <Link to={`/subjects/${s._id}`} className="text-base font-semibold text-slate-900 dark:text-slate-100 hover:text-brand-600 dark:hover:text-brand-400">
                      {s.name}
                    </Link>
                    {s.semester && <p className="text-xs text-slate-400">{s.semester}</p>}
                  </div>
                </div>
                <Dropdown
                  trigger={
                    <span className="text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" role="button" aria-label="Subject options">
                      <MoreVertical className="h-4 w-4" />
                    </span>
                  }
                >
                  <DropdownItem icon={Pencil} onClick={() => { setEditing(s); setModalOpen(true); }}>Edit</DropdownItem>
                  <DropdownItem icon={Trash2} danger onClick={() => { setDeleting(s); setConfirmOpen(true); }}>Delete</DropdownItem>
                </Dropdown>
              </div>

              {s.description && (
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{s.description}</p>
              )}

              <div className="mt-4 flex-1">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Progress</span>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{s.progress}%</span>
                </div>
                <ProgressBar value={s.progress} color={s.color} />
              </div>

              <div className="mt-4 grid grid-cols-4 gap-2 text-center border-t border-slate-100 dark:border-slate-800 pt-3">
                <div className="flex flex-col items-center gap-0.5">
                  <CheckSquare className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200">{s.completedTasks}</span>
                  <span className="text-[10px] text-slate-400">done</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <StickyNote className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200">{s.notesCount}</span>
                  <span className="text-[10px] text-slate-400">notes</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200">{formatMinutes(s.studyMinutes)}</span>
                  <span className="text-[10px] text-slate-400">study</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <GraduationCap className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200">{s.avgQuizScore}%</span>
                  <span className="text-[10px] text-slate-400">quizzes</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <SubjectModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        onSaved={() => { setModalOpen(false); refetch(); }}
      />

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Delete subject?" size="sm">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          This will permanently delete <span className="font-medium">{deleting?.name}</span> and all its tasks and notes.
          This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button variant="danger" onClick={async () => {
            try {
              await subjectApi.remove(deleting._id);
              toast.success('Subject deleted');
              setConfirmOpen(false);
              refetch();
            } catch (e) {
              toast.error(e.message);
            }
          }}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}

function SubjectModal({ open, onClose, editing, onSaved }) {
  const { toast } = useToast();
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: { name: '', description: '', semester: '', color: '#6366f1' }
  });
  const [saving, setSaving] = useState(false);
  const [color, setColor] = useState('#6366f1');

  // Reset fresh (create) or pre-fill (edit) every time the modal opens.
  // Without resetting on create, the form keeps the previous subject's values.
  useEffect(() => {
    if (!open) return;
    if (editing) {
      reset({
        name: editing.name,
        description: editing.description,
        semester: editing.semester || '',
        color: editing.color
      });
      setColor(editing.color);
    } else {
      reset({ name: '', description: '', semester: '', color: '#6366f1' });
      setColor('#6366f1');
    }
  }, [open, editing, reset]);

  const onSubmit = async (values) => {
    setSaving(true);
    try {
      if (editing) {
        await subjectApi.update(editing._id, { ...values, color });
        toast.success('Subject updated');
      } else {
        await subjectApi.create({ ...values, color });
        toast.success('Subject created');
      }
      onSaved();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit subject' : 'New subject'}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Name *" placeholder="e.g. Computer Networks" error={errors.name?.message} {...register('name', { required: 'Subject name is required' })} />
        <Textarea label="Description" placeholder="What is this subject about?" rows={3} {...register('description')} />
        <Input label="Semester / course" placeholder="e.g. Semester 4" {...register('semester')} />

        <div>
          <span className="label">Color</span>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-8 w-8 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-brand-500 scale-110' : 'hover:scale-105'}`}
                style={{ backgroundColor: c }}
                aria-label={`Choose color ${c}`}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>{editing ? 'Save changes' : 'Create subject'}</Button>
        </div>
      </form>
    </Modal>
  );
}