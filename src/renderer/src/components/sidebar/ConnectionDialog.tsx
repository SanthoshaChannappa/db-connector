import { useState } from 'react'
import type { DBConnection, ConnectionFolder } from '../../store'
import { useSaveConnection, useTestConnection } from '../../hooks/useDatabase'

interface ConnectionDialogProps {
  onClose: () => void
  existingConnection?: DBConnection
  folders?: ConnectionFolder[]
}

export function ConnectionDialog({ onClose, existingConnection, folders = [] }: ConnectionDialogProps) {
  const [formData, setFormData] = useState<Partial<DBConnection>>(
    existingConnection || {
      name: '',
      driver: 'pg',
      host: 'localhost',
      port: 5432,
      user: '',
      password: '',
      database: '',
      ssl: false,
      folderId: undefined
    }
  )
  const [testStatus, setTestStatus] = useState<{ loading: boolean; success?: boolean; error?: string }>({ loading: false })

  const { mutateAsync: saveConnection } = useSaveConnection()
  const { mutateAsync: testConnection } = useTestConnection()

  const generateId = () => Math.random().toString(36).substr(2, 9)

  const handleTest = async () => {
    setTestStatus({ loading: true })
    try {
      await testConnection(formData as DBConnection)
      setTestStatus({ loading: false, success: true })
    } catch (err: any) {
      setTestStatus({ loading: false, success: false, error: err.message })
    }
  }

  const handleSave = async () => {
    if (!formData.name || !formData.driver) return
    const conn: DBConnection = {
      ...(formData as DBConnection),
      id: formData.id || generateId()
    }
    await saveConnection(conn)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-md rounded-lg shadow-xl border border-border p-6 flex flex-col gap-5">
        <h3 className="text-lg font-semibold">{existingConnection ? 'Edit Connection' : 'New Connection'}</h3>
        
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Name
            <input 
              className="px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} 
              placeholder="My Database"
            />
          </label>
          
          <label className="flex flex-col gap-1 text-sm font-medium">
            Driver
            <select 
              className="px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              value={formData.driver} onChange={e => setFormData({ ...formData, driver: e.target.value as any })}
            >
              <option value="pg">PostgreSQL</option>
              <option value="mysql">MySQL</option>
              <option value="mssql">SQL Server (Tedious)</option>
              <option value="mongodb">MongoDB</option>
              <option value="sqlite">SQLite (File / Memory)</option>
            </select>
          </label>

          <div className="grid grid-cols-3 gap-4">
            <label className="col-span-2 flex flex-col gap-1 text-sm font-medium">
              Host / Path
              <input 
                className="px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                value={formData.host || ''} onChange={e => setFormData({ ...formData, host: e.target.value })} 
                placeholder="localhost"
              />
            </label>
            <label className="col-span-1 flex flex-col gap-1 text-sm font-medium">
              Port
              <input 
                type="number"
                className="px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                value={formData.port || ''} onChange={e => setFormData({ ...formData, port: parseInt(e.target.value) || undefined })} 
                placeholder="5432"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Database
            <input 
              className="px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              value={formData.database || ''} onChange={e => setFormData({ ...formData, database: e.target.value })} 
              placeholder="postgres"
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm font-medium">
              User
              <input 
                className="px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                value={formData.user || ''} onChange={e => setFormData({ ...formData, user: e.target.value })} 
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Password
              <input 
                type="password"
                className="px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                value={formData.password || ''} onChange={e => setFormData({ ...formData, password: e.target.value })} 
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Folder
            <select
              className="px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              value={formData.folderId ?? ''}
              onChange={e => setFormData({ ...formData, folderId: e.target.value || undefined })}
            >
              <option value="">— No Folder —</option>
              {folders.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-border text-primary focus:ring-ring"
              checked={formData.ssl || false}
              onChange={e => setFormData({ ...formData, ssl: e.target.checked })}
            />
            Use SSL/TLS (Required for RDS Proxy)
          </label>
        </div>

        {testStatus.error && <p className="text-destructive text-sm">{testStatus.error}</p>}
        {testStatus.success && <p className="text-green-500 text-sm">Connection successful!</p>}

        <div className="flex justify-between mt-2 pt-4 border-t border-border">
          <button 
            type="button"
            onClick={handleTest}
            disabled={testStatus.loading}
            className="px-4 py-2 border border-border rounded-md hover:bg-secondary text-sm font-medium transition-colors"
          >
            {testStatus.loading ? 'Testing...' : 'Test Connection'}
          </button>
          
          <div className="flex gap-2">
            <button 
              onClick={onClose}
              className="px-4 py-2 rounded-md hover:bg-secondary text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 text-sm font-medium transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
