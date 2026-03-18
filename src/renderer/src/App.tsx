import { useState, useRef, useEffect } from 'react'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { ConnectionSidebar } from './components/sidebar/ConnectionSidebar'
import { DataGrid } from './components/grid/DataGrid'
import { useAppStore } from './store'
import { useConnections } from './hooks/useDatabase'
import { generateQuery } from './lib/query-utility'
import * as ExcelJS from 'exceljs'
import { Table, X, Edit2, FileDown, PanelLeft } from 'lucide-react'

const queryClient = new QueryClient()

function EditableTab({ 
  tab, 
  isActive, 
  onSelect, 
  onClose, 
  onRename 
}: { 
  tab: any, 
  isActive: boolean, 
  onSelect: () => void, 
  onClose: (id: string) => void,
  onRename: (id: string, title: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [tempTitle, setTempTitle] = useState(tab.title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing])

  const handleRename = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (tempTitle.trim()) {
      onRename(tab.id, tempTitle.trim())
    } else {
      setTempTitle(tab.title)
    }
    setIsEditing(false)
  }

  return (
    <div 
      onClick={onSelect}
      className={`group relative flex items-center h-10 px-4 min-w-[120px] max-w-[200px] border-r border-border cursor-pointer transition-all ${
        isActive 
          ? 'bg-background text-primary font-medium border-t-2 border-t-primary shadow-[0_-4px_10px_rgba(0,0,0,0.05)]' 
          : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
      }`}
    >
      <div className="flex items-center gap-2 overflow-hidden w-full">
        <Table className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground/50'}`} />
        
        {isEditing ? (
          <form onSubmit={handleRename} className="flex-1 min-w-0" onClick={e => e.stopPropagation()}>
            <input
              ref={inputRef}
              className="w-full bg-transparent border-none outline-none text-xs text-foreground py-0"
              value={tempTitle}
              onChange={e => setTempTitle(e.target.value)}
              onBlur={() => handleRename()}
            />
          </form>
        ) : (
          <span className="text-xs truncate flex-1 select-none">{tab.title}</span>
        )}
      </div>

      <div className="flex items-center gap-1.5 ml-2">
        {!isEditing && (
          <button 
            onClick={(e) => { e.stopPropagation(); setIsEditing(true) }}
            className={`opacity-0 group-hover:opacity-100 p-0.5 hover:bg-secondary rounded transition-all ${isActive ? 'text-primary/70' : 'text-muted-foreground/70'}`}
            title="Rename Tab"
          >
            <Edit2 className="w-3 h-3" />
          </button>
        )}
        <button 
          onClick={(e) => { e.stopPropagation(); onClose(tab.id) }}
          className={`opacity-0 group-hover:opacity-100 p-0.5 hover:bg-destructive/10 hover:text-destructive rounded transition-all ${isActive ? 'text-primary/70' : 'text-muted-foreground/70'}`}
          title="Close Tab"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      
      {isActive && (
        <div className="absolute bottom-[-1px] left-0 right-0 h-[1px] bg-background z-10" />
      )}
    </div>
  )
}

function AppContent() {
  const { 
    tabs, 
    activeTabId, 
    setActiveTabId, 
    removeTab, 
    renameTab, 
    grids, 
    sidebarOpen, 
    toggleSidebar 
  } = useAppStore()
  const { data: allConnections } = useConnections()
  const qClient = useQueryClient()

  const handleExportTabExcel = async (tabId: string) => {
    const tabGrids = grids.filter(g => g.tabId === tabId)
    if (tabGrids.length === 0) return

    const workbook = new ExcelJS.Workbook()
    const activeTab = tabs.find(t => t.id === tabId)
    const exportName = activeTab?.title || 'Export'

    for (const grid of tabGrids) {
      const baseConn = allConnections?.find(c => c.id === grid.connectionId) || null
      const conn = baseConn && grid.databaseName
        ? { ...baseConn, database: grid.databaseName }
        : baseConn

      const { query } = generateQuery(conn, grid.tableName, grid.filters, grid.sortState, grid.page, grid.pageSize)
      
      const queryKey = ['query', conn?.id, query, undefined]
      const cachedData = qClient.getQueryData<{ rows: any[]; fields: { name: string }[] }>(queryKey)

      if (cachedData && cachedData.rows.length > 0) {
        // ExcelJS sheet names must be unique and <= 31 chars
        let sheetName = grid.tableName.substring(0, 25)
        let suffix = 1
        while (workbook.getWorksheet(sheetName)) {
          sheetName = `${grid.tableName.substring(0, 20)}_${suffix++}`
        }
        
        const sheet = workbook.addWorksheet(sheetName)
        sheet.columns = cachedData.fields.map(f => ({ header: f.name, key: f.name, width: 20 }))
        cachedData.rows.forEach(row => {
          sheet.addRow(row)
        })
      }
    }

    if (workbook.worksheets.length === 0) {
      alert('No data found in the current tab to export.')
      return
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${exportName.replace(/[^a-z0-9]/gi, '_')}_full_export.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {sidebarOpen && <ConnectionSidebar />}
      
      <div className={`flex-1 flex flex-col h-full bg-background overflow-hidden transition-all duration-300 ${sidebarOpen ? 'border-l border-border/50' : ''}`}>
        {tabs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
            {!sidebarOpen && (
              <button 
                onClick={toggleSidebar}
                className="absolute top-4 left-4 p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-all shadow-sm border border-primary/20 group"
                title="Show Sidebar"
              >
                <PanelLeft className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </button>
            )}
            
            <div className="w-20 h-20 bg-muted/20 rounded-full flex items-center justify-center mb-6 ring-1 ring-border/50 shadow-inner">
              <Table className="w-10 h-10 text-muted-foreground/20" />
            </div>
            <h3 className="text-lg font-medium mb-2 text-foreground/80">No Tab Analysis Active</h3>
            <p className="text-muted-foreground text-sm max-w-[280px] text-center mb-8 leading-relaxed">
              Open a table from the sidebar to start a new investigation tab.
            </p>
            
            {!sidebarOpen && (
              <button 
                onClick={toggleSidebar}
                className="px-6 py-2.5 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-all font-medium shadow-md active:scale-95"
              >
                Show Sidebar to Begin
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Tab Bar */}
            <div className="h-10 border-b border-border bg-muted/20 flex items-center overflow-x-auto overflow-y-hidden scrollbar-hide shrink-0 px-2 gap-1">
              <button 
                onClick={toggleSidebar}
                className={`p-1.5 hover:bg-secondary rounded-md transition-all mr-1 ${
                  !sidebarOpen ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
                }`}
                title={sidebarOpen ? "Hide Sidebar" : "Show Sidebar"}
              >
                <PanelLeft className="w-4 h-4" />
              </button>
              
              {tabs.map((tab) => (
                <EditableTab
                  key={tab.id}
                  tab={tab}
                  isActive={activeTabId === tab.id}
                  onSelect={() => setActiveTabId(tab.id)}
                  onClose={removeTab}
                  onRename={renameTab}
                />
              ))}
            </div>

            {/* Grid Content */}
            <div className="flex-1 overflow-hidden relative bg-muted/5">
              {tabs.map((tab) => (
                <div 
                  key={tab.id} 
                  className={`absolute inset-0 flex flex-col transition-opacity duration-200 ${
                    activeTabId === tab.id ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                  }`}
                >
                  {/* Tab Toolbar */}
                  <div className="h-12 border-b border-border bg-background flex items-center justify-between px-6 shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-primary/10 rounded-lg">
                        <Table className="w-4 h-4 text-primary" />
                      </div>
                      <h2 className="text-sm font-bold text-foreground/80 tracking-tight">
                        {tab.title}
                      </h2>
                    </div>
                    
                    <button 
                      onClick={() => handleExportTabExcel(tab.id)}
                      className="flex items-center gap-2.5 px-3.5 py-1.5 bg-green-600/10 text-green-600 hover:bg-green-600 text-xs font-semibold hover:text-white rounded-lg transition-all border border-green-600/20 hover:border-green-600 shadow-sm active:scale-95 group"
                      title="Export all tables in this tab to a single Excel file"
                    >
                      <FileDown className="w-4 h-4 group-hover:animate-bounce" />
                      <span>Export Tab (Excel)</span>
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-8 scroll-smooth pb-20">
                    {grids
                      .filter(g => g.tabId === tab.id)
                      .map((grid) => (
                        <DataGrid key={grid.id} gridId={grid.id} />
                      ))
                    }
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  )
}

export default App
