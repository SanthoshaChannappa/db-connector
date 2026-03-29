import React, { useEffect, useRef } from 'react'
import { useAppStore } from '../../store'
import { X, Trash2, Terminal } from 'lucide-react'

export function LogViewer(): React.ReactElement | null {
  const { logs, clearLogs, logViewerOpen, setLogViewerOpen, logViewerHeight, setLogViewerHeight } =
    useAppStore()
  const scrollRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = (e: React.MouseEvent): void => {
    e.preventDefault()
    const startY = e.clientY
    const startHeight = logViewerHeight

    const onMouseMove = (moveEvent: MouseEvent): void => {
      const deltaY = startY - moveEvent.clientY
      const newHeight = Math.max(100, Math.min(window.innerHeight - 100, startHeight + deltaY))
      setLogViewerHeight(newHeight)
    }

    const onMouseUp = (): void => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  useEffect(() => {
    if (logViewerOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs, logViewerOpen])

  if (!logViewerOpen) return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-background border-t border-border flex flex-col z-50 shadow-2xl animate-in slide-in-from-bottom duration-300"
      style={{ height: `${logViewerHeight}px` }}
    >
      {/* Resize Handle */}
      <div
        className="h-1.5 cursor-ns-resize absolute -top-0.5 left-0 right-0 hover:bg-primary/40 transition-colors z-[60]"
        onMouseDown={handleMouseDown}
      />
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border h-10 shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Application Logs
          </span>
          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium ml-2">
            {logs.length} entries
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearLogs}
            className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-md transition-all group"
            title="Clear Logs"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setLogViewerOpen(false)}
            className="p-1.5 hover:bg-secondary text-muted-foreground hover:text-foreground rounded-md transition-all"
            title="Close Log Viewer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Log List */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-2 font-mono text-[11px] leading-relaxed select-text"
      >
        {logs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground italic">
            No logs captured yet...
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {logs.map((log, i) => (
              <div
                key={i}
                className="flex gap-3 hover:bg-muted/30 px-2 py-0.5 rounded transition-colors group"
              >
                <span className="text-muted-foreground/40 shrink-0 select-none">
                  {new Date(log.timestamp).toLocaleTimeString([], {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  })}
                </span>
                <span
                  className={`uppercase font-bold shrink-0 w-16 select-none ${
                    log.source === 'main' ? 'text-amber-500/80' : 'text-blue-500/80'
                  }`}
                >
                  [{log.source}]
                </span>
                <span
                  className={`shrink-0 w-12 font-bold select-none ${
                    log.level === 'error'
                      ? 'text-destructive'
                      : log.level === 'warn'
                        ? 'text-amber-400'
                        : 'text-emerald-500/80'
                  }`}
                >
                  {log.level.toUpperCase()}
                </span>
                <span className="text-foreground/90 whitespace-pre-wrap break-all flex-1">
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
