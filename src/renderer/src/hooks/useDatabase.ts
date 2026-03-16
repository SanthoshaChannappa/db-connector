import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { DBConnection, ConnectionFolder } from '../store'

export function useConnections() {
  return useQuery<DBConnection[]>({
    queryKey: ['connections'],
    queryFn: () => window.electron.ipcRenderer.invoke('get-connections')
  })
}

export function useSaveConnection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (conn: DBConnection) => window.electron.ipcRenderer.invoke('save-connection', conn),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['connections'] })
  })
}

export function useDeleteConnection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.electron.ipcRenderer.invoke('delete-connection', id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['connections'] })
  })
}

export function useTestConnection() {
  return useMutation({
    mutationFn: (conn: DBConnection) => window.electron.ipcRenderer.invoke('test-connection', conn)
  })
}

export function useDatabases(conn: DBConnection | null) {
  return useQuery<{ name: string; type: string }[]>({
    queryKey: ['databases', conn?.id],
    queryFn: () => window.electron.ipcRenderer.invoke('fetch-databases', conn),
    enabled: !!conn
  })
}

export function useSchema(conn: DBConnection | null) {
  return useQuery<{ name: string; type: string }[]>({
    queryKey: ['schema', conn?.id],
    queryFn: () => window.electron.ipcRenderer.invoke('fetch-schema', conn),
    enabled: !!conn
  })
}

export function useQueryData(conn: DBConnection | null, query: string, values?: any[]) {
  return useQuery<{ rows: any[]; fields: { name: string }[] }>({
    queryKey: ['query', conn?.id, query, values],
    queryFn: () => window.electron.ipcRenderer.invoke('execute-query', conn, query, values),
    enabled: !!conn && !!query
  })
}

// ── Folder hooks ─────────────────────────────────────────────────────────────

export function useFolders() {
  return useQuery<ConnectionFolder[]>({
    queryKey: ['folders'],
    queryFn: () => window.electron.ipcRenderer.invoke('get-folders')
  })
}

export function useSaveFolder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (folder: ConnectionFolder) =>
      window.electron.ipcRenderer.invoke('save-folder', folder),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['folders'] })
  })
}

export function useDeleteFolder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => window.electron.ipcRenderer.invoke('delete-folder', id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      // Also refresh connections since deleting a folder resets orphaned connections
      queryClient.invalidateQueries({ queryKey: ['connections'] })
    }
  })
}
