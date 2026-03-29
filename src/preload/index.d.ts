import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      testConnection: (conn: any) => Promise<boolean>
      fetchDatabases: (conn: any) => Promise<any[]>
      fetchSchema: (conn: any) => Promise<any[]>
      fetchTableDetails: (conn: any, tableName: string) => Promise<any>
      executeQuery: (conn: any, query: string, values?: any[]) => Promise<any>
      insertRow: (conn: any, tableName: string, row: any) => Promise<boolean>
      updateRow: (
        conn: any,
        tableName: string,
        pkKeys: string[],
        oldRow: any,
        newRow: any
      ) => Promise<boolean>
      deleteRow: (
        conn: any,
        tableName: string,
        pkKeys: string[],
        row: any,
        cascade: boolean
      ) => Promise<boolean>
    }
  }
}
