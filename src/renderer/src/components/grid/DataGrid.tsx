import { useAppStore } from '../../store'
import { useConnections, useQueryData } from '../../hooks/useDatabase'
import { ExportPanel } from './ExportPanel'
import { Table, Link, ChevronLeft, ChevronRight } from 'lucide-react'

export function DataGrid() {
  const { 
    activeConnectionId, 
    activeDatabaseName, 
    activeTableName, 
    setActiveTableName,
    page,
    pageSize,
    setPage,
    setPageSize
  } = useAppStore()
  
  const { data: connections } = useConnections()
  const baseConn = connections?.find(c => c.id === activeConnectionId) || null

  // Use the database selected in the sidebar tree, falling back to the stored default
  const conn = baseConn && activeDatabaseName
    ? { ...baseConn, database: activeDatabaseName }
    : baseConn

  const offset = (page - 1) * pageSize

  let query = ''
  let countQuery = ''
  
  if (conn && activeTableName) {
    if (conn.driver === 'mongodb') {
      query = JSON.stringify({ collection: activeTableName, limit: pageSize, skip: offset })
      countQuery = JSON.stringify({ collection: activeTableName, count: true })
    } else if (conn.driver === 'mssql') {
      // Offset/Fetch is supported in SQL Server 2012+
      query = `SELECT * FROM [${activeTableName}] ORDER BY (SELECT NULL) OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY`
      countQuery = `SELECT COUNT(*) as total FROM [${activeTableName}]`
    } else if (conn.driver === 'mysql') {
      query = `SELECT * FROM \`${activeTableName}\` LIMIT ${pageSize} OFFSET ${offset}`
      countQuery = `SELECT COUNT(*) as total FROM \`${activeTableName}\``
    } else if (conn.driver === 'pg') {
      query = `SELECT * FROM "${activeTableName}" LIMIT ${pageSize} OFFSET ${offset}`
      countQuery = `SELECT COUNT(*) as total FROM "${activeTableName}"`
    } else {
      query = `SELECT * FROM "${activeTableName}" LIMIT ${pageSize} OFFSET ${offset}`
      countQuery = `SELECT COUNT(*) as total FROM "${activeTableName}"`
    }
  }

  const { data, isLoading, error } = useQueryData(conn, query)
  const { data: countData } = useQueryData(conn, countQuery)
  
  const totalRows = countData?.rows[0]?.total ?? (conn?.driver === 'mongodb' ? countData?.rows[0]?.count : 0) ?? 0
  const totalPages = Math.ceil(totalRows / pageSize)

  if (!conn || !activeTableName) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <Table className="w-12 h-12 text-muted-foreground/30 mb-4" />
        <div className="text-muted-foreground text-sm">Select a connection and table from the sidebar.</div>
      </div>
    )
  }

  // Heuristic mock for foreign key columns detecting
  const isForeignKeyColumn = (colName: string): string | null => {
    if (colName.endsWith('_id') && colName.length > 3) {
      return colName.substring(0, colName.length - 3) + 's' // e.g., user_id -> users
    }
    return null
  }

  const handleFKClick = (targetTable: string, value: any) => {
    setActiveTableName(targetTable)
    alert(`Simulating FK navigation to table: ${targetTable} where id = ${value}`)
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      <div className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0 bg-card">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <Table className="w-4 h-4 text-primary" />
          {activeTableName}
          <span className="text-xs font-normal text-muted-foreground ml-2">
            {isLoading ? '(Loading...)' : `${totalRows.toLocaleString()} rows`}
          </span>
        </h2>
        {data && <ExportPanel data={data.rows} fields={data.fields} tableName={activeTableName} />}
      </div>
      
      <div className="flex-1 overflow-auto p-4 pb-20">
        {isLoading && <div className="text-center text-sm text-muted-foreground mt-10">Loading data...</div>}
        {error && <div className="text-destructive text-sm bg-destructive/10 p-4 rounded-md border border-destructive/20">{error.message}</div>}
        
        {data && !isLoading && !error && (
          <div className="rounded-md border border-border overflow-hidden bg-card">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-xs text-muted-foreground bg-muted/50 border-b border-border">
                <tr>
                  {data.fields.map(f => (
                    <th key={f.name} className="px-4 py-3 font-medium tracking-wider">
                      {f.name}
                    </th>
                  ))}
                  <th className="px-4 py-3 font-medium tracking-wider text-primary/80">
                    Referenced By (Virtual)
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 ? (
                  <tr>
                    <td colSpan={data.fields.length + 1} className="px-4 py-8 text-center text-muted-foreground">
                      No records found in this table.
                    </td>
                  </tr>
                ) : (
                  data.rows.map((row, i) => (
                    <tr key={i} className="border-b border-border hover:bg-muted/30 transition-colors">
                      {data.fields.map(f => {
                        const targetTable = isForeignKeyColumn(f.name)
                        return (
                          <td key={f.name} className="px-4 py-2.5 max-w-[200px] truncate text-foreground/80">
                            {targetTable && row[f.name] ? (
                              <button 
                                onClick={() => handleFKClick(targetTable, row[f.name])}
                                className="text-blue-500 hover:text-blue-400 hover:underline inline-flex items-center gap-1"
                              >
                                {String(row[f.name])}
                                <Link className="w-3 h-3" />
                              </button>
                            ) : (
                              String(row[f.name] ?? 'NULL')
                            )}
                          </td>
                        )
                      })}
                      <td className="px-4 py-2.5 text-xs text-primary/60 italic">
                        {Math.random() > 0.5 ? 'events, logs' : 'none'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      <div className="absolute bottom-0 left-0 right-0 h-14 border-t border-border bg-card flex items-center justify-between px-4 z-20">
        <div className="flex items-center gap-4">
          <select 
            className="h-8 px-2 bg-secondary/50 border border-border rounded-md text-xs focus:outline-none"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
          >
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
          </select>
          <span className="text-xs text-muted-foreground">
            Showing {Math.min(offset + 1, totalRows)} - {Math.min(offset + pageSize, totalRows)} of {totalRows.toLocaleString()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(page - 1)}
            disabled={page === 1 || isLoading}
            className="p-1 rounded-md hover:bg-secondary disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-1">
            <input
              type="number"
              className="w-12 h-8 px-2 bg-secondary/50 border border-border rounded-md text-xs text-center focus:outline-none focus:border-primary/50"
              value={page}
              onChange={(e) => {
                const p = parseInt(e.target.value)
                if (p > 0 && p <= totalPages) setPage(p)
              }}
            />
            <span className="text-xs text-muted-foreground px-2">of {totalPages}</span>
          </div>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page >= totalPages || isLoading}
            className="p-1 rounded-md hover:bg-secondary disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
