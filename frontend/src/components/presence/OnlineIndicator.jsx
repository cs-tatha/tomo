import React from 'react';

export const OnlineIndicator = ({ isOnline, showText = false, size = 'sm' }) => {
  const sizeClasses = {
    xs: 'w-2 h-2',
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
  };

  return (
    <div className="inline-flex items-center gap-1.5" title={isOnline ? 'Online' : 'Offline'}>
      <span className="relative flex">
        {isOnline && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75`} />
        )}
        <span
          className={`${sizeClasses[size] || sizeClasses.sm} rounded-full transition-colors duration-200 ${
            isOnline ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
          }`}
        />
      </span>
      {showText && (
        <span className={`text-xs font-medium ${isOnline ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
          {isOnline ? 'Online' : 'Offline'}
        </span>
      )}
    </div>
  );
};
