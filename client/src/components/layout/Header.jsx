import { Menu, Bell, Moon, Sun, Plus } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { notificationApi } from '../../services/api';
import { Dropdown, DropdownItem } from '../ui/Dropdown';
import { formatRelative, timeAgo } from '../../utils/format';

export function Header({ onMenuClick }) {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    loadNotifications();
    // Refresh periodically
    const t = setInterval(loadNotifications, 60000);
    return () => clearInterval(t);
  }, [location.pathname]);

  const loadNotifications = async () => {
    try {
      const res = await notificationApi.list();
      setNotifications(res.data.notifications);
      setUnread(res.data.unreadCount);
    } catch (e) { /* ignore */ }
  };

  const markAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      setUnread(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (e) { /* ignore */ }
  };

  const pageTitles = {
    '/dashboard': 'Dashboard',
    '/subjects': 'Subjects',
    '/tasks': 'Tasks',
    '/calendar': 'Calendar',
    '/notes': 'Notes',
    '/assistant': 'AI Assistant',
    '/quizzes': 'Quiz Center',
    '/sessions': 'Study Sessions',
    '/analytics': 'Analytics',
    '/search': 'Search',
    '/profile': 'Profile',
    '/settings': 'Settings'
  };
  const title = pageTitles[location.pathname] || 'StudyPilot';

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur px-4 lg:px-6">
      <button
        onClick={onMenuClick}
        className="lg:hidden text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 p-1.5 -ml-1.5"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</span>
        {/* Online badge */}
        <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 text-xs font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {user?.name?.split(' ')[0]}
        </span>
      </div>

      <div className="flex-1" />

      <button
        onClick={() => navigate('/tasks?new=1')}
        className="hidden sm:inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-950"
      >
        <Plus className="h-4 w-4" />
        Quick task
      </button>

      <button
        onClick={toggleTheme}
        className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>

      <Dropdown
        align="right"
        width="w-80"
        trigger={
          <span className="relative p-2 rounded-lg inline-flex items-center justify-center text-slate-400 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100" role="button" aria-label="Notifications">
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold text-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </span>
        }
      >
        <div className="px-4 py-2.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-700">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Notifications</span>
          <button onClick={markAllRead} className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 font-medium">
            Mark all read
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 && (
            <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400 text-center">No notifications yet</p>
          )}
          {notifications.slice(0, 10).map((n) => (
            <div key={n._id} className={`px-4 py-3 border-b border-slate-50 dark:border-slate-800 ${!n.read ? 'bg-brand-50/50 dark:bg-brand-950/30' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{n.title}</p>
                <span className="text-xs text-slate-400 shrink-0">{timeAgo(n.createdAt)}</span>
              </div>
              {n.message && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{n.message}</p>}
            </div>
          ))}
        </div>
      </Dropdown>
    </header>
  );
}