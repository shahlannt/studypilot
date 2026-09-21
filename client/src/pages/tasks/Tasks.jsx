import { useState, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { taskApi, subjectApi } from '../../services/api';
import { useFetch, useDebounce } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Dropdown, DropdownItem } from '../../components/ui/Dropdown';
import { Select } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/LoadingSpinner';
import { priorityBadge, statusBadge } from '../../components/ui/Badge';
import {
  Plus, Search, Filter, CheckCircle2, Circle, ListTodo, ClipboardList,
  ChevronDown, MoreVertical, Pencil, Trash2, CalendarDays, Clock, Tag
} from 'lucide-react';
import { formatRelative, formatDate, isOverdue, isToday } from '../../utils/format';
import TaskModal from './TaskModal';

const columns = [
  { key: 'todo', label: 'To do' },
  { key: 'in-progress', label: 'In progress' },
  { key: 'completed', label: 'Completed' }
];

export default function Tasks() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [filters, setFilters] = useState({
    status: searchParams.get('status') === 'active' ? '' : (searchParams.get('status') || ''),
    priority: '',
    subject: searchParams.get('subject') || '',
    sort: 'newest'
  });
  const [modalOpen, setModalOpen] = useState(searchParams.get('new') === '1');
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: subjectsData } = useFetch(() => subjectApi.list());
  const subjects = subjectsData?.subjects || [];

  // Build params for task API
  const buildParams = useCallback(() => {
    const p = {};
    if (debouncedQuery) p.search = debouncedQuery;
    if (filters.status) p.status = filters.status;
    if (filters.priority) p.priority = filters.priority;
    if (filters.subject) p.subject = filters.subject;
    if (filters.sort) p.sort = filters.sort;
    return p;
  }, [debouncedQuery, filters]);

  const { data, loading, error, refetch } = useFetch(() => taskApi.list(buildParams()), [JSON.stringify(buildParams())]);

  const tasks = data?.tasks || [];
  const grouped = {
    todo: tasks.filter((t) => t.status === 'todo'),
    'in-progress': tasks.filter((t) => t.status === 'in-progress'),
    completed: tasks.filter((t) => t.status === 'completed')
  };

  const handleToggle = async (id) => {
    try {
      await taskApi.toggle(id);
      refetch();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleDelete = async () => {
    try {
      await taskApi.remove(deleteTarget._id);
      toast.success('Task deleted');
      setDeleteTarget(null);
      refetch();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-5 animate-slide-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Tasks</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Plan assignments and stay on top of deadlines.</p>
        </div>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
          <Plus className="h-4 w-4" /> New task
        </Button>
      </div>

      {/* Search + filters */}
      <div className="card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Search tasks by title, description, or tag…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="w-auto">
              <option value="">All statuses</option>
              <option value="todo">To do</option>
              <option value="in-progress">In progress</option>
              <option value="completed">Completed</option>
            </Select>
            <Select value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })} className="w-auto">
              <option value="">All priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </Select>
            <Select value={filters.subject} onChange={(e) => setFilters({ ...filters, subject: e.target.value })} className="w-auto">
              <option value="">All subjects</option>
              {subjects.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </Select>
            <Select value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })} className="w-auto">
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="dueDate">Due date</option>
              <option value="priority">Priority</option>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Filter className="h-3.5 w-3.5" />
          {tasks.length} task{tasks.length !== 1 ? 's' : ''} shown
          {(debouncedQuery || filters.status || filters.priority || filters.subject) && (
            <button
              onClick={() => { setQuery(''); setFilters({ status: '', priority: '', subject: '', sort: 'newest' }); }}
              className="text-brand-600 hover:text-brand-700 dark:text-brand-400 font-medium"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <EmptyState icon={ClipboardList} title="Couldn't load tasks" description={error} actionLabel="Retry" onAction={refetch} />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No tasks yet"
          description="Add a task like 'Finish TCP/IP notes' and set a priority and deadline."
          actionLabel="Create your first task"
          onAction={() => { setEditing(null); setModalOpen(true); }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
          {columns.map((col) => {
            const isCompleted = col.key === 'completed';
            return (
              <div key={col.key}>
                <div className="flex items-center justify-between px-1 mb-2">
                  <span className={`flex items-center gap-1.5 text-sm font-semibold ${isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'}`}>
                    {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                    {col.label}
                  </span>
                  <span className="text-xs text-slate-400">{grouped[col.key].length}</span>
                </div>
                <div className={`space-y-3 ${isCompleted ? '' : 'min-h-[120px]'}`}>
                  {grouped[col.key].map((t) => (
                    <TaskCard
                      key={t._id}
                      task={t}
                      onToggle={() => handleToggle(t._id)}
                      onEdit={() => { setEditing(t); setModalOpen(true); }}
                      onDelete={() => setDeleteTarget(t)}
                    />
                  ))}
                  {grouped[col.key].length === 0 && (
                    <div className="rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700 py-6 text-center text-xs text-slate-400">
                      {isCompleted ? 'Nothing completed yet' : 'No tasks'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TaskModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); if (searchParams.get('new')) setSearchParams({}); }}
        editing={editing}
        subjects={subjects}
        defaultSubject={searchParams.get('subject') || ''}
        onSaved={() => { setModalOpen(false); refetch(); }}
      />

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete task?" size="sm">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Delete "<span className="font-medium">{deleteTarget?.title}</span>"? This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}

function TaskCard({ task, onToggle, onEdit, onDelete }) {
  const pb = priorityBadge(task.priority);
  const sb = statusBadge(task.status);
  const overdue = isOverdue(task.dueDate) && task.status !== 'completed';
  const hasSubject = !!task.subject;

  return (
    <div className={`card p-4 ${task.status === 'completed' ? 'opacity-70' : ''}`}>
      <div className="flex items-start gap-2.5">
        <button onClick={onToggle} className="mt-0.5 shrink-0 text-slate-300 dark:text-slate-600 hover:text-brand-500" aria-label="Toggle task completion">
          {task.status === 'completed' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-500 fill-emerald-500" />
          ) : (
            <Circle className="h-5 w-5 hover:border-brand-500" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <Link
            to={`/tasks/${task._id}`}
            className={`text-sm font-medium hover:text-brand-600 dark:hover:text-brand-400 ${task.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-200'}`}
          >
            {task.title}
          </Link>
          {task.description && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{task.description}</p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
            <span className={`badge ${pb.color === 'red' ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' : pb.color === 'amber' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
              {pb.label}
            </span>
            {hasSubject && (
              <span className="flex items-center gap-1" style={{ color: task.subject.color }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: task.subject.color }} />
                {task.subject.name}
              </span>
            )}
            {task.dueDate && (
              <span className={`flex items-center gap-1 ${overdue ? 'text-red-500 font-medium' : isToday(task.dueDate) ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                <CalendarDays className="h-3 w-3" />
                {formatRelative(task.dueDate)}
              </span>
            )}
          </div>
          {task.tags?.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {task.tags.map((tag) => (
                <span key={tag} className="badge text-[10px] bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400">#{tag}</span>
              ))}
            </div>
          )}
        </div>
        <Dropdown
          trigger={<span className="text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" role="button" aria-label="Task options"><MoreVertical className="h-4 w-4" /></span>}
        >
          <DropdownItem icon={Pencil} onClick={onEdit}>Edit</DropdownItem>
          <DropdownItem icon={Trash2} danger onClick={onDelete}>Delete</DropdownItem>
        </Dropdown>
      </div>
    </div>
  );
}

