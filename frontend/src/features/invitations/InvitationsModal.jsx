import React, { useState } from 'react';
import { Modal } from '../../components/common/Modal';
import { UserPlus, Briefcase, Check, X, Clock, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const InvitationsModal = ({
  isOpen,
  onClose,
  friendRequests = [],
  workspaceInvitations = [],
  onAcceptFriendRequest,
  onRejectFriendRequest,
  onAcceptWorkspaceInvite,
  onRejectWorkspaceInvite,
  initialTab = 'friends',
}) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const navigate = useNavigate();

  const handleAcceptFriend = async (requestId) => {
    setActionLoadingId(requestId);
    try {
      await onAcceptFriendRequest(requestId);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectFriend = async (requestId) => {
    setActionLoadingId(requestId);
    try {
      await onRejectFriendRequest(requestId);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAcceptWorkspace = async (inviteId) => {
    setActionLoadingId(inviteId);
    try {
      const res = await onAcceptWorkspaceInvite(inviteId);
      if (res?.groupId) {
        onClose();
        navigate(`/groups/${res.groupId}`);
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectWorkspace = async (inviteId) => {
    setActionLoadingId(inviteId);
    try {
      await onRejectWorkspaceInvite(inviteId);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Pending Requests & Invitations">
      {/* Tab Selectors */}
      <div className="flex items-center gap-2 mb-4 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
        <button
          type="button"
          onClick={() => setActiveTab('friends')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'friends'
              ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-xs'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <UserPlus className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>Friend Requests</span>
          {friendRequests.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
              {friendRequests.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('workspaces')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'workspaces'
              ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-xs'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>Workspace Invites</span>
          {workspaceInvitations.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
              {workspaceInvitations.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Friend Requests */}
      {activeTab === 'friends' && (
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {friendRequests.length === 0 ? (
            <div className="text-center py-8 text-slate-400 dark:text-slate-500 space-y-2">
              <UserPlus className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 stroke-1" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No Pending Friend Requests</p>
              <p className="text-xs max-w-xs mx-auto">
                When other users find you in the directory and send you a friend request, their invitations will appear here.
              </p>
            </div>
          ) : (
            friendRequests.map((req) => (
              <div
                key={req.id}
                className="p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-850 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex items-center justify-between gap-3 shadow-2xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-sky-400 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                    {req.sender?.username?.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">{req.sender?.username}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{req.sender?.email}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                      <Clock className="w-2.5 h-2.5" />
                      <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={actionLoadingId === req.id}
                    onClick={() => handleAcceptFriend(req.id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Accept</span>
                  </button>
                  <button
                    type="button"
                    disabled={actionLoadingId === req.id}
                    onClick={() => handleRejectFriend(req.id)}
                    className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                    title="Decline request"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: Workspace Invitations */}
      {activeTab === 'workspaces' && (
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {workspaceInvitations.length === 0 ? (
            <div className="text-center py-8 text-slate-400 dark:text-slate-500 space-y-2">
              <Briefcase className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 stroke-1" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No Pending Workspace Invites</p>
              <p className="text-xs max-w-xs mx-auto">
                When teammates invite you to discussion groups or workspaces, you can join or decline them here.
              </p>
            </div>
          ) : (
            workspaceInvitations.map((inv) => (
              <div
                key={inv.id}
                className="p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-850 hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-3 shadow-2xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{inv.groupName}</h4>
                    {inv.groupDescription && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">{inv.groupDescription}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                      <span>Invited by <strong className="text-slate-600 dark:text-slate-300 font-semibold">{inv.inviter?.username}</strong></span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        <span>{inv.memberCount} members</span>
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                    {inv.role}
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    disabled={actionLoadingId === inv.id}
                    onClick={() => handleRejectWorkspace(inv.id)}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    disabled={actionLoadingId === inv.id}
                    onClick={() => handleAcceptWorkspace(inv.id)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Join Workspace</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </Modal>
  );
};