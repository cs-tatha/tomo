import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useTheme } from '../../context/ThemeContext';
import { OnlineIndicator } from '../presence/OnlineIndicator';
import { LogOut, Radio, MessageCircle, Bell, Sun, Moon } from 'lucide-react';
import { InvitationsModal } from '../../features/invitations/InvitationsModal';

export const Navbar = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const {
    isConnected,
    unreadDms,
    friendRequests,
    workspaceInvitations,
    acceptFriendRequest,
    rejectFriendRequest,
    acceptWorkspaceInvite,
    rejectWorkspaceInvite,
  } = useSocket();
  const [isInvitesOpen, setIsInvitesOpen] = useState(false);

  if (!user) return null;

  const totalUnread = Object.values(unreadDms || {}).reduce((sum, n) => sum + n, 0);
  const totalNotifications = (friendRequests?.length || 0) + (workspaceInvitations?.length || 0);

  return (
    <nav className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 px-4 sm:px-6 flex items-center justify-between transition-colors">
      {/* Website Name */}
      <Link to="/dashboard" className="group">
        <span className="font-extrabold text-slate-900 dark:text-white text-xl tracking-widest group-hover:text-blue-600 dark:group-hover:text-sky-400 transition-colors">
          TOMO
        </span>
      </Link>

      {/* Right Controls: Notifications, Dark/Light Mode, User Profile, Logout */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Real-time live gateway badge */}
        <div
          className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
            isConnected
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
          }`}
          title={isConnected ? 'Connected to live real-time gateway' : 'Reconnecting to real-time gateway...'}
        >
          <Radio className={`w-3.5 h-3.5 ${isConnected ? 'animate-pulse text-emerald-600 dark:text-emerald-400' : 'text-amber-500'}`} />
          <span>{isConnected ? 'Live' : 'Connecting'}</span>
        </div>

        {/* Unread Direct Messages Badge */}
        {totalUnread > 0 && (
          <Link
            to="/dashboard"
            title={`${totalUnread} new direct message${totalUnread > 1 ? 's' : ''} from friends`}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white animate-pulse shadow-xs transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>{totalUnread} new</span>
          </Link>
        )}

        {/* Notifications Bell */}
        <button
          type="button"
          onClick={() => setIsInvitesOpen(true)}
          title={totalNotifications > 0 ? `${totalNotifications} pending requests/invites` : 'Notifications'}
          className={`relative p-2 rounded-xl transition-all cursor-pointer ${
            totalNotifications > 0
              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Bell className="w-5 h-5" />
          {totalNotifications > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white font-bold text-[10px] flex items-center justify-center shadow-xs animate-bounce">
              {totalNotifications}
            </span>
          )}
        </button>

        {/* Dark / Light Mode Toggle */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            toggleTheme();
          }}
          aria-label={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
          title={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
          className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          {isDark ? (
            <Sun className="w-5 h-5 text-amber-400 hover:rotate-45 transition-transform" />
          ) : (
            <Moon className="w-5 h-5 text-slate-600 dark:text-slate-300 hover:-rotate-12 transition-transform" />
          )}
        </button>

        {/* User Profile Link */}
        <Link
          to="/profile"
          title="View profile"
          className="flex items-center gap-2.5 py-1 px-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-xs shadow-xs">
            {user.username.slice(0, 2).toUpperCase()}
          </div>
          <div className="hidden sm:block text-left text-xs">
            <p className="font-semibold text-slate-800 dark:text-slate-200 leading-tight">{user.username}</p>
            <p className="text-slate-400 dark:text-slate-500 text-[11px] leading-tight max-w-[120px] truncate">{user.email}</p>
          </div>
        </Link>

        {/* Log Out */}
        <button
          onClick={logout}
          title="Sign out"
          className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* Invitations & Requests Modal */}
      <InvitationsModal
        isOpen={isInvitesOpen}
        onClose={() => setIsInvitesOpen(false)}
        friendRequests={friendRequests}
        workspaceInvitations={workspaceInvitations}
        onAcceptFriendRequest={acceptFriendRequest}
        onRejectFriendRequest={rejectFriendRequest}
        onAcceptWorkspaceInvite={acceptWorkspaceInvite}
        onRejectWorkspaceInvite={rejectWorkspaceInvite}
      />
    </nav>
  );
};
