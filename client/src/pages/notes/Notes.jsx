import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { noteApi, subjectApi } from '../../services/api';
import { useFetch, useDebounce } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/LoadingSpinner';
import { Modal } from '../../components/ui/Modal';
import {
  StickyNote, Plus, Search, Star, StarOff, MoreVertical, Pencil,
  Trash2, Sparkles, BookOpen, Paperclip
} from 'lucide-react';
import { Dropdown, DropdownItem } from '../../components/ui/Dropdown';
import { timeAgo, excerpt, wordCount } from '../../utils/format';

export default function Notes() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [subject, setSubject] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: subjectsData } = useFetch(() => subjectApi.list());
  const subjects = subjectsData?.subjects || [];

  const params = {};
  if (debouncedQuery) params.search = debouncedQuery;
  if (subject) params.subject = subject;
  if (favoritesOnly) params.favorite = 'true';

  const { data, loading, error, refetch } = useFetch(() => noteApi.list(params), [debouncedQuery, subject, favoritesOnly]);
  const notes = data?.notes || [];

  const handleToggleFavorite = async (id) => {
    try {
      await noteApi.toggleFavorite(id);
      refetch();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleDelete = async () => {
    try {
      await noteApi.remove(deleteTarget._id);
      toast.success('Note deleted');
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
          <h1 className="text-xl font-bold tracking-tight">Notes</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Capture ideas and turn them into understanding.</p>
        </div>
        <Button onClick={() => navigate(`/notes/new${subject ? `?subject=${subject}` : ''}`)}>
          <Plus className="h-4 w-4" /> New note
        </Button>
      </div>

      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input className="input pl-9" placeholder="Search notes…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select className="sm:w-48" value={subject} onChange={(e) => setSubject(e.target.value)}>
          <option value="">All subjects</option>
          {subjects.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
        </Select>
        <button
          onClick={() => setFavoritesOnly(!favoritesOnly)}
          className={`btn ${favoritesOnly ? 'btn-primary' : 'btn-secondary'} sm:w-auto`}
        >
          <Star className={`h-4 w-4 ${favoritesOnly ? 'fill-current' : ''}`} /> Favorites
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        <EmptyState icon={StickyNote} title="Couldn't load notes" description={error} actionLabel="Retry" onAction={refetch} />
      ) : notes.length === 0 ? (
        <EmptyState
          icon={StickyNote}
          title={debouncedQuery || subject || favoritesOnly ? 'No matching notes' : 'No notes yet'}
          description="Create your first note to start studying. Notes can be summarized and turned into quizzes with AI."
          actionLabel="Create a note"
          onAction={() => navigate('/notes/new')}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map((n) => (
            <div key={n._id} className="card p-4 hover:shadow-cardHover transition-shadow group relative">
              <div className="flex items-start justify-between gap-2">
                <button
                  onClick={() => handleToggleFavorite(n._id)}
                  className="shrink-0 p-0.5 text-slate-300 hover:text-amber-400 dark:text-slate-600"
                  aria-label={n.favorite ? 'Unfavorite note' : 'Favorite note'}
                >
                  {n.favorite ? <Star className="h-4 w-4 text-amber-400 fill-amber-400" /> : <StarOff className="h-4 w-4" />}
                </button>
                <Dropdown
                  trigger={<span className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm text-xs font-medium transition-colors" role="button" aria-label="Note options"><MoreVertical className="h-3.5 w-3.5" /></span>}
                >
                  <DropdownItem icon={Pencil} onClick={() => navigate(`/notes/${n._id}`)}>Edit</DropdownItem>
                  <DropdownItem icon={Sparkles} onClick={() => navigate(`/notes/${n._id}?summarize=1`)}>Summarize</DropdownItem>
                  <DropdownItem icon={Trash2} danger onClick={() => setDeleteTarget(n)}>Delete</DropdownItem>
                </Dropdown>
              </div>

              <Link to={`/notes/${n._id}`} className="block mt-1">
                <div className="flex items-center gap-2 mb-1.5">
                  {n.subject && (
                    <span className="flex items-center gap-1 text-xs" style={{ color: n.subject.color }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: n.subject.color }} />
                      {n.subject.name}
                    </span>
                  )}
                  {n.summary && <span className="badge text-[10px] bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400 mr-auto"><Sparkles className="h-2.5 w-2.5" /> summarized</span>}
                </div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{n.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-3">{excerpt(n.content, 130)}</p>
              </Link>

              <div className="mt-3 flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
                <span className="flex items-center gap-2">
                  {n.attachments?.length > 0 && (
                    <span className="flex items-center gap-0.5" title={`${n.attachments.length} attachment(s)`}>
                      <Paperclip className="h-3 w-3" /> {n.attachments.length}
                    </span>
                  )}
                  <span>{wordCount(n.content)} words</span>
                </span>
                <span>{timeAgo(n.updatedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete note?" size="sm">
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