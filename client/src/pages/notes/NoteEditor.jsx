import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { noteApi, subjectApi, aiApi } from '../../services/api';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/LoadingSpinner';
import { Modal } from '../../components/ui/Modal';
import {
  ArrowLeft, Save, Sparkles, Bold, Italic, Heading2, List, ListOrdered,
  Code, Eye, PencilLine, Star, StarOff, Trash2, MessageSquarePlus, X, Check,
  Paperclip, FileText, Image as ImageIcon, Download, Loader2
} from 'lucide-react';
import MermaidDiagram from '../../components/ui/MermaidDiagram';
import { wordCount, charCount, timeAgo } from '../../utils/format';

const SAVE_DELAY = 1500;

export default function NoteEditor() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isNew = !id;
  const defaultSubject = searchParams.get('subject') || '';

  const [note, setNote] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [subject, setSubject] = useState(defaultSubject);
  const [favorite, setFavorite] = useState(false);
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [mode, setMode] = useState('write'); // write | preview
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);

  const { data: subjectsData } = useFetch(() => subjectApi.list());
  const subjects = subjectsData?.subjects || [];

  // Check for summarize param
  const shouldSummarize = useRef(searchParams.get('summarize') === '1');

  // Load note
  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    setLoading(true);
    noteApi.get(id).then((res) => {
      if (cancelled) return;
      const n = res.data.note;
      setNote(n);
      setTitle(n.title);
      setContent(n.content || '');
      setSubject(n.subject?._id || '');
      setFavorite(n.favorite);
      setTags((n.tags || []).join(', '));
      setAttachments(n.attachments || []);
      setLastSaved(n.updatedAt);
      setLoading(false);
      if (shouldSummarize.current) openSummary(n.content);
    }).catch((e) => {
      if (!cancelled) { toast.error(e.message); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [id]);

  // Autosave
  // Note: we deliberately do NOT mirror `isNew` into saveRef on every render —
  // `isNew` never changes for a new note (no id), so it would overwrite the
  // "already created" flag and cause a new note on every save.
  const saveTimer = useRef(null);
  const saveRef = useRef(null);
  const isSaving = useRef(false);
  saveRef.current = { note, title, content, subject, favorite, tags };

  const doSave = useCallback(async (silent = true) => {
    if (isSaving.current) return; // guard against concurrent saves (autosave + summarize)
    isSaving.current = true;
    const s = saveRef.current;
    const payload = {
      title: s.title.trim() || 'Untitled note',
      content: s.content,
      subject: s.subject || null,
      favorite: s.favorite,
      tags: s.tags.split(',').map((t) => t.trim()).filter(Boolean)
    };
    setSaving(true);
    try {
      if (!s.note) {
        const res = await noteApi.create(payload);
        setNote(res.data.note);
        saveRef.current.note = res.data.note;
        saveRef.current.isNew = false;
        setLastSaved(res.data.note.updatedAt);
        if (!silent) toast.success('Note created');
        // Update URL silently if it was a new note
        if (!window.location.pathname.includes(res.data.note._id)) {
          window.history.replaceState(null, '', `/notes/${res.data.note._id}`);
        }
      } else {
        const res = await noteApi.update(s.note._id, payload);
        setNote(res.data.note);
        saveRef.current.note = res.data.note;
        setLastSaved(res.data.note.updatedAt);
        if (!silent) toast.success('Note saved');
      }
      setDirty(false);
    } catch (e) {
      if (!silent) toast.error(e.message);
    } finally {
      setSaving(false);
      isSaving.current = false;
    }
  }, []);

  // Trigger save on changes
  useEffect(() => {
    if (isNew && !content && !title) return;
    setDirty(true);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSave(true), SAVE_DELAY);
    return () => clearTimeout(saveTimer.current);
  }, [title, content, subject, favorite, tags]);

  // ---- AI Summary ----
  const [summary, setSummary] = useState(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState(null);

  useEffect(() => {
    if (note?.summary && !summary) {
      setSummary(note.summary);
    }
  }, [note]);

  const openSummary = async (text) => {
    setSummaryOpen(true);
    window.scrollTo(0, 0);
    if (summary) return; // already have it
    await summarizeNow(text);
  };

  const summarizeNow = async (text = content) => {
    if (!text || text.trim().length < 10) {
      setSummaryError('This note is too short to summarize. Add more content first.');
      return;
    }
    setSummarizing(true);
    setSummaryError(null);
    try {
      // Ensure note is saved first
      if (isNew || !note) {
        await doSave(true);
      }
      const res = await aiApi.summarize({ noteId: saveRef.current.note._id });
      setSummary(res.data.summary);
      setNote((prev) => ({ ...prev, summary: res.data.summary }));
      toast.success('Summary generated');
    } catch (e) {
      setSummaryError(e.message);
    } finally {
      setSummarizing(false);
    }
  };

  // ---- Ask AI ----
  const [askOpen, setAskOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);

  const askAI = async () => {
    if (!question.trim()) return;
    setAsking(true);
    setAnswer('');
    try {
      if (isNew || !note) await doSave(true);
      const res = await aiApi.explain({ question, context: { noteId: saveRef.current.note._id } });
      setAnswer(res.data.response);
    } catch (e) {
      setAnswer(`⚠️ ${e.message}`);
    } finally {
      setAsking(false);
    }
  };

  // ---- Attachments (images, PDFs, diagrams) ----
  const fileInputRef = useRef(null);
  const MAX_FILE = 8 * 1024 * 1024; // 8 MB

  const handleFilesSelected = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // allow re-selecting the same file
    if (!files.length) return;

    for (const file of files) {
      if (file.size > MAX_FILE) {
        toast.error(`"${file.name}" is too large (max 8 MB)`);
        continue;
      }
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (!isImage && !isPdf) {
        toast.error(`"${file.name}" is not supported. Upload images or PDFs.`);
        continue;
      }
      try {
        setUploading(true);
        // Make sure the note exists before attaching
        if (isNew || !saveRef.current.note) await doSave(true);
        const base64 = await readAsBase64(file);
        const res = await noteApi.addAttachment(saveRef.current.note._id, {
          name: file.name,
          type: file.type || (isPdf ? 'application/pdf' : 'application/octet-stream'),
          size: file.size,
          data: base64
        });
        setAttachments((prev) => [...prev, res.data.attachment]);
        toast.success(`Attached ${file.name}`);
      } catch (err) {
        toast.error(err.message);
      } finally {
        setUploading(false);
      }
    }
  };

  const readAsBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });

  const handleRemoveAttachment = async (attachId, name) => {
    try {
      await noteApi.removeAttachment(saveRef.current.note._id, attachId);
      setAttachments((prev) => prev.filter((a) => a._id !== attachId));
      toast.success(`Removed ${name}`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const attachmentUrl = (a) => `data:${a.type || 'application/octet-stream'};base64,${a.data}`;

  // Insert markdown at cursor
  const insertAtCursor = (before, after = '') => {
    const ta = contentRef.current;
    if (!ta) return;
    const { selectionStart, selectionEnd } = ta;
    const selected = content.slice(selectionStart, selectionEnd);
    const replacement = `${before}${selected}${after}`;
    const newContent = content.slice(0, selectionStart) + replacement + content.slice(selectionEnd);
    setContent(newContent);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(selectionStart + before.length, selectionStart + before.length + selected.length);
    });
  };

  const contentRef = useRef(null);

  const toolbar = [
    { icon: Bold, action: () => insertAtCursor('**', '**'), label: 'Bold' },
    { icon: Italic, action: () => insertAtCursor('_', '_'), label: 'Italic' },
    { icon: Heading2, action: () => insertAtCursor('## ', ''), label: 'Heading' },
    { icon: List, action: () => insertAtCursor('\n- ', ''), label: 'Bullet list' },
    { icon: ListOrdered, action: () => insertAtCursor('\n1. ', ''), label: 'Numbered list' },
    { icon: Code, action: () => insertAtCursor('`', '`'), label: 'Code' }
  ];

  if (loading) return <Spinner size="lg" />;

  return (
    <div className="space-y-4 animate-slide-up">
      {/* AI Summary panel */}
      {summaryOpen && (
        <div className="rounded-xl border border-brand-200 dark:border-brand-900 bg-gradient-to-br from-brand-50 to-white dark:from-brand-950/50 dark:to-slate-900 p-5 animate-slide-up">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand-600 dark:text-brand-400" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">AI summary</h2>
              {summarizing && <span className="text-xs text-brand-600 animate-pulse">Generating…</span>}
            </div>
            <button onClick={() => setSummaryOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" aria-label="Close summary">
              <X className="h-4 w-4" />
            </button>
          </div>
          {summaryError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{summaryError}</p>
          ) : summary ? (
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Overview</p>
                <p className="text-slate-700 dark:text-slate-300">{summary.overview}</p>
              </div>
              {summary.keyConcepts?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Key concepts</p>
                  <div className="flex flex-wrap gap-1.5">
                    {summary.keyConcepts.map((c) => (
                      <span key={c} className="badge bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">{c}</span>
                    ))}
                  </div>
                </div>
              )}
              {summary.importantPoints?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Important points</p>
                  <ul className="list-disc pl-5 space-y-1 text-slate-700 dark:text-slate-300">
                    {summary.importantPoints.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </div>
              )}
              {summary.definitions?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Definitions</p>
                  <dl className="space-y-1">
                    {summary.definitions.map((d, i) => (
                      <div key={i} className="flex gap-2">
                        <dt className="font-medium text-slate-800 dark:text-slate-200 shrink-0">{d.term}:</dt>
                        <dd className="text-slate-600 dark:text-slate-400">{d.definition}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
              {summary.takeaways?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Takeaways</p>
                  <ul className="list-disc pl-5 space-y-1 text-slate-700 dark:text-slate-300">
                    {summary.takeaways.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                </div>
              )}
              {summary.diagram && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Diagram</p>
                  <MermaidDiagram code={summary.diagram} />
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="secondary" onClick={() => navigate(`/quizzes?source=note&id=${note?._id || saveRef.current.note?._id}`)}>
                  <Sparkles className="h-3.5 w-3.5" /> Quiz from this note
                </Button>
                <Button size="sm" variant="ghost" onClick={() => summarizeNow()} disabled={summarizing}>
                  Regenerate
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">No summary yet.</p>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link to="/notes" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">
          <ArrowLeft className="h-4 w-4" /> Notes
        </Link>
        <div className="flex items-center gap-2">
          {lastSaved && <span className="text-xs text-slate-400 hidden sm:inline">Saved {saving ? '…' : timeAgo(lastSaved)}</span>}
          {dirty && <span className="text-xs text-slate-400">Unsaved</span>}
          <input ref={fileInputRef} type="file" accept="application/pdf,image/*" multiple className="hidden" onChange={handleFilesSelected} />
          <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()} loading={uploading} aria-label="Attach images or PDFs">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />} Attach
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setAskOpen(true)} aria-label="Ask AI about this note">
            <MessageSquarePlus className="h-4 w-4" /> Ask AI
          </Button>
          <Button size="sm" onClick={() => summarizeNow()}>
            <Sparkles className="h-4 w-4" /> Summarize
          </Button>
          <Button size="sm" variant="secondary" onClick={() => doSave(false)} disabled={!dirty}>
            <Save className="h-4 w-4" /> Save
          </Button>
        </div>
      </div>

      {/* Attachments strip */}
      {attachments.length > 0 && (
        <div className="card p-4 flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <Paperclip className="h-3.5 w-3.5" /> Attachments
          </span>
          {attachments.map((a) => (
            <div key={a._id} className="group relative flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5">
              {a.type?.startsWith('image/') ? (
                <a href={attachmentUrl(a)} target="_blank" rel="noreferrer" title={`Open ${a.name}`} className="flex items-center gap-2">
                  <img src={attachmentUrl(a)} alt={a.name} className="h-9 w-9 rounded object-cover" />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-200 max-w-[120px] truncate">{a.name}</span>
                </a>
              ) : (
                <a href={attachmentUrl(a)} download={a.name} title={`Download ${a.name}`} className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-red-500 shrink-0" />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-200 max-w-[120px] truncate">{a.name}</span>
                </a>
              )}
              <a href={attachmentUrl(a)} download={a.name} aria-label={`Download ${a.name}`} className="text-slate-300 hover:text-brand-500 dark:text-slate-500">
                <Download className="h-3.5 w-3.5" />
              </a>
              <button
                onClick={() => handleRemoveAttachment(a._id, a.name)}
                aria-label={`Remove ${a.name}`}
                className="text-slate-300 hover:text-red-500 dark:text-slate-500"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Editor card */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title"
            className="text-lg font-semibold bg-transparent border-none outline-none flex-1 placeholder:text-slate-300 dark:placeholder:text-slate-700 text-slate-900 dark:text-slate-100"
          />
          <button onClick={() => setFavorite(!favorite)} className="text-slate-300 hover:text-amber-400 dark:text-slate-600" aria-label="Toggle favorite">
            {favorite ? <Star className="h-5 w-5 text-amber-400 fill-amber-400" /> : <StarOff className="h-5 w-5" />}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-slate-100 dark:border-slate-800">
          <Select className="w-44" value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">No subject</option>
            {subjects.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
          </Select>
          <Input
            className="flex-1 min-w-[160px]"
            placeholder="Tags: exam, chapter-4… (comma separated)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
            <button
              onClick={() => setMode('write')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${mode === 'write' ? 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100' : 'text-slate-400'}`}
            >
              <PencilLine className="h-3.5 w-3.5" /> Write
            </button>
            <button
              onClick={() => setMode('preview')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${mode === 'preview' ? 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100' : 'text-slate-400'}`}
            >
              <Eye className="h-3.5 w-3.5" /> Preview
            </button>
          </div>
        </div>

        {mode === 'write' ? (
          <div>
            <div className="flex items-center gap-0.5 px-3 pt-2 border-b border-slate-100 dark:border-slate-800">
              {toolbar.map((t) => (
                <button
                  key={t.label}
                  onClick={t.action}
                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800"
                  aria-label={t.label}
                  title={t.label}
                >
                  <t.icon className="h-4 w-4" />
                </button>
              ))}
              <span className="ml-auto text-xs text-slate-400 px-2">{wordCount(content)} words · {charCount(content)} chars</span>
            </div>
            <textarea
              ref={contentRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your note in Markdown… Use **bold**, ## headings, - lists, `code`. # Stay focused"
              className="w-full min-h-[420px] p-5 bg-transparent outline-none resize-y text-sm leading-relaxed text-slate-800 dark:text-slate-200 placeholder:text-slate-300 dark:placeholder:text-slate-600 font-mono text-[13px]"
              spellCheck="false"
            />
          </div>
        ) : (
          <div className="p-5 min-h-[420px] markdown-body">
            {content ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown> : <p className="text-slate-400">Nothing to preview yet.</p>}
          </div>
        )}

        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            {dirty ? <><span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Unsaved changes</> : <><Check className="h-3.5 w-3.5 text-emerald-500" /> Saved</>}
          </span>
          <span>Supports Markdown</span>
        </div>
      </div>

      {/* Ask AI modal */}
      <Modal open={askOpen} onClose={() => setAskOpen(false)} title="Ask AI about this note">
        <div className="space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            The AI will read this note to answer your question.
          </p>
          <textarea
            className="input min-h-[90px]"
            placeholder="e.g. Explain the second concept in this note"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <Button onClick={askAI} loading={asking} disabled={!question.trim()} className="w-full">
            <MessageSquarePlus className="h-4 w-4" /> Ask
          </Button>
          {answer && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4 markdown-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
              <div className="mt-3"><Button size="sm" variant="secondary" onClick={() => navigate('/assistant')}>Open in Assistant</Button></div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}