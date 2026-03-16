import { create } from 'zustand'

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

export interface QueryFilter {
  column: string
  operator: string
  value: string
}

export interface SortState {
  column: string
  direction: 'asc' | 'desc'
}

interface AppState {
  activeConnectionId: string | null
  activeDatabaseName: string | null
  activeTableName: string | null
  setActiveConnectionId: (id: string | null) => void
  setActiveDatabaseName: (name: string | null) => void
  setActiveTableName: (name: string | null) => void
  
  page: number
  pageSize: number
  setPage: (page: number) => void
  setPageSize: (pageSize: number) => void
  
  filters: QueryFilter[]
  setFilters: (filters: QueryFilter[]) => void
  
  sortState: SortState | null
  setSortState: (sort: SortState | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeConnectionId: null,
  activeDatabaseName: null,
  activeTableName: null,
  page: 1,
  pageSize: 50,
  setActiveConnectionId: (id) => set({ activeConnectionId: id, activeDatabaseName: null, activeTableName: null, filters: [], sortState: null, page: 1 }),
  setActiveDatabaseName: (name) => set({ activeDatabaseName: name, activeTableName: null, filters: [], sortState: null, page: 1 }),
  setActiveTableName: (name) => set({ activeTableName: name, filters: [], sortState: null, page: 1 }),
  
  setPage: (page) => set({ page }),
  setPageSize: (pageSize) => set({ pageSize, page: 1 }),
  
  filters: [],
  setFilters: (filters) => set({ filters }),
  
  sortState: null,
  setSortState: (sortState) => set({ sortState })
}))
