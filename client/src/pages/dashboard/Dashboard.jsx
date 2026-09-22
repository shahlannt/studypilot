import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useFetch } from '../../hooks/useFetch';
import { analyticsApi, aiApi } from '../../services/api';
import { DashboardSkeleton } from '../../components/ui/Skeleton';
import { StatCard } from '../../components/ui/StatCard';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { priorityBadge } from '../../components/ui/Badge';
import {
  CheckSquare, Clock, BookOpen, GraduationCap, Flame, ListTodo,
  Sparkles, ArrowRight, StickyNote, CalendarClock, Trophy, Circle
} from 'lucide-react';
import { greeting, firstName, formatRelative, isToday, isOverdue, timeAgo, excerpt, formatMinutes, formatDuration } from '../../utils/format';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useFetch(() => analyticsApi.dashboard());
  const [recommendations, setRecommendations] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [generating, setGenerating] = useState(false);

  const stats = data?.stats;
  const todayFocusData = data?.todayFocus || stats?.todayFocus || [];
  const upcomingDeadlinesData = data?.upcomingDeadlines || stats?.upcomingDeadlines || [];

  const loadRecommendations = useCallback(async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await aiApi.recommend();
      setRecommendations(res.data.recommendations);
    } catch (e) {
      setAiError(e.message);
    } finally {
      setAiLoading(false);
    }
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (error) {
    return (
      <EmptyState
        icon={ListTodo}
        title="Couldn't load your dashboard"
        description={error}
        actionLabel="Try again"
        onAction={refetch}
      />
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Greeting */}
      <div>
        <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {greeting(firstName(user?.name))}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {stats?.todayMinutes > 0
            ? `Already ${formatDuration(stats.todayMinutes)} of studying today — keep the momentum going.`
            : 'A fresh day to make progress. Here’s what needs your attention.'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard icon={CheckSquare} label="Completed" value={stats?.completedTasks ?? 0} color="green" onClick={() => navigate('/tasks?status=completed')} />
        <StatCard icon={ListTodo} label="Pending" value={stats?.pendingTasks ?? 0} color="amber" onClick={() => navigate('/tasks?status=active')} />
        <StatCard icon={Clock} label="Study hours" value={Math.round((stats?.totalMinutes ?? 0) / 6) / 10} sub="all time" color="indigo" onClick={() => navigate('/analytics')} />
        <StatCard icon={BookOpen} label="Subjects" value={stats?.subjectsCount ?? 0} color="blue" onClick={() => navigate('/subjects')} />
        <StatCard icon={GraduationCap} label="Quiz accuracy" value={stats?.quizAvg ? `${stats.quizAvg}%` : '—'} sub={`${stats?.quizAttempts ?? 0} attempts`} color="purple" onClick={() => navigate('/quizzes')} />
        <StatCard icon={Flame} label="Streak" value={`${stats?.currentStreak ?? 0}d`} sub={`best ${stats?.longestStreak ?? 0}d`} color="red" onClick={() => navigate('/sessions')} />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's focus + upcoming */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's focus */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Today's focus</h2>
              <Link to="/tasks" className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 flex items-center gap-1">
                All tasks <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {(todayFocusData || []).length === 0 ? (
              <EmptyState icon={Circle} title="No tasks for today" description="Enjoy the breather, or plan your next task."
                actionLabel="Add a task" onAction={() => navigate('/tasks?new=1')} />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {todayFocusData.map((t) => {
                  const pb = priorityBadge(t.priority);
                  const num = { urgent: 4, high: 3, medium: 2, low: 1 }[t.priority];
                  return (
                    <li key={t._id} className="py-2.5 flex items-center gap-3 group">
                      <span style={{ width: num * 4 }} className="h-8 rounded-l" />
                      <div className="flex-1 min-w-0">
                        <Link to={`/tasks?view=${t._id}`} className="text-sm font-medium text-slate-800 dark:text-slate-200 hover:text-brand-600 dark:hover:text-brand-400 truncate block">
                          {t.title}
                        </Link>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {t.subjectName}
                          {t.dueDate && <span className={isOverdue(t.dueDate) ? ' text-red-500' : ''}> · {formatRelative(t.dueDate)}</span>}
                        </p>
                      </div>
                      <span className={`hidden sm:inline-flex badge ${pb.color === 'red' ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                        {pb.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Charts */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">This week's study time</h2>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {formatDuration(stats?.weekMinutes ?? 0)} total
              </span>
            </div>
            <MiniBarChart data={data.weeklyStudyHours || []} />
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 text-xs text-slate-500 dark:text-slate-400">
              <span>This week: <span className="font-medium text-slate-800 dark:text-slate-200">{formatDuration(stats?.weekMinutes ?? 0)}</span></span>
              <div className="flex gap-4">
                <span>Today: <span className="font-medium text-slate-800 dark:text-slate-200">{formatDuration(stats?.todayMinutes ?? 0)}</span></span>
                <span>This month: <span className="font-medium text-slate-800 dark:text-slate-200">{formatDuration(stats?.monthMinutes ?? 0)}</span></span>
              </div>
            </div>
          </div>

          {/* Recent notes */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Recent notes</h2>
              <Link to="/notes" className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 flex items-center gap-1">
                All notes <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {(data.recentNotes || []).length === 0 ? (
              <EmptyState icon={StickyNote} title="No notes yet" description="Capture your first study note and AI summaries will show up here."
                actionLabel="Create a note" onAction={() => navigate('/notes/new')} />
            ) : (
              <ul className="space-y-2">
                {(data.recentNotes || []).map((n) => (
                  <li key={n._id}>
                    <Link to={`/notes/${n._id}`} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                      <div
                        className="flex h-8 w-1 rounded-full"
                        style={{ backgroundColor: n.subject?.color || '#6366f1' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{n.title}</p>
                        <p className="text-xs text-slate-400 truncate">{excerpt(n.content, 80)}</p>
                      </div>
                      <span className="text-xs text-slate-400 shrink-0">{timeAgo(n.updatedAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Upcoming deadlines */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Upcoming deadlines</h2>
              <CalendarClock className="h-4 w-4 text-slate-400" />
            </div>
            {(upcomingDeadlinesData || []).length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">Nothing due soon</p>
            ) : (
              <ul className="space-y-2">
                {upcomingDeadlinesData.map((t) => (
                  <li key={t._id} className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold ${isOverdue(t.dueDate) ? 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400' : isToday(t.dueDate) ? 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                      {new Date(t.dueDate).getDate()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{t.title}</p>
                      <p className={`text-xs ${isOverdue(t.dueDate) ? 'text-red-500' : 'text-slate-400'}`}>{formatRelative(t.dueDate)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/calendar" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
              Open calendar <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* AI Recommendation */}
          <div className="rounded-xl border border-brand-200 dark:border-slate-800 bg-gradient-to-br from-brand-50 to-white dark:bg-none dark:bg-slate-900 p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600">
                <Sparkles className="h-4 w-4 text-white" />
              </span>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">AI study insight</h2>
            </div>
            {aiLoading ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 animate-pulse">Analyzing your study data…</p>
            ) : recommendations?.length ? (
              <div className="space-y-3">
                {recommendations.map((r, i) => (
                  <div key={i}>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{r.title}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">{r.detail}</p>
                  </div>
                ))}
              </div>
            ) : aiError ? (
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  Set your AI key in the server <code className="text-xs">.env</code> to get personalized study insights.
                </p>
                <button onClick={loadRecommendations} className="mt-3 text-xs font-medium text-brand-600 dark:text-brand-400">Try again</button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  StudyPilot can review your tasks, quiz results, and study time to recommend what to focus on next.
                </p>
                <Button size="sm" variant="secondary" className="mt-3" onClick={loadRecommendations} loading={aiLoading}>
                  {generating ? 'Analyzing…' : 'Generate insight'}
                </Button>
              </div>
            )}
          </div>

          {/* Mini achievements */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-4 w-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Progress</h2>
            </div>
            <div className="space-y-3">
              <MiniProgress label="Tasks completed" value={stats?.totalTasks ? (stats.completedTasks / stats.totalTasks) * 100 : 0} detail={`${stats?.completedTasks ?? 0}/${stats?.totalTasks ?? 0}`} />
              <MiniProgress label="Quiz accuracy" value={stats?.quizAvg ?? 0} detail={`${stats?.quizAvg ?? 0}%`} color="#8b5cf6" />
              <MiniProgress label="Best streak" value={stats?.longestStreak ? Math.min(100, (stats.currentStreak / stats.longestStreak) * 100) : 0} detail={`${stats?.currentStreak ?? 0}/${stats?.longestStreak ?? 0}d`} color="#f59e0b" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Inline lightweight bar chart (no recharts needed for tiny chart)
function MiniBarChart({ data }) {
  const max = Math.max(1, ...data.map((d) => d.hours));
  return (
    <div className="flex items-end justify-between gap-2 h-32">
      {data.map((d, i) => {
        const isLast = i === data.length - 1;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
            <div className="w-full h-28 flex items-end">
              <div
                className={`w-full rounded-t-md transition-all ${isLast ? 'bg-brand-500' : 'bg-brand-200 dark:bg-brand-800/70'}`}
                style={{ height: `${(d.hours / max) * 100}%`, minHeight: d.hours > 0 ? '8px' : '2px' }}
              />
            </div>
            <span className="text-[10px] text-slate-400">{d.day}</span>
          </div>
        );
      })}
    </div>
  );
}

function MiniProgress({ label, value, detail, color }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
        <span className="text-xs font-medium text-slate-800 dark:text-slate-200">{detail}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${Math.min(100, value)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}