import React, { useState, useEffect } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import { Radio, Lock } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export const LivePresentationViewer = ({
  presenter,
  liveElements = [],
  liveAppState = {},
  onStopPresentation = null,
  isCurrentUserPresenter = false,
}) => {
  const { isDark } = useTheme();
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);

  const onExcalidrawAPI = React.useCallback((api) => {
    setExcalidrawAPI(api);
  }, []);

  const uiOptions = React.useMemo(
    () => ({
      canvasActions: {
        saveToActiveFile: false,
        loadScene: false,
        export: { saveFileToDisk: true },
      },
    }),
    []
  );

  // Sync incoming elements to viewer canvas
  useEffect(() => {
    if (excalidrawAPI && Array.isArray(liveElements)) {
      try {
        excalidrawAPI.updateScene({
          elements: liveElements,
        });
      } catch (err) {
        console.error('[Viewer] Error updating scene:', err);
      }
    }
  }, [excalidrawAPI, liveElements]);

  // Dynamically sync canvas theme with dark/light mode toggle
  useEffect(() => {
    if (excalidrawAPI) {
      excalidrawAPI.updateScene({
        appState: {
          theme: isDark ? 'dark' : 'light',
        },
      });
    }
  }, [isDark, excalidrawAPI]);

  return (
    <div className="relative w-full h-full flex flex-col bg-white dark:bg-slate-900 rounded-2xl border-2 border-blue-500/50 overflow-hidden shadow-lg transition-colors" style={{ height: '100%' }}>
      {/* Viewer Banner */}
      <div className="h-14 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 px-4 flex items-center justify-between text-white z-10 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-white/20 animate-pulse">
            <Radio className="w-4 h-4 text-white" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm tracking-tight">
                {isCurrentUserPresenter ? 'You are presenting live' : `${presenter?.username || 'Member'}'s Live Whiteboard`}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 uppercase tracking-wider flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" /> Read-Only Viewer
              </span>
            </div>
            <p className="text-[11px] text-white/80">
              Drawing updates stream in real-time. Changes are controlled by {presenter?.username}.
            </p>
          </div>
        </div>

        {isCurrentUserPresenter && onStopPresentation && (
          <button
            onClick={onStopPresentation}
            type="button"
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            Stop Presentation
          </button>
        )}
      </div>

      {/* Read-Only Excalidraw Viewer */}
      <div className="flex-1 w-full relative" style={{ height: 'calc(100% - 3.5rem)', minHeight: '450px' }}>
        <Excalidraw
          autoFocus={false}
          theme={isDark ? 'dark' : 'light'}
          excalidrawAPI={onExcalidrawAPI}
          viewModeEnabled={true}
          zenModeEnabled={false}
          gridModeEnabled={false}
          UIOptions={uiOptions}
        />
      </div>
    </div>
  );
};
