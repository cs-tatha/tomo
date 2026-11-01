import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { OnlineIndicator } from '../components/presence/OnlineIndicator';
import { User, Mail, Shield, Calendar, Users, Key } from 'lucide-react';

export const UserProfilePage = () => {
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/users/me');
        setProfile(res.data.user);
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="h-64 bg-white rounded-2xl border border-slate-200 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 w-full space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden transition-colors rounded-2xl">
        {/* Banner */}
        <div className="h-28 bg-gradient-to-r from-blue-700 via-blue-600 to-sky-500" />

        {/* Profile Details */}
        <div className="px-6 sm:px-8 pb-8 pt-0 relative">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between -mt-12 mb-6 gap-4">
            <div className="flex items-end gap-4">
              <div className="w-24 h-24 rounded-2xl bg-white dark:bg-slate-900 border-4 border-white dark:border-slate-900 shadow-md bg-gradient-to-tr from-blue-600 to-sky-400 text-white font-bold text-3xl flex items-center justify-center">
                {profile?.username?.slice(0, 2).toUpperCase()}
              </div>
              <div className="mb-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{profile?.username}</h1>
                  <OnlineIndicator isOnline={true} showText size="sm" />
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-0.5">
                  <Key className="w-3.5 h-3.5" />
                  <span className="font-mono">{profile?.id}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <Mail className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-[11px] font-semibold uppercase text-slate-400 dark:text-slate-500">Email Address</p>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{profile?.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <Calendar className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-[11px] font-semibold uppercase text-slate-400 dark:text-slate-500">Account Created</p>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' }) : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Group Affiliations */}
          <div className="mt-8 space-y-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Joined Groups ({profile?.memberships?.length || 0})</span>
            </h3>

            {profile?.memberships && profile.memberships.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {profile.memberships.map((m) => (
                  <div key={m.id} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{m.group.name}</h4>
                      <p className="text-xs text-slate-400 dark:text-slate-500 line-clamp-1">{m.group.description || 'No description'}</p>
                    </div>
                    <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                      {m.role}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No groups joined yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
