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
  ssl?: boolean
  integratedSecurity?: boolean
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

export interface LogEntry {
  timestamp: string
  source: 'main' | 'renderer'
  level: 'log' | 'info' | 'warn' | 'error'
  message: string
}

export interface Tab {
  id: string
  title: string
  type: 'table' | 'query'
  connectionId: string
  databaseName?: string
  queryText?: string
}

export interface GridState {
  id: string
  tabId: string
  connectionId: string
  databaseName: string | null
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
  activeTabId: string | null
  tabs: Tab[]
  grids: GridState[]
  sidebarOpen: boolean
  logs: LogEntry[]
  logViewerOpen: boolean
  logViewerHeight: number

  setActiveConnectionId: (id: string | null) => void
  setActiveDatabaseName: (name: string | null) => void
  setActiveTabId: (id: string | null) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void

  // Log actions
  addLog: (entry: LogEntry) => void
  clearLogs: () => void
  setLogViewerOpen: (open: boolean) => void
  toggleLogViewer: () => void
  setLogViewerHeight: (height: number) => void

  // Tab actions
  addTab: (connectionId: string, databaseName: string | null, tableName: string) => void
  removeTab: (id: string) => void
  renameTab: (id: string, title: string) => void
  updateTab: (id: string, updates: Partial<Tab>) => void
  addQueryTab: (connectionId: string, databaseName: string, initialQuery?: string) => void

  // Grid actions
  pushGrid: (tableName: string, filter: QueryFilter, sourceGridId: string) => void
  removeGrid: (id: string) => void
  toggleGridCollapse: (id: string) => void
  updateGrid: (id: string, updates: Partial<GridState>) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeConnectionId: null,
  activeDatabaseName: null,
  activeTabId: null,
  tabs: [],
  grids: [],
  sidebarOpen: true,
  logs: [],
  logViewerOpen: false,
  logViewerHeight: 256,

  addLog: (entry) =>
    set((state) => ({
      logs: [...state.logs.slice(-999), entry] // Keep last 1000 logs
    })),

  clearLogs: () => set({ logs: [] }),

  setLogViewerOpen: (open) => set({ logViewerOpen: open }),
  toggleLogViewer: () => set((state) => ({ logViewerOpen: !state.logViewerOpen })),
  setLogViewerHeight: (height) => set({ logViewerHeight: height }),

  setActiveConnectionId: (id) =>
    set({
      activeConnectionId: id,
      activeDatabaseName: null
    }),

  setActiveDatabaseName: (name) =>
    set({
      activeDatabaseName: name
    }),

  setActiveTabId: (id) => set({ activeTabId: id }),

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  addTab: (connectionId, databaseName, tableName) =>
    set((state) => {
      const tabId = Math.random().toString(36).substr(2, 9)
      const gridId = Math.random().toString(36).substr(2, 9)
      return {
        tabs: [
          ...state.tabs,
          {
            id: tabId,
            title: tableName,
            type: 'table',
            connectionId,
            databaseName: databaseName || undefined
          }
        ],
        grids: [
          ...state.grids,
          {
            id: gridId,
            tabId,
            connectionId,
            databaseName,
            tableName,
            filters: [],
            sortState: null,
            page: 1,
            pageSize: 10,
            isCollapsed: false
          }
        ],
        activeTabId: tabId
      }
    }),

  addQueryTab: (connectionId, databaseName, initialQuery) =>
    set((state) => {
      const tabId = Math.random().toString(36).substr(2, 9)
      return {
        tabs: [
          ...state.tabs,
          {
            id: tabId,
            title: `Query: ${databaseName}`,
            type: 'query',
            connectionId,
            databaseName,
            queryText: initialQuery || '-- Write your query here\nSELECT * FROM ...'
          }
        ],
        activeTabId: tabId
      }
    }),

  removeTab: (id) =>
    set((state) => {
      const newTabs = state.tabs.filter((t) => t.id !== id)
      const newGrids = state.grids.filter((g) => g.tabId !== id)
      let newActiveTabId = state.activeTabId
      if (state.activeTabId === id) {
        newActiveTabId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null
      }
      return {
        tabs: newTabs,
        grids: newGrids,
        activeTabId: newActiveTabId
      }
    }),

  renameTab: (id, title) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, title } : t))
    })),

  updateTab: (id, updates) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, ...updates } : t))
    })),

  pushGrid: (tableName, filter, sourceGridId) =>
    set((state) => {
      const sourceGrid = state.grids.find((g) => g.id === sourceGridId)
      if (!sourceGrid) return state

      const gridId = Math.random().toString(36).substr(2, 9)
      return {
        grids: [
          ...state.grids,
          {
            id: gridId,
            tabId: sourceGrid.tabId,
            connectionId: sourceGrid.connectionId,
            databaseName: sourceGrid.databaseName,
            tableName,
            filters: [filter],
            sortState: null,
            page: 1,
            pageSize: 10,
            isCollapsed: false
          }
        ]
      }
    }),

  removeGrid: (id) =>
    set((state) => {
      const newGrids = state.grids.filter((g) => g.id !== id)
      return {
        grids: newGrids
      }
    }),

  toggleGridCollapse: (id) =>
    set((state) => ({
      grids: state.grids.map((g) => (g.id === id ? { ...g, isCollapsed: !g.isCollapsed } : g))
    })),

  updateGrid: (id, updates) =>
    set((state) => ({
      grids: state.grids.map((g) => (g.id === id ? { ...g, ...updates } : g))
    }))
}))
