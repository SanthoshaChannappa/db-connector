import { useState, useRef } from 'react'
import { Play, Square, Terminal, AlertCircle, CheckCircle, RefreshCw, FileDown } from 'lucide-react'
import * as ExcelJS from 'exceljs'
import { useAppStore } from '../../store'
import { useConnections } from '../../hooks/useDatabase'

interface QueryEditorProps {
  tabId: string
}

export function QueryEditor({ tabId }: QueryEditorProps) {
  const { tabs, updateTab } = useAppStore()
  const tab = tabs.find((t) => t.id === tabId)
  if (!tab || tab.type !== 'query') return null

  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const stopRef = useRef(false)

  const { data: connections } = useConnections()
  const baseConn = connections?.find((c) => c.id === tab.connectionId)
  const conn = baseConn && tab.databaseName ? { ...baseConn, database: tab.databaseName } : baseConn

  const handleExecute = async () => {
    if (!conn || !tab.queryText) return
    setIsLoading(true)
    setError(null)
    setResults(null)
    stopRef.current = false

    try {
      const res = await window.api.executeQuery(conn, tab.queryText)
      if (stopRef.current) return
      setResults(res)
    } catch (err) {
      if (stopRef.current) return
      setError((err as any).message || 'An error occurred during query execution')
    } finally {
      setIsLoading(false)
    }
  }

  const handleStop = () => {
    stopRef.current = true
    setIsLoading(false)
  }

  const handleExportExcel = async () => {
    if (!results || results.rows.length === 0) return

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Query Results')

    sheet.columns = results.fields.map((f: any) => ({ header: f.name, key: f.name, width: 20 }))
    results.rows.forEach((row: any) => {
      sheet.addRow(row)
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `query_results_${new Date().getTime()}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Editor Section */}
      <div className="flex flex-col h-1/2 min-h-[200px] border-b border-border">
        <div className="h-10 border-b border-border bg-muted/30 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              SQL Editor
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExecute}
              disabled={isLoading || !tab.queryText}
              className="flex items-center gap-1.5 px-3 py-1 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 transition-all disabled:opacity-50 active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Execute
            </button>
            <button
              onClick={handleStop}
              disabled={!isLoading}
              className="flex items-center gap-1.5 px-3 py-1 bg-destructive text-destructive-foreground rounded-md text-xs font-medium hover:bg-destructive/90 transition-all disabled:opacity-50 active:scale-95"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              Stop
            </button>
          </div>
        </div>
        <textarea
          className="flex-1 w-full p-4 font-mono text-sm bg-card resize-none focus:outline-none leading-relaxed text-foreground/90 selection:bg-primary/20"
          value={tab.queryText}
          onChange={(e) => updateTab(tabId, { queryText: e.target.value })}
          placeholder="-- Write your SQL or MongoDB query here..."
          spellCheck={false}
        />
      </div>

      {/* Results Section */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="h-10 border-b border-border bg-muted/30 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Query Results
            </span>
            {results && (
              <span className="ml-3 px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full">
                {results.rows.length.toLocaleString()} rows
              </span>
            )}
          </div>
          <button
            onClick={handleExportExcel}
            disabled={!results || results.rows.length === 0}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-green-600/10 text-green-600 hover:bg-green-600 hover:text-white disabled:opacity-30 disabled:hover:bg-green-600/10 disabled:hover:text-green-600 rounded-md text-[10px] font-bold transition-all border border-green-600/20 hover:border-green-600 shadow-sm active:scale-95 group"
            title="Export Results to Excel"
          >
            <FileDown className="w-3.5 h-3.5 group-hover:animate-bounce" />
            <span>EXPORT</span>
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-card/50">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground animate-in fade-in duration-500">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Executing query...</p>
            </div>
          ) : error ? (
            <div className="p-6">
              <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg animate-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-semibold">Execution Failed</p>
                  <pre className="text-xs whitespace-pre-wrap font-mono opacity-90">{error}</pre>
                </div>
              </div>
            </div>
          ) : results ? (
            results.rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                <CheckCircle className="w-8 h-8 text-green-500/50" />
                <p className="text-sm">Query executed successfully, but returned no results.</p>
              </div>
            ) : (
              <div className="relative overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="text-xs text-muted-foreground bg-muted/50 border-b border-border sticky top-0 z-10">
                    <tr>
                      {results.fields.map((f: any) => (
                        <th
                          key={f.name}
                          className="px-4 py-3 font-medium tracking-wider bg-muted/80 backdrop-blur-sm border-r border-border/50 last:border-r-0"
                        >
                          {f.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.rows.map((row: any, i: number) => (
                      <tr
                        key={i}
                        className="border-b border-border/50 last:border-b-0 hover:bg-primary/5 transition-colors"
                      >
                        {results.fields.map((f: any) => (
                          <td
                            key={f.name}
                            className="px-4 py-2.5 text-foreground/80 border-r border-border/30 last:border-r-0 font-mono text-xs max-w-[300px] truncate"
                          >
                            {row[f.name] === null ? (
                              <span className="text-muted-foreground italic">NULL</span>
                            ) : (
                              String(row[f.name])
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <Terminal className="w-10 h-10 opacity-10" />
              <p className="text-sm">Enter a query above and click "Execute" to see results.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
