import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  testConnection: (conn) => ipcRenderer.invoke('test-connection', conn),
  fetchDatabases: (conn) => ipcRenderer.invoke('fetch-databases', conn),
  fetchSchema: (conn) => ipcRenderer.invoke('fetch-schema', conn),
  fetchTableDetails: (conn, tableName) =>
    ipcRenderer.invoke('fetch-table-details', conn, tableName),
  executeQuery: (conn, query, values) => ipcRenderer.invoke('execute-query', conn, query, values),
  insertRow: (conn, tableName, row) => ipcRenderer.invoke('insert-row', conn, tableName, row),
  updateRow: (conn, tableName, pkKeys, oldRow, newRow) =>
    ipcRenderer.invoke('update-row', conn, tableName, pkKeys, oldRow, newRow),
  deleteRow: (conn, tableName, pkKeys, row, cascade) =>
    ipcRenderer.invoke('delete-row', conn, tableName, pkKeys, row, cascade),
  onMainLog: (callback) => ipcRenderer.on('main-log', (_event, value) => callback(value)),
  getAppVersion: () => ipcRenderer.invoke('get-app-version')
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
