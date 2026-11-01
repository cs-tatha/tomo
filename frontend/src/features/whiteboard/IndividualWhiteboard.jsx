import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import { Radio, Trash2, Eye } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export const IndividualWhiteboard = ({
  isLivePresenter = false,
  onDrawingUpdate = null,
}) => {
  const { isDark } = useTheme();
  const [excalidrawAPI, setExcalidrawAPI] = useState(null);
  const lastBroadcastRef = useRef(0);
  const pendingUpdateRef = useRef(null);

  // Throttled drawing broadcast (100ms) to prevent network congestion
  const broadcastDrawing = useCallback(
    (elements, appState) => {
      if (!isLivePresenter || !onDrawingUpdate) return;

      const now = Date.now();
      const THROTTLE_INTERVAL = 100; // ms

      if (now - lastBroadcastRef.current >= THROTTLE_INTERVAL) {
        lastBroadcastRef.current = now;
        onDrawingUpdate(elements, appState);
      } else {
        if (pendingUpdateRef.current) clearTimeout(pendingUpdateRef.current);
        pendingUpdateRef.current = setTimeout(() => {
          lastBroadcastRef.current = Date.now();
          onDrawingUpdate(elements, appState);
        }, THROTTLE_INTERVAL);
      }
    },
    [isLivePresenter, onDrawingUpdate]
  );

  const onExcalidrawAPI = useCallback((api) => {
    setExcalidrawAPI(api);
  }, []);

  const handleChange = useCallback(
    (elements, appState) => {
      if (isLivePresenter) {
        broadcastDrawing(elements, appState);
      }
    },
    [isLivePresenter, broadcastDrawing]
  );

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

  const handleClear = () => {
    if (excalidrawAPI) {
      excalidrawAPI.resetScene();
      if (isLivePresenter && onDrawingUpdate) {
        onDrawingUpdate([], {});
      }
    }
  };

  // If newly became presenter, broadcast current canvas immediately
  useEffect(() => {
    if (isLivePresenter && excalidrawAPI && onDrawingUpdate) {
      const elements = excalidrawAPI.getSceneElements();
      const appState = excalidrawAPI.getAppState();
      onDrawingUpdate(elements, appState);
    }
  }, [isLivePresenter, excalidrawAPI, onDrawingUpdate]);

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
    <div className="relative w-full h-full flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs transition-colors" style={{ height: '100%' }}>
      {/* Canvas Top Bar */}
      <div className="h-12 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-2">
          {isLivePresenter ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 animate-pulse">
              <Radio className="w-3.5 h-3.5" />
              <span>LIVE: Broadcasting Your Board</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              <Eye className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>Personal Whiteboard (In-Memory)</span>
            </span>
          )}
          <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:inline">
            Drawings stay in browser memory and are temporary.
          </span>
        </div>

        <button
          onClick={handleClear}
          type="button"
          title="Clear Whiteboard"
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-800 hover:border-rose-200 dark:hover:border-rose-800 transition-all cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear</span>
        </button>
      </div>

      {/* Excalidraw Workspace */}
      <div className="flex-1 w-full relative" style={{ height: 'calc(100% - 3rem)', minHeight: '450px' }}>
        <Excalidraw
          autoFocus={false}
          theme={isDark ? 'dark' : 'light'}
          excalidrawAPI={onExcalidrawAPI}
          onChange={handleChange}
          UIOptions={uiOptions}
        />
      </div>
    </div>
  );
};
