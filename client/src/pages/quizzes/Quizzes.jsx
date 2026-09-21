import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { quizApi, noteApi, subjectApi, aiApi } from '../../services/api';
import { useFetch } from '../../hooks/useFetch';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import {
  GraduationCap, Sparkles, CheckCircle2, XCircle, RotateCcw, Trophy,
  Target, TrendingUp, ArrowRight, Play, Settings2
} from 'lucide-react';
import { formatDate } from '../../utils/format';

// ---- Main page ----
export default function Quizzes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('take') ? 'take' : 'history');
  const [generateOpen, setGenerateOpen] = useState(searchParams.get('source') ? true : false);
  const [takeQuiz, setTakeQuiz] = useState(null);

  // Listen for freshly generated quizzes to open in the player
  useEffect(() => {
    window.openTakeQuiz = (quiz) => {
      setTab('take');
      setTakeQuiz({ ...quiz, _fresh: true });
      window.scrollTo(0, 0);
    };
    return () => { delete window.openTakeQuiz; };
  }, []);

  return (
    <div className="space-y-5 animate-slide-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Quiz Center</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Turn your notes into practice questions and track your accuracy.</p>
        </div>
        <Button onClick={() => setGenerateOpen(true)}>
          <Sparkles className="h-4 w-4" /> Generate quiz
        </Button>
      </div>

      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setTab('history')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'history' ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}`}
        >
          Quiz history
        </button>
        <button
          onClick={() => setTab('take')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'take' ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}`}
        >
          Saved quizzes
        </button>
      </div>

      {tab === 'history' ? <QuizHistory onGenerate={() => setGenerateOpen(true)} /> : <SavedQuizzes onTake={setTakeQuiz} />}

      <GenerateModal open={generateOpen} onClose={() => { setGenerateOpen(false); setSearchParams({}); }} />
      {takeQuiz && <QuizPlayer quiz={takeQuiz} onClose={() => setTakeQuiz(null)} />}
    </div>
  );
}

// ---- History ----
function QuizHistory({ onGenerate }) {
  const { data, loading, error, refetch } = useFetch(() => quizApi.attempts());
  const attempts = data?.attempts || [];

  const avg = attempts.length ? Math.round(attempts.reduce((s, a) => s + a.percentage, 0) / attempts.length) : 0;
  const best = attempts.length ? Math.max(...attempts.map((a) => a.percentage)) : 0;
  const [expand, setExpand] = useState(null);

  if (loading) return <Spinner />;
  if (error) return <EmptyState icon={GraduationCap} title="Couldn't load attempts" description={error} actionLabel="Retry" onAction={refetch} />;

  return (
    <div className="space-y-4">
      {attempts.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Summary icon={Target} label="Average" value={`${avg}%`} color="text-brand-600 dark:text-brand-400" />
          <Summary icon={TrendingUp} label="Best score" value={`${best}%`} color="text-emerald-600 dark:text-emerald-400" />
          <Summary icon={GraduationCap} label="Taken" value={attempts.length} color="text-purple-600 dark:text-purple-400" />
        </div>
      )}

      {attempts.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No quiz attempts yet"
          description="Generate a quiz from a note or subject, take it, and your results (including weak topics) will appear here."
          actionLabel="Generate a quiz"
          onAction={onGenerate}
        />
      ) : (
        <div className="card divide-y divide-slate-100 dark:divide-slate-800">
          {attempts.map((a) => (
            <div key={a._id}>
              <div className="flex items-center gap-4 px-4 py-3.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50" onClick={() => setExpand(expand === a._id ? null : a._id)}>
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${a.percentage >= 70 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400' : a.percentage >= 40 ? 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400' : 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400'}`}>
                  {a.percentage}%
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                    {a.quiz?.title || 'Quiz'}
                    {a.subject && <span className="text-xs text-slate-400 font-normal"> · {a.subject.name}</span>}
                  </p>
                  <p className="text-xs text-slate-400">{a.score} of {a.total} correct · {formatDate(a.createdAt)}</p>
                </div>
                {a.weakTopics?.length > 0 && (
                  <span className="hidden sm:inline-flex badge bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400">{a.weakTopics.length} weak topic{a.weakTopics.length !== 1 ? 's' : ''}</span>
                )}
                <ArrowRight className={`h-4 w-4 text-slate-300 transition-transform ${expand === a._id ? 'rotate-90' : ''}`} />
              </div>
              {expand === a._id && (
                <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-800 pt-3">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wide">Weak topics</p>
                  {a.weakTopics?.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {a.weakTopics.map((t) => <span key={t} className="badge bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400">{t}</span>)}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400">No weak topics — great job!</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Summary({ icon: Icon, label, value, color }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <Icon className={`h-5 w-5 ${color}`} />
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{value}</p>
      </div>
    </div>
  );
}

// ---- Saved quizzes ----
function SavedQuizzes({ onTake }) {
  const { data, loading } = useFetch(() => quizApi.list());
  const quizzes = data?.quizzes || [];

  if (loading) return <Spinner />;

  return (
    <div>
      {quizzes.length === 0 ? (
        <EmptyState icon={Settings2} title="No saved quizzes" description="Generated quizzes you take get saved here for review." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quizzes.map((q) => (
            <div key={q._id} className="card p-4 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="badge bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">{q.difficulty}</span>
                <span className="text-xs text-slate-400">{q.questions.length} questions</span>
              </div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">{q.title}</h3>
              <p className="text-xs text-slate-400 mb-3">
                {q.source?.noteId ? `From note: ${q.source.noteId.title}` : q.source?.subjectId ? `From subject: ${q.source.subjectId.name}` : 'General'}
              </p>
              <Button size="sm" className="mt-auto" onClick={() => onTake(q)}>
                <Play className="h-3.5 w-3.5" /> Take quiz
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Generate modal ----
function GenerateModal({ open, onClose }) {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [sourceType, setSourceType] = useState(searchParams.get('source') === 'note' ? 'note' : searchParams.get('source') === 'subject' ? 'subject' : 'note');
  const preSelectedId = searchParams.get('id') || '';
  const [sourceId, setSourceId] = useState(preSelectedId);
  const [numQuestions, setNumQuestions] = useState(5);
  const [difficulty, setDifficulty] = useState('medium');
  const [questionType, setQuestionType] = useState('mixed');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const { data: notesData } = useFetch(() => noteApi.list({ limit: 100 }));
  const { data: subjectsData } = useFetch(() => subjectApi.list());
  const notes = notesData?.notes || [];
  const subjects = subjectsData?.subjects || [];

  // Open state re-sync
  useEffect(() => {
    if (open) {
      setSourceType(searchParams.get('source') === 'subject' ? 'subject' : 'note');
      setSourceId(preSelectedId);
      setError(null);
    }
  }, [open]);

  const handleGenerate = async () => {
    if (!sourceId) { setError('Please select a note or subject'); return; }
    setGenerating(true);
    setError(null);
    try {
      const res = await aiApi.generateQuiz({ sourceType, sourceId, numQuestions, difficulty, questionType });
      const quiz = res.data.quiz;
      if (!quiz.questions?.length) {
        setError('AI returned no questions. Try again.');
        setGenerating(false);
        return;
      }
      // Optionally save the quiz
      try {
        await quizApi.create({ ...quiz, difficulty, questionType });
      } catch (e) { /* saving optional */ }
      onClose();
      // Navigate to take mode with the fresh quiz in state via custom event
      window.openTakeQuiz && window.openTakeQuiz(quiz);
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Generate a quiz" size="md">
      <div className="space-y-4">
        <div>
          <span className="label">Source</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => { setSourceType('note'); setSourceId(''); }}
              className={`rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${sourceType === 'note' ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
            >
              📄 From a note
            </button>
            <button
              onClick={() => { setSourceType('subject'); setSourceId(''); }}
              className={`rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${sourceType === 'subject' ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
            >
              📚 From a subject
            </button>
          </div>
        </div>

        <Select label={sourceType === 'note' ? 'Note' : 'Subject'} value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
          <option value="">Select {sourceType}…</option>
          {sourceType === 'note'
            ? notes.map((n) => <option key={n._id} value={n._id}>{n.title}</option>)
            : subjects.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
        </Select>

        <div className="grid grid-cols-2 gap-3">
          <Select label="Questions" value={numQuestions} onChange={(e) => setNumQuestions(Number(e.target.value))}>
            {[3, 5, 8, 10].map((n) => <option key={n} value={n}>{n} questions</option>)}
          </Select>
          <Select label="Difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </Select>
        </div>

        <Select label="Question type" value={questionType} onChange={(e) => setQuestionType(e.target.value)}>
          <option value="mixed">Mixed</option>
          <option value="multiple-choice">Multiple choice</option>
          <option value="true-false">True / False</option>
          <option value="short-answer">Short answer</option>
        </Select>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <Button className="w-full" onClick={handleGenerate} loading={generating}>
          <Sparkles className="h-4 w-4" /> {generating ? 'Generating questions…' : 'Generate quiz'}
        </Button>
        <p className="text-xs text-slate-400 text-center">Uses your selected {sourceType}'s content only.</p>
      </div>
    </Modal>
  );
}

// ---- Quiz player ----
function QuizPlayer({ quiz, onClose }) {
  const [step, setStep] = useState('intro');
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  if (!quiz) return null;

  const questions = quiz.questions || [];

  const submit = async () => {
    let score = 0;
    const graded = questions.map((q, i) => {
      const userAnswer = answers[i] ?? '';
      const correct = String(userAnswer).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
      if (correct) score++;
      return { q, userAnswer, correct };
    });
    const percentage = Math.round((score / questions.length) * 100);
    const result = { score, total: questions.length, percentage, graded };
    setResults(result);

    // Save attempt
    setSaving(true);
    try {
      await quizApi.submitAttempt({
        quizId: quiz._id || null,
        subject: quiz.source?.subjectId || null,
        answers: graded.map((g) => g.userAnswer),
        questions: questions.map((q) => ({ ...q, topic: q.topic }))
      });
    } catch (e) {
      toast.error('Result saved locally — could not save attempt: ' + e.message);
    } finally {
      setSaving(false);
    }
    window.scrollTo(0, 0);
    setStep('results');
  };

  if (step === 'intro') {
    return (
      <Modal open onClose={onClose} title={quiz.title || 'Quiz'} size="lg">
        <div className="text-center py-4">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 dark:bg-brand-950">
            <GraduationCap className="h-7 w-7 text-brand-600 dark:text-brand-400" />
          </div>
          <h3 className="text-base font-semibold">{questions.length} questions</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {quiz.difficulty} difficulty · {quiz.questionType} type
          </p>
          <div className="mt-6">
            <Button size="lg" onClick={() => setStep('quiz')}>
              <Play className="h-4 w-4" /> Start quiz
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  if (step === 'quiz') {
    return (
      <Modal open onClose={onClose} title={quiz.title || 'Quiz'} size="lg">
        <div className="space-y-6 max-h-[65vh] overflow-y-auto pr-1">
          {questions.map((q, qi) => (
            <div key={qi} className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {qi + 1}
                </span>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{q.question}</p>
                {q.topic && <span className="badge text-[10px] bg-slate-100 text-slate-500 dark:bg-slate-800 ml-auto">{q.topic}</span>}
              </div>

              {q.type === 'multiple-choice' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {q.options.map((opt, oi) => {
                    const letter = String.fromCharCode(65 + oi);
                    const isSel = answers[qi] === letter;
                    return (
                      <button
                        key={oi}
                        onClick={() => setAnswers({ ...answers, [qi]: letter })}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm text-left transition-colors ${
                          isSel ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300' : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                        }`}
                      >
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-medium">{letter}</span>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}

              {q.type === 'true-false' && (
                <div className="flex gap-2">
                  {['True', 'False'].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setAnswers({ ...answers, [qi]: opt })}
                      className={`flex-1 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                        answers[qi] === opt ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300' : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {q.type === 'short-answer' && (
                <input
                  className="input"
                  placeholder="Type your answer…"
                  value={answers[qi] || ''}
                  onChange={(e) => setAnswers({ ...answers, [qi]: e.target.value })}
                />
              )}
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between">
          <p className="text-xs text-slate-400">{Object.keys(answers).length} of {questions.length} answered</p>
          <Button onClick={submit} disabled={saving}>
            <CheckCircle2 className="h-4 w-4" /> Submit
          </Button>
        </div>
      </Modal>
    );
  }

  // Results
  return (
    <Modal open onClose={onClose} title="Your results" size="lg">
      <div className="text-center py-6">
        <div className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full ${results.percentage >= 70 ? 'bg-emerald-50 dark:bg-emerald-950' : results.percentage >= 40 ? 'bg-amber-50 dark:bg-amber-950' : 'bg-red-50 dark:bg-red-950'}`}>
          <span className={`text-2xl font-bold ${results.percentage >= 70 ? 'text-emerald-600 dark:text-emerald-400' : results.percentage >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
            {results.percentage}%
          </span>
        </div>
        <h3 className="text-lg font-semibold">
          {results.percentage >= 70 ? <span className="flex items-center justify-center gap-2"><Trophy className="h-5 w-5 text-amber-500" /> Great job!</span>
            : results.percentage >= 40 ? 'Keep practicing' : 'Review and retry'}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {results.score} of {results.total} correct
        </p>
      </div>

      <div className="space-y-4 max-h-[45vh] overflow-y-auto pr-1">
        {results.graded.map((g, i) => (
          <div key={i} className={`rounded-lg border p-4 ${g.correct ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/30' : 'border-red-200 dark:border-red-900 bg-red-50/40 dark:bg-red-950/30'}`}>
            <div className="flex items-start gap-2">
              {g.correct ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />}
              <div className="text-sm">
                <p className="font-medium text-slate-800 dark:text-slate-200">{g.q.question}</p>
                <div className="mt-1.5 space-y-1 text-xs">
                  <p className={g.correct ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                    Your answer: <span className="font-medium">{g.userAnswer || '(blank)'}</span>
                  </p>
                  {!g.correct && (
                    <p className="text-emerald-700 dark:text-emerald-400">Correct: <span className="font-medium">{g.q.correctAnswer}</span></p>
                  )}
                  {g.q.explanation && (
                    <p className="text-slate-500 dark:text-slate-400 mt-1"><span className="font-medium">Why:</span> {g.q.explanation}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={() => { setStep('quiz'); setAnswers({}); setResults(null); }}>
          <RotateCcw className="h-4 w-4" /> Retry
        </Button>
        <Button onClick={onClose}>Done</Button>
      </div>
    </Modal>
  );
}