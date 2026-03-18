import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Database, ChevronRight, ChevronDown, Table2,
  Edit2, Trash2, Search, Folder, FolderOpen, FolderPlus,
  DatabaseZap
} from 'lucide-react'
import { useAppStore } from '../../store'
import type { DBConnection, ConnectionFolder } from '../../store'
import {
  useConnections, useDatabases, useSchema, useDeleteConnection,
  useFolders, useSaveFolder, useDeleteFolder
} from '../../hooks/useDatabase'
import { ConnectionDialog } from './ConnectionDialog'

// ── FolderDialog ──────────────────────────────────────────────────────────────

function FolderDialog({
  folders,
  existingFolder,
  onClose
}: {
  folders: ConnectionFolder[]
  existingFolder?: ConnectionFolder
  onClose: () => void
}) {
  const [name, setName] = useState(existingFolder?.name ?? '')
  const [parentId, setParentId] = useState(existingFolder?.parentId ?? '')
  const { mutateAsync: saveFolder } = useSaveFolder()
  const generateId = () => Math.random().toString(36).substr(2, 9)

  const handleSave = async () => {
    if (!name.trim()) return
    await saveFolder({
      id: existingFolder?.id ?? generateId(),
      name: name.trim(),
      parentId: parentId || undefined
    })
    onClose()
  }

  const selfAndDescendants = new Set<string>()
  if (existingFolder) {
    const collect = (id: string) => {
      selfAndDescendants.add(id)
      folders.filter(f => f.parentId === id).forEach(f => collect(f.id))
    }
    collect(existingFolder.id)
  }
  const parentOptions = folders.filter(f => !selfAndDescendants.has(f.id))

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-sm rounded-lg shadow-xl border border-border p-6 flex flex-col gap-5">
        <h3 className="text-lg font-semibold">{existingFolder ? 'Rename Folder' : 'New Folder'}</h3>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Folder Name
          <input
            autoFocus
            className="px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="My Folder"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Parent Folder
          <select
            className="px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            value={parentId}
            onChange={e => setParentId(e.target.value)}
          >
            <option value="">— Root —</option>
            {parentOptions.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </label>
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 rounded-md hover:bg-secondary text-sm font-medium transition-colors">Cancel</button>
          <button onClick={handleSave} className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 text-sm font-medium transition-colors">Save</button>
        </div>
      </div>
    </div>
  )
}

// ── DatabaseItem — one DB node inside an expanded connection ─────────────────

function DatabaseItem({
  dbName,
  conn,
  isActiveConn,
  activeDatabaseName,
  activeTableName,
  onSelectDatabase,
  onSelectTable
}: {
  dbName: string
  conn: DBConnection
  isActiveConn: boolean
  activeDatabaseName: string | null
  activeTableName: string | null
  onSelectDatabase: (dbName: string) => void
  onSelectTable: (tableName: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  // Fetch tables only when this database is expanded — scope conn to the chosen database
  const connForDb: DBConnection = { ...conn, database: dbName }
  const { data: schema, isLoading } = useSchema(expanded ? connForDb : null)

  const isActiveDb = isActiveConn && activeDatabaseName === dbName

  const handleToggle = () => {
    setExpanded(e => !e)
    onSelectDatabase(dbName)
  }

  return (
    <div className="flex flex-col">
      <div className={`flex items-center gap-1.5 px-2 py-1 text-sm rounded-md w-full transition-colors ${
        isActiveDb && !expanded ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-secondary text-muted-foreground hover:text-foreground'
      }`}>
        <button className="flex items-center gap-1.5 flex-1 min-w-0" onClick={handleToggle}>
          {expanded
            ? <ChevronDown className="w-3.5 h-3.5 shrink-0" />
            : <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          }
          <DatabaseZap className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
          <span className="truncate">{dbName}</span>
        </button>
      </div>

      {expanded && (
        <div className="ml-5 flex flex-col gap-0.5 mt-0.5 border-l border-border pl-2">
          {isLoading && <span className="text-xs text-muted-foreground py-1 px-1">Loading tables...</span>}
          {schema?.map(item => (
            <button
              key={item.name}
              onClick={() => { onSelectDatabase(dbName); onSelectTable(item.name) }}
              className={`flex items-center gap-2 px-2 py-1 text-xs rounded-md w-full transition-colors ${
                isActiveDb && activeTableName === item.name
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'hover:bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              <Table2 className="w-3 h-3 shrink-0" />
              <span className="truncate">{item.name}</span>
            </button>
          ))}
          {schema?.length === 0 && <span className="text-xs text-muted-foreground py-1 px-1">No tables found</span>}
        </div>
      )}
    </div>
  )
}

// ── ConnectionItem ────────────────────────────────────────────────────────────

function ConnectionItem({
  conn,
  activeConnectionId,
  activeDatabaseName,
  activeTableName,
  onSelectConnection,
  onSelectDatabase,
  onSelectTable,
  onEdit,
  onDelete
}: {
  conn: DBConnection
  activeConnectionId: string | null
  activeDatabaseName: string | null
  activeTableName: string | null
  onSelectConnection: (id: string) => void
  onSelectDatabase: (dbName: string) => void
  onSelectTable: (tableName: string) => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const { data: databases, isLoading } = useDatabases(expanded ? conn : null)
  const isActive = activeConnectionId === conn.id

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded(x => !x)
    onSelectConnection(conn.id)
  }

  return (
    <div className="flex flex-col group">
      <div className={`flex items-center justify-between px-2 py-1.5 text-sm rounded-md w-full transition-colors ${
        isActive && !expanded ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-secondary'
      }`}>
        <button onClick={handleToggle} className="flex items-center gap-1.5 flex-1 min-w-0">
          {expanded
            ? <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
            : <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
          }
          <Database className="w-4 h-4 shrink-0 text-blue-500" />
          <span className="truncate font-medium">{conn.name}</span>
        </button>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={e => { e.stopPropagation(); onEdit() }} className="p-1 hover:text-primary rounded-md">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete() }} className="p-1 hover:text-destructive rounded-md">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="ml-6 flex flex-col gap-0.5 mt-1 border-l border-border pl-2">
          {isLoading && <span className="text-xs text-muted-foreground py-1 px-1">Loading databases...</span>}
          {databases?.map(db => (
            <DatabaseItem
              key={db.name}
              dbName={db.name}
              conn={conn}
              isActiveConn={isActive}
              activeDatabaseName={activeDatabaseName}
              activeTableName={activeTableName}
              onSelectDatabase={onSelectDatabase}
              onSelectTable={onSelectTable}
            />
          ))}
          {databases?.length === 0 && (
            <span className="text-xs text-muted-foreground py-1 px-1">No databases found</span>
          )}
        </div>
      )}
    </div>
  )
}

// ── FolderItem ────────────────────────────────────────────────────────────────

function FolderItem({
  folder,
  allFolders,
  connections,
  activeConnectionId,
  activeDatabaseName,
  activeTableName,
  onSelectConnection,
  onSelectDatabase,
  onSelectTable,
  onEditConnection,
  onDeleteConnection,
  onEditFolder,
  onDeleteFolder
}: {
  folder: ConnectionFolder
  allFolders: ConnectionFolder[]
  connections: DBConnection[]
  activeConnectionId: string | null
  activeDatabaseName: string | null
  activeTableName: string | null
  onSelectConnection: (id: string) => void
  onSelectDatabase: (dbName: string) => void
  onSelectTable: (tableName: string) => void
  onEditConnection: (conn: DBConnection) => void
  onDeleteConnection: (conn: DBConnection) => void
  onEditFolder: (folder: ConnectionFolder) => void
  onDeleteFolder: (folder: ConnectionFolder) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const childFolders = allFolders.filter(f => f.parentId === folder.id)
  const folderConnections = connections.filter(c => c.folderId === folder.id)
  const hasChildren = childFolders.length > 0 || folderConnections.length > 0

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-2 py-1.5 text-sm rounded-md w-full transition-colors hover:bg-secondary group">
        <button className="flex items-center gap-1.5 flex-1 min-w-0" onClick={() => setExpanded(e => !e)}>
          {hasChildren
            ? expanded ? <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
            : <span className="w-4 h-4 shrink-0" />
          }
          {expanded
            ? <FolderOpen className="w-4 h-4 shrink-0 text-amber-400" />
            : <Folder className="w-4 h-4 shrink-0 text-amber-400" />
          }
          <span className="truncate font-medium text-foreground">{folder.name}</span>
        </button>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={e => { e.stopPropagation(); onEditFolder(folder) }} className="p-1 hover:text-primary rounded-md"><Edit2 className="w-3.5 h-3.5" /></button>
          <button onClick={e => { e.stopPropagation(); onDeleteFolder(folder) }} className="p-1 hover:text-destructive rounded-md"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {expanded && (
        <div className="ml-2 border-l border-border pl-1 flex flex-col gap-0.5 mt-0.5">
          {childFolders.map(child => (
            <FolderItem
              key={child.id}
              folder={child}
              allFolders={allFolders}
              connections={connections}
              activeConnectionId={activeConnectionId}
              activeDatabaseName={activeDatabaseName}
              activeTableName={activeTableName}
              onSelectConnection={onSelectConnection}
              onSelectDatabase={onSelectDatabase}
              onSelectTable={onSelectTable}
              onEditConnection={onEditConnection}
              onDeleteConnection={onDeleteConnection}
              onEditFolder={onEditFolder}
              onDeleteFolder={onDeleteFolder}
            />
          ))}
          {folderConnections.map(conn => (
            <ConnectionItem
              key={conn.id}
              conn={conn}
              activeConnectionId={activeConnectionId}
              activeDatabaseName={activeDatabaseName}
              activeTableName={activeTableName}
              onSelectConnection={onSelectConnection}
              onSelectDatabase={onSelectDatabase}
              onSelectTable={onSelectTable}
              onEdit={() => onEditConnection(conn)}
              onDelete={() => onDeleteConnection(conn)}
            />
          ))}
          {!hasChildren && <span className="text-xs text-muted-foreground px-2 py-1">Empty folder</span>}
        </div>
      )}
    </div>
  )
}

// ── ConnectionSidebar ─────────────────────────────────────────────────────────

export function ConnectionSidebar() {
  const {
    activeConnectionId, setActiveConnectionId,
    activeDatabaseName, setActiveDatabaseName,
    grids, activeTabId, addTab
  } = useAppStore()
  const activeGrid = grids.find(g => g.tabId === activeTabId)
  const activeTableName = activeGrid?.tableName || null

  const [isConnDialogOpen, setIsConnDialogOpen] = useState(false)
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false)
  const [editingConnection, setEditingConnection] = useState<DBConnection | undefined>()
  const [editingFolder, setEditingFolder] = useState<ConnectionFolder | undefined>()
  const [searchQuery, setSearchQuery] = useState('')

  // Resizable sidebar logic
  const [isResizing, setIsResizing] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebarWidth')
    return saved ? parseInt(saved, 10) : 256
  })

  const startResizing = useCallback(() => {
    setIsResizing(true)
  }, [])

  const stopResizing = useCallback(() => {
    setIsResizing(false)
  }, [])

  const resize = useCallback((mouseMoveEvent: MouseEvent) => {
    if (isResizing) {
      const newWidth = mouseMoveEvent.clientX
      if (newWidth >= 160 && newWidth <= 600) {
        setSidebarWidth(newWidth)
        localStorage.setItem('sidebarWidth', newWidth.toString())
      }
    }
  }, [isResizing])

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize)
      window.addEventListener('mouseup', stopResizing)
    } else {
      window.removeEventListener('mousemove', resize)
      window.removeEventListener('mouseup', stopResizing)
    }

    return () => {
      window.removeEventListener('mousemove', resize)
      window.removeEventListener('mouseup', stopResizing)
    }
  }, [isResizing, resize, stopResizing])

  const { data: connections = [] } = useConnections()
  const { data: folders = [] } = useFolders()
  const { mutateAsync: deleteConnection } = useDeleteConnection()
  const { mutateAsync: deleteFolder } = useDeleteFolder()

  const handleEditConn = (conn: DBConnection) => {
    setEditingConnection(conn)
    setIsConnDialogOpen(true)
  }

  const handleDeleteConn = async (conn: DBConnection) => {
    if (confirm(`Delete connection "${conn.name}"?`)) {
      await deleteConnection(conn.id)
      if (activeConnectionId === conn.id) {
        setActiveConnectionId(null)
      }
    }
  }

  const handleSelectDatabase = (dbName: string) => {
    setActiveDatabaseName(dbName)
  }

  const handleSelectTable = (tableName: string) => {
    addTab(tableName)
  }

  const handleEditFolder = (folder: ConnectionFolder) => {
    setEditingFolder(folder)
    setIsFolderDialogOpen(true)
  }

  const handleDeleteFolder = async (folder: ConnectionFolder) => {
    if (confirm(`Delete folder "${folder.name}"? Connections inside will move to root.`)) {
      await deleteFolder(folder.id)
    }
  }

  const handleCloseConnDialog = () => {
    setEditingConnection(undefined)
    setIsConnDialogOpen(false)
  }

  const handleCloseFolderDialog = () => {
    setEditingFolder(undefined)
    setIsFolderDialogOpen(false)
  }

  const isSearching = searchQuery.trim().length > 0
  const filteredConnections = isSearching
    ? connections.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : connections

  const rootFolders = folders.filter(f => !f.parentId)
  const rootConnections = connections.filter(c => !c.folderId)

  return (
    <aside
      className="border-r border-border bg-card flex flex-col h-full relative group/sidebar"
      style={{ width: `${sidebarWidth}px` }}
    >
      {/* Resizer handle */}
      <div
        onMouseDown={startResizing}
        className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/30 transition-colors z-10 ${
          isResizing ? 'bg-primary/50' : ''
        }`}
      />
      {/* Header */}
      <div className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0">
        <h2 className="font-semibold text-sm">Connections</h2>
        <div className="flex items-center gap-1">
          <button onClick={() => setIsFolderDialogOpen(true)} title="New Folder" className="p-1 hover:bg-secondary rounded-md transition-colors">
            <FolderPlus className="w-4 h-4" />
          </button>
          <button onClick={() => setIsConnDialogOpen(true)} title="New Connection" className="p-1 hover:bg-secondary rounded-md transition-colors">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-border shrink-0">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search connections..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-8 pl-8 pr-3 text-sm bg-secondary/50 border border-border rounded-md focus:outline-none focus:border-primary/50 transition-colors"
          />
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto p-2">
        {isSearching ? (
          filteredConnections.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground mt-10">No matching connections.</div>
          ) : (
            <div className="flex flex-col gap-1">
              {filteredConnections.map(conn => (
                <ConnectionItem
                  key={conn.id}
                  conn={conn}
                  activeConnectionId={activeConnectionId}
                  activeDatabaseName={activeDatabaseName}
                  activeTableName={activeTableName}
                  onSelectConnection={setActiveConnectionId}
                  onSelectDatabase={handleSelectDatabase}
                  onSelectTable={handleSelectTable}
                  onEdit={() => handleEditConn(conn)}
                  onDelete={() => handleDeleteConn(conn)}
                />
              ))}
            </div>
          )
        ) : (
          rootFolders.length === 0 && rootConnections.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground mt-10">No connections found.</div>
          ) : (
            <div className="flex flex-col gap-1">
              {rootFolders.map(folder => (
                <FolderItem
                  key={folder.id}
                  folder={folder}
                  allFolders={folders}
                  connections={connections}
                  activeConnectionId={activeConnectionId}
                  activeDatabaseName={activeDatabaseName}
                  activeTableName={activeTableName}
                  onSelectConnection={setActiveConnectionId}
                  onSelectDatabase={handleSelectDatabase}
                  onSelectTable={handleSelectTable}
                  onEditConnection={handleEditConn}
                  onDeleteConnection={handleDeleteConn}
                  onEditFolder={handleEditFolder}
                  onDeleteFolder={handleDeleteFolder}
                />
              ))}
              {rootConnections.map(conn => (
                <ConnectionItem
                  key={conn.id}
                  conn={conn}
                  activeConnectionId={activeConnectionId}
                  activeDatabaseName={activeDatabaseName}
                  activeTableName={activeTableName}
                  onSelectConnection={setActiveConnectionId}
                  onSelectDatabase={handleSelectDatabase}
                  onSelectTable={handleSelectTable}
                  onEdit={() => handleEditConn(conn)}
                  onDelete={() => handleDeleteConn(conn)}
                />
              ))}
            </div>
          )
        )}
      </div>

      {isConnDialogOpen && (
        <ConnectionDialog onClose={handleCloseConnDialog} existingConnection={editingConnection} folders={folders} />
      )}
      {isFolderDialogOpen && (
        <FolderDialog folders={folders} existingFolder={editingFolder} onClose={handleCloseFolderDialog} />
      )}
    </aside>
  )
}
