import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { taskApi, subjectApi } from '../../services/api';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/LoadingSpinner';
import { priorityBadge, statusBadge } from '../../components/ui/Badge';
import {
  ArrowLeft, Pencil, Trash2, CalendarDays, Clock, Tag, Flag,
  CheckCircle2, Circle, BookOpen, ListTodo, CheckSquare
} from 'lucide-react';
import { formatDate, formatTime, formatMinutes, isOverdue, isToday } from '../../utils/format';
import TaskModal from './TaskModal';

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data, loading, error, refetch } = useFetch(() => taskApi.get(id), [id]);
  const { data: subjectsData } = useFetch(() => subjectApi.list());
  const subjects = subjectsData?.subjects || [];
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (loading) return <Spinner size="lg" />;

  const task = data?.task;
  if (error || !task) {
    return (
      <EmptyState
        icon={ListTodo}
        title="Task not found"
        description={error || 'This task may have been deleted.'}
        actionLabel="Back to tasks"
        onAction={() => navigate('/tasks')}
      />
    );
  }

  const pb = priorityBadge(task.priority);
  const sb = statusBadge(task.status);
  const done = task.status === 'completed';
  const overdue = isOverdue(task.dueDate) && !done;

  const handleToggle = async () => {
    try {
      await taskApi.toggle(id);
      refetch();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await taskApi.remove(id);
      toast.success('Task deleted');
      navigate('/tasks');
    } catch (e) {
      toast.error(e.message);
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <Link to="/tasks" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">
        <ArrowLeft className="h-4 w-4" /> All tasks
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="flex items-start gap-3">
          <button onClick={handleToggle} className="mt-1 shrink-0 text-slate-300 dark:text-slate-600 hover:text-brand-500" aria-label={done ? 'Mark task as to do' : 'Mark task complete'}>
            {done ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-500 fill-emerald-500" />
            ) : (
              <Circle className="h-6 w-6 hover:border-brand-500" />
            )}
          </button>
          <div>
            <h1 className={`text-xl font-bold tracking-tight ${done ? 'text-slate-400 line-through' : ''}`}>
              {task.title}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
              <span className="badge bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{pb.label} priority</span>
              <span className={`badge ${done ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'}`}>{sb.label}</span>
              {task.subject && (
                <Link to={`/subjects/${task.subject._id}`} className="inline-flex items-center gap-1" style={{ color: task.subject.color }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: task.subject.color }} />
                  {task.subject.name}
                </Link>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Description */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold mb-2">Description</h2>
        {task.description ? (
          <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{task.description}</p>
        ) : (
          <p className="text-sm text-slate-400">No description.</p>
        )}
      </div>

      {/* Details */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold">Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-sm">
          <div>
            <p className="flex items-center gap-1.5 text-xs text-slate-400"><BookOpen className="h-3.5 w-3.5" /> Subject</p>
            {task.subject ? (
              <Link to={`/subjects/${task.subject._id}`} className="inline-flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200 hover:text-brand-600 dark:hover:text-brand-400" style={{ color: task.subject.color }}>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: task.subject.color }} />
                {task.subject.name}
              </Link>
            ) : (
              <p className="text-slate-400">No subject</p>
            )}
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-xs text-slate-400"><CalendarDays className="h-3.5 w-3.5" /> Due date</p>
            {task.dueDate ? (
              <p className={`font-medium ${overdue ? 'text-red-500' : isToday(task.dueDate) ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-slate-200'}`}>
                {formatDate(task.dueDate)}
              </p>
            ) : (
              <p className="text-slate-400">No due date</p>
            )}
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-xs text-slate-400"><Clock className="h-3.5 w-3.5" /> Estimated time</p>
            <p className="font-medium text-slate-800 dark:text-slate-200">{task.estimatedMinutes ? formatMinutes(task.estimatedMinutes) : '—'}</p>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-xs text-slate-400"><Flag className="h-3.5 w-3.5" /> Priority</p>
            <p className="font-medium text-slate-800 dark:text-slate-200">{pb.label}</p>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-xs text-slate-400"><CheckSquare className="h-3.5 w-3.5" /> Status</p>
            <p className="font-medium text-slate-800 dark:text-slate-200">{sb.label}{done && task.completedAt ? ` · ${formatDate(task.completedAt)}` : ''}</p>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-xs text-slate-400"><ListTodo className="h-3.5 w-3.5" /> Created</p>
            <p className="font-medium text-slate-800 dark:text-slate-200">{formatDate(task.createdAt)} · {formatTime(task.createdAt)}</p>
          </div>
        </div>
        {task.tags?.length > 0 && (
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400"><Tag className="h-3.5 w-3.5" /> Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {task.tags.map((tag) => (
                <span key={tag} className="badge bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400">#{tag}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <TaskModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        editing={task}
        subjects={subjects}
        onSaved={() => { setEditOpen(false); refetch(); }}
      />

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete task?" size="sm">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Delete "<span className="font-medium">{task.title}</span>"? This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button variant="danger" loading={deleting} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}