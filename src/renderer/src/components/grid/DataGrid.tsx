import { useAppStore } from '../../store'
import { useConnections, useQueryData, useTableDetails } from '../../hooks/useDatabase'
import { ExportPanel } from './ExportPanel'
import { Table, Link as LinkIcon, ChevronLeft, ChevronRight, ExternalLink, ChevronDown, ChevronUp, X } from 'lucide-react'

interface DataGridProps {
  gridId: string
}

export function DataGrid({ gridId }: DataGridProps) {
  const { 
    activeConnectionId, 
    activeDatabaseName, 
    grids,
    pushGrid,
    removeGrid,
    toggleGridCollapse,
    updateGrid
  } = useAppStore()
  
  const grid = grids.find(g => g.id === gridId)
  if (!grid) return null

  const { tableName: activeTableName, filters, sortState, page, pageSize, isCollapsed } = grid

  const { data: connections } = useConnections()
  const baseConn = connections?.find(c => c.id === activeConnectionId) || null

  const conn = baseConn && activeDatabaseName
    ? { ...baseConn, database: activeDatabaseName }
    : baseConn

  const offset = (page - 1) * pageSize

  // Fetch Table Metadata (PKs, FKs, Dependent Tables)
  const { data: meta } = useTableDetails(conn, activeTableName)

  let query = ''
  let countQuery = ''
  let whereClause = ''

  if (conn && activeTableName) {
    if (filters.length > 0) {
      const parts = filters.map(f => {
        let val = f.value
        if (typeof val === 'string' && !val.startsWith("'")) {
          val = `'${val}'`
        }
        return `"${f.column}" ${f.operator} ${val}`
      })
      whereClause = ` WHERE ${parts.join(' AND ')}`
    }

    if (conn.driver === 'mongodb') {
      query = JSON.stringify({ collection: activeTableName, limit: pageSize, skip: offset })
      countQuery = JSON.stringify({ collection: activeTableName, count: true })
    } else {
      const orderBy = sortState ? ` ORDER BY "${sortState.column}" ${sortState.direction}` : ' ORDER BY (SELECT NULL)'
      
      if (conn.driver === 'mssql') {
        const mssqlWhere = whereClause.replace(/"/g, '[').replace(/"/g, ']')
        query = `SELECT * FROM [${activeTableName}]${mssqlWhere}${orderBy} OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY`
        countQuery = `SELECT COUNT(*) as total FROM [${activeTableName}]${mssqlWhere}`
      } else if (conn.driver === 'mysql') {
        const mysqlWhere = whereClause.replace(/"/g, '`')
        const mysqlOrder = orderBy.replace(/"/g, '`')
        query = `SELECT * FROM \`${activeTableName}\`${mysqlWhere}${mysqlOrder} LIMIT ${pageSize} OFFSET ${offset}`
        countQuery = `SELECT COUNT(*) as total FROM \`${activeTableName}\`${mysqlWhere}`
      } else {
        query = `SELECT * FROM "${activeTableName}"${whereClause}${orderBy} LIMIT ${pageSize} OFFSET ${offset}`
        countQuery = `SELECT COUNT(*) as total FROM "${activeTableName}"${whereClause}`
      }
    }
  }

  const { data, isLoading, error } = useQueryData(conn, query)
  const { data: countData } = useQueryData(conn, countQuery)
  
  const totalRows = countData?.rows[0]?.total ?? (conn?.driver === 'mongodb' ? countData?.rows[0]?.count : 0) ?? 0
  const totalPages = Math.ceil(totalRows / pageSize)

  const handleFKClick = (targetTable: string, column: string, value: any) => {
    pushGrid(targetTable, { column, operator: '=', value: String(value) })
  }

  const handleDependentClick = (targetTable: string, row: any) => {
    const pkColumn = meta?.primaryKeys[0]
    if (pkColumn) {
      pushGrid(targetTable, { column: pkColumn, operator: '=', value: String(row[pkColumn]) })
    }
  }

  const setPage = (p: number) => updateGrid(gridId, { page: p })
  const setPageSize = (s: number) => updateGrid(gridId, { pageSize: s, page: 1 })

  return (
    <div className={`flex flex-col rounded-lg border border-border bg-card shadow-sm transition-all duration-200`}>
      {/* Header */}
      <div className="h-14 border-b border-border flex items-center justify-between px-4 shrink-0 bg-muted/30">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => toggleGridCollapse(gridId)}
            className="p-1 hover:bg-secondary rounded-md transition-colors text-muted-foreground"
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          
          <div className="flex flex-col">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Table className="w-4 h-4 text-primary" />
              {activeTableName}
              <span className="text-xs font-normal text-muted-foreground">
                {isLoading ? '(Loading...)' : `${totalRows.toLocaleString()} rows`}
              </span>
            </h2>
            {filters.length > 0 && (
              <div className="text-[10px] text-primary font-medium flex items-center gap-1">
                Filter: {filters[0].column} {filters[0].operator} {filters[0].value}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {!isCollapsed && data && <ExportPanel data={data.rows} fields={data.fields} tableName={activeTableName} />}
          {gridId !== 'primary' && (
            <button 
              onClick={() => removeGrid(gridId)}
              className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-md transition-colors text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      
      {!isCollapsed && (
        <>
          <div className="p-4">
            {isLoading && <div className="text-center text-sm text-muted-foreground py-10">Loading data...</div>}
            {error && <div className="text-destructive text-sm bg-destructive/10 p-4 rounded-md border border-destructive/20">{error.message}</div>}
            
            {data && !isLoading && !error && (
              <div className="rounded-md border border-border overflow-x-auto bg-background">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="text-xs text-muted-foreground bg-muted/50 border-b border-border">
                    <tr>
                      {data.fields.map(f => (
                        <th key={f.name} className="px-4 py-3 font-medium tracking-wider">
                          {f.name}
                        </th>
                      ))}
                      {(meta?.dependentTables?.length ?? 0) > 0 && (
                        <th className="px-4 py-3 font-medium tracking-wider text-primary/80 border-l border-border bg-primary/5 sticky right-0 z-10">
                          Dependent Tables
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.length === 0 ? (
                      <tr>
                        <td colSpan={data.fields.length + (meta?.dependentTables?.length ? 1 : 0)} className="px-4 py-8 text-center text-muted-foreground text-xs italic">
                          No records found match the criteria.
                        </td>
                      </tr>
                    ) : (
                      data.rows.map((row, i) => (
                        <tr key={i} className="border-b border-border hover:bg-muted/20 transition-colors">
                          {data.fields.map(f => {
                            const fk = meta?.foreignKeys.find(k => k.column === f.name)
                            return (
                              <td key={f.name} className="px-4 py-2.5 max-w-[250px] truncate text-foreground/80">
                                {fk && row[f.name] ? (
                                  <button 
                                    onClick={() => handleFKClick(fk.referencedTable, fk.referencedColumn, row[f.name])}
                                    className="text-blue-500 hover:text-blue-400 hover:underline inline-flex items-center gap-1"
                                    title={`Navigate to ${fk.referencedTable}.${fk.referencedColumn}`}
                                  >
                                    {String(row[f.name])}
                                    <LinkIcon className="w-3 h-3" />
                                  </button>
                                ) : (
                                  String(row[f.name] ?? 'NULL')
                                )}
                              </td>
                            )
                          })}
                          {(meta?.dependentTables?.length ?? 0) > 0 && (
                            <td className="px-4 py-2.5 border-l border-border bg-primary/5 sticky right-0 z-10 shadow-[-4px_0_10px_rgba(0,0,0,0.02)]">
                              <div className="flex flex-wrap gap-2">
                                {meta?.dependentTables.map(t => (
                                  <button
                                    key={t}
                                    onClick={() => handleDependentClick(t, row)}
                                    className="text-[10px] bg-background border border-border rounded px-1.5 py-0.5 hover:border-primary hover:text-primary transition-colors flex items-center gap-1"
                                  >
                                    {t}
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </button>
                                ))}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="h-12 border-t border-border bg-muted/10 flex items-center justify-between px-4 shrink-0 transition-all">
            <div className="flex items-center gap-4">
              <select 
                className="h-7 px-2 bg-background border border-border rounded-md text-[10px] focus:outline-none"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">
                Showing {Math.min(offset + 1, totalRows).toLocaleString()} - {Math.min(offset + pageSize, totalRows).toLocaleString()} of {totalRows.toLocaleString()}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1 || isLoading}
                className="p-1 rounded-md hover:bg-secondary disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[10px] font-medium text-muted-foreground">
                Page {page} of {totalPages || 1}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages || isLoading}
                className="p-1 rounded-md hover:bg-secondary disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
