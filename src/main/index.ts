import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { getConnections, saveConnection, deleteConnection, getFolders, saveFolder, deleteFolder } from './store'
import { testConnection, fetchSchema, executeQuery, fetchDatabases, fetchTableDetails } from './db'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC endpoints
  ipcMain.handle('get-connections', () => getConnections())
  ipcMain.handle('save-connection', (_, conn) => saveConnection(conn))
  ipcMain.handle('delete-connection', (_, id) => deleteConnection(id))

  ipcMain.handle('get-folders', () => getFolders())
  ipcMain.handle('save-folder', (_, folder) => saveFolder(folder))
  ipcMain.handle('delete-folder', (_, id) => deleteFolder(id))

  ipcMain.handle('test-connection', async (_, conn) => await testConnection(conn))
  ipcMain.handle('fetch-databases', async (_, conn) => await fetchDatabases(conn))
  ipcMain.handle('fetch-schema', async (_, conn) => await fetchSchema(conn))
  ipcMain.handle('fetch-table-details', async (_, conn, tableName) => await fetchTableDetails(conn, tableName))
  ipcMain.handle('execute-query', async (_, conn, query, values) => await executeQuery(conn, query, values))

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
