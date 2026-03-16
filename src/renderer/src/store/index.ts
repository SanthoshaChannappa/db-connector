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

export interface GridState {
  id: string
  tableName: string
  filters: QueryFilter[]
  sortState: SortState | null
  page: number
  pageSize: number
  isCollapsed: boolean
}

interface AppState {
  activeConnectionId: string | null
  activeDatabaseName: string | null
  grids: GridState[]
  
  setActiveConnectionId: (id: string | null) => void
  setActiveDatabaseName: (name: string | null) => void
  
  // Grid actions
  setPrimaryTable: (tableName: string) => void
  pushGrid: (tableName: string, filter: QueryFilter) => void
  removeGrid: (id: string) => void
  toggleGridCollapse: (id: string) => void
  updateGrid: (id: string, updates: Partial<GridState>) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeConnectionId: null,
  activeDatabaseName: null,
  grids: [],

  setActiveConnectionId: (id) => set({ 
    activeConnectionId: id, 
    activeDatabaseName: null, 
    grids: [] 
  }),

  setActiveDatabaseName: (name) => set({ 
    activeDatabaseName: name, 
    grids: [] 
  }),

  setPrimaryTable: (tableName) => set({
    grids: [{
      id: 'primary',
      tableName,
      filters: [],
      sortState: null,
      page: 1,
      pageSize: 50,
      isCollapsed: false
    }]
  }),

  pushGrid: (tableName, filter) => set((state) => ({
    grids: [
      ...state.grids,
      {
        id: Math.random().toString(36).substr(2, 9),
        tableName,
        filters: [filter],
        sortState: null,
        page: 1,
        pageSize: 25, // Navigated grids might be smaller/defaulted
        isCollapsed: false
      }
    ]
  })),

  removeGrid: (id) => set((state) => ({
    grids: state.grids.filter(g => g.id !== id)
  })),

  toggleGridCollapse: (id) => set((state) => ({
    grids: state.grids.map(g => g.id === id ? { ...g, isCollapsed: !g.isCollapsed } : g)
  })),

  updateGrid: (id, updates) => set((state) => ({
    grids: state.grids.map(g => g.id === id ? { ...g, ...updates } : g)
  }))
}))
