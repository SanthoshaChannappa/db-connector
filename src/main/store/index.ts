import StoreImport from 'electron-store'

// Handle default export inconsistency in CJS/ESM
const Store = (StoreImport as any).default || StoreImport

export interface DBConnection {
  id: string
  name: string
  driver: 'pg' | 'mysql' | 'mssql' | 'mongodb' | 'sqlite'
  host?: string
  port?: number
  user?: string
  password?: string
  database?: string
  folderId?: string
}

export interface ConnectionFolder {
  id: string
  name: string
  parentId?: string
}

const store = new Store({
  defaults: {
    connections: [] as DBConnection[],
    folders: [] as ConnectionFolder[]
  }
}) as { get: (key: string) => any; set: (key: string, value: any) => void }

// ── Connections ──────────────────────────────────────────────────────────────

export function getConnections(): DBConnection[] {
  return store.get('connections')
}

export function saveConnection(conn: DBConnection): DBConnection[] {
  const connections = store.get('connections')
  const existingIndex = connections.findIndex(c => c.id === conn.id)
  if (existingIndex > -1) {
    connections[existingIndex] = conn
  } else {
    connections.push(conn)
  }
  store.set('connections', connections)
  return connections
}

export function deleteConnection(id: string): DBConnection[] {
  const connections = store.get('connections').filter(c => c.id !== id)
  store.set('connections', connections)
  return connections
}

// ── Folders ──────────────────────────────────────────────────────────────────

export function getFolders(): ConnectionFolder[] {
  return store.get('folders')
}

export function saveFolder(folder: ConnectionFolder): ConnectionFolder[] {
  const folders = store.get('folders')
  const existingIndex = folders.findIndex(f => f.id === folder.id)
  if (existingIndex > -1) {
    folders[existingIndex] = folder
  } else {
    folders.push(folder)
  }
  store.set('folders', folders)
  return folders
}

export function deleteFolder(id: string): { folders: ConnectionFolder[]; connections: DBConnection[] } {
  // Remove the folder (and all descendant folders recursively)
  const allFolders = store.get('folders')
  const folderIdsToRemove = new Set<string>()

  const collect = (folderId: string) => {
    folderIdsToRemove.add(folderId)
    allFolders.filter(f => f.parentId === folderId).forEach(f => collect(f.id))
  }
  collect(id)

  const folders = allFolders.filter(f => !folderIdsToRemove.has(f.id))
  store.set('folders', folders)

  // Move orphaned connections back to root
  const connections = store.get('connections').map(c =>
    c.folderId && folderIdsToRemove.has(c.folderId) ? { ...c, folderId: undefined } : c
  )
  store.set('connections', connections)

  return { folders, connections }
}
