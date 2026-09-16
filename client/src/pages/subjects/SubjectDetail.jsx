import { useState, useCallback, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { subjectApi } from '../../services/api';
import { useFetch } from '../../hooks/useFetch';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Tabs } from '../../components/ui/Tabs';
import { StatCard } from '../../components/ui/StatCard';
import { useToast } from '../../context/ToastContext';
import {
  ArrowLeft, Pencil, Trash2, Plus, CheckSquare, StickyNote,
  Clock, GraduationCap, Target, BookOpen, Sparkles, Square
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Input, Textarea } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { excerpt, formatDate } from '../../utils/format';

export default function SubjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data, loading, error, refetch } = useFetch(() => subjectApi.get(id), [id]);
  const [tab, setTab] = useState('overview');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  if (loading) return <Spinner size="lg" />;

  const subject = data?.subject;
  if (error || !subject) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Subject not found"
        description={error || 'This subject may have been deleted.'}
        actionLabel="Back to subjects"
        onAction={() => navigate('/subjects')}
      />
    );
  }

  const tasks = data?.tasks || [];
  const notes = data?.notes || [];

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'tasks', label: `Tasks (${tasks.length})` },
    { key: 'notes', label: `Notes (${notes.length})` },
    { key: 'sessions', label: 'Sessions' },
    { key: 'quiz', label: 'Quiz performance' }
  ];

  return (
    <div className="space-y-6 animate-slide-up">
      <Link to="/subjects" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">
        <ArrowLeft className="h-4 w-4" /> All subjects
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: `${subject.color}1a` }}>
            <BookOpen className="h-6 w-6" style={{ color: subject.color }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{subject.name}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {subject.semester ? `${subject.semester} · ` : ''}
              {subject.targetDate ? `Target: ${formatDate(subject.targetDate)}` : 'No target date set'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
          <Link to={`/quizzes?source=subject&id=${id}`} className="btn-secondary">
            <Sparkles className="h-4 w-4" /> Generate quiz
          </Link>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {subject.description && (
        <p className="text-sm text-slate-600 dark:text-slate-300 max-w-2xl">{subject.description}</p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard icon={Target} label="Progress" value={`${subject.progress}%`} color="indigo" />
        <StatCard icon={CheckSquare} label="Tasks done" value={subject.completedTasks} sub={`${subject.totalTasks} total`} color="green" />
        <StatCard icon={StickyNote} label="Notes" value={subject.notesCount} color="blue" />
        <StatCard icon={Clock} label="Study time" value={subject.studyHours} sub="hours" color="amber" />
        <StatCard icon={GraduationCap} label="Quiz avg" value={`${subject.avgQuizScore}%`} sub={`${subject.attemptsCount} attempts`} color="purple" />
      </div>

      {/* Progress bar */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold">Completion</h2>
          <span className="text-sm font-semibold" style={{ color: subject.color }}>{subject.progress}%</span>
        </div>
        <ProgressBar value={subject.progress} color={subject.color} />
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          {subject.taskProgressComplete ? 'All tasks completed — nice work!' : `${subject.pendingTasks} tasks remaining to reach 100%.`}
        </p>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      <div className="space-y-4">
        {tab === 'overview' && (
          <OverviewTab subject={subject} tasks={tasks} notes={notes} />
        )}
        {tab === 'tasks' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Tasks</h3>
              <Link to={`/tasks?subject=${id}`} className="text-xs font-medium text-brand-600 dark:text-brand-400">Manage all</Link>
            </div>
            {tasks.length === 0 ? (
              <EmptyState icon={CheckSquare} title="No tasks for this subject" description="Add tasks to start tracking progress." actionLabel="Add a task" onAction={() => navigate(`/tasks?new=1&subject=${id}`)} />
            ) : (
              <div className="card divide-y divide-slate-100 dark:divide-slate-800">
                {tasks.map((t) => (
                  <div key={t._id} className="flex items-center gap-3 px-4 py-3">
                    <Square className={`h-4 w-4 shrink-0 ${t.status === 'completed' ? 'text-emerald-500 fill-emerald-500' : 'text-slate-300 dark:text-slate-600'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${t.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-200'}`}>{t.title}</p>
                      <p className="text-xs text-slate-400">{t.status} · {t.priority}</p>
                    </div>
                    <span className="text-xs text-slate-400">{t.dueDate ? formatDate(t.dueDate) : 'No due date'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {tab === 'notes' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Notes</h3>
              <Link to={`/notes/new?subject=${id}`} className="btn-secondary btn sm:btn"><Plus className="h-4 w-4" /> New note</Link>
            </div>
            {notes.length === 0 ? (
              <EmptyState icon={StickyNote} title="No notes yet" description="Create notes for this subject and summarize them with AI." actionLabel="Create note" onAction={() => navigate(`/notes/new?subject=${id}`)} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {notes.map((n) => (
                  <Link key={n._id} to={`/notes/${n._id}`} className="card p-4 hover:shadow-cardHover transition-shadow">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{n.title}</p>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-3">{excerpt(n.content, 140)}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
        {tab === 'sessions' && <SessionsTab subjectId={id} />}
        {tab === 'quiz' && <QuizTab subjectId={id} />}
      </div>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete subject?" size="sm">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          This will permanently delete <span className="font-medium">{subject.name}</span> and all its tasks and notes.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button variant="danger" loading={deleting} onClick={async () => {
            setDeleting(true);
            try {
              await subjectApi.remove(id);
              toast.success('Subject deleted');
              navigate('/subjects');
            } catch (e) {
              toast.error(e.message);
              setDeleting(false);
            }
          }}>Delete</Button>
        </div>
      </Modal>

      <EditSubjectModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        subject={subject}
        onSaved={() => { setEditOpen(false); refetch(); }}
      />
    </div>
  );
}

function OverviewTab({ subject, tasks, notes }) {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Subject overview</h3>
        <span className="text-xs text-slate-400">Created {formatDate(subject.createdAt)}</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-xs text-slate-400">Total tasks</p>
          <p className="text-lg font-semibold">{subject.totalTasks}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Completed</p>
          <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{subject.completedTasks}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Notes</p>
          <p className="text-lg font-semibold">{subject.notesCount}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Study hours</p>
          <p className="text-lg font-semibold">{subject.studyHours ?? 0}</p>
        </div>
      </div>
      {notes.length > 0 && (
        <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Latest notes</p>
          <div className="space-y-1.5">
            {notes.slice(0, 4).map((n) => (
              <Link key={n._id} to={`/notes/${n._id}`} className="block text-sm text-slate-700 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400 truncate">
                • {n.title}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SessionsTab({ subjectId }) {
  const { data, loading } = useFetch(() => subjectApi.get(subjectId));
  const navigate = useNavigate();
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Study time</h3>
        <Link to="/sessions" className="text-xs font-medium text-brand-600 dark:text-brand-400">Start a session</Link>
      </div>
      {loading ? <Spinner /> : (
        <EmptyState
          icon={Clock}
          title="Track your time here"
          description="Study time for this subject will be aggregated from your study sessions."
          actionLabel="Go to study sessions"
          onAction={() => navigate('/sessions')}
        />
      )}
    </div>
  );
}

function QuizTab({ subjectId }) {
  const navigate = useNavigate();
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Quiz performance</h3>
        <Link to={`/quizzes?source=subject&id=${subjectId}`} className="btn-secondary btn sm:btn"><Sparkles className="h-4 w-4" /> Generate quiz</Link>
      </div>
      <EmptyState
        icon={GraduationCap}
        title="No quiz attempts yet"
        description="Generate a quiz from this subject's notes, then track your accuracy here."
        actionLabel="Generate quiz"
        onAction={() => navigate(`/quizzes?source=subject&id=${subjectId}`)}
      />
    </div>
  );
}

const EDIT_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6'];

function EditSubjectModal({ open, onClose, subject, onSaved }) {
  const { toast } = useToast();
  const { register, handleSubmit, reset } = useForm();
  const [color, setColor] = useState(subject?.color || '#6366f1');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !subject) return;
    reset({
      name: subject.name,
      description: subject.description || '',
      semester: subject.semester || ''
    });
    setColor(subject.color || '#6366f1');
  }, [open, subject, reset]);

  const onSubmit = async (values) => {
    setSaving(true);
    try {
      await subjectApi.update(subject._id, { ...values, color });
      toast.success('Subject updated');
      onSaved();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit subject">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input label="Name *" placeholder="e.g. Computer Networks" {...register('name', { required: 'Subject name is required' })} />
        <Textarea label="Description" placeholder="What is this subject about?" rows={3} {...register('description')} />
        <Input label="Semester / course" placeholder="e.g. Semester 4" {...register('semester')} />

        <div>
          <span className="label">Color</span>
          <div className="flex flex-wrap gap-2">
            {EDIT_COLORS.map((c) => (
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
          <Button type="submit" loading={saving}>Save changes</Button>
        </div>
      </form>
    </Modal>
  );
}