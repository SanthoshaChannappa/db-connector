import { useState, useEffect } from 'react'
import { useAppStore } from '../../store'
import {
  useConnections,
  useQueryData,
  useTableDetails,
  useInsertRow,
  useUpdateRow,
  useDeleteRow
} from '../../hooks/useDatabase'
import { ExportPanel } from './ExportPanel'
import {
  AlertCircle,
  Link as LinkIcon,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  X,
  Search,
  RefreshCw,
  Terminal,
  Plus,
  Trash2,
  Edit2,
  Save,
  RotateCcw,
  FileDown
} from 'lucide-react'
import * as ExcelJS from 'exceljs'

import { generateQuery } from '../../lib/query-utility'

interface DataGridProps {
  gridId: string
}

export function DataGrid({ gridId }: DataGridProps) {
  const { grids, pushGrid, removeGrid, toggleGridCollapse, updateGrid, addQueryTab } = useAppStore()

  const grid = grids.find((g) => g.id === gridId)
  const tabGrids = grid ? grids.filter((g) => g.tabId === grid.tabId) : []
  const isFirstInTab = tabGrids[0]?.id === gridId

  const {
    tableName: activeTableName = '',
    connectionId = '',
    databaseName = null,
    filters = [],
    sortState = null,
    page = 1,
    pageSize = 10,
    isCollapsed = false
  } = grid || {}

  // Local state
  const [draftFilters, setDraftFilters] = useState<Record<string, string>>({})
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null)
  const [editingData, setEditingData] = useState<any>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isInserting, setIsInserting] = useState(false)
  const [newData, setNewData] = useState<any>({})
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [cascadeDelete, setCascadeDelete] = useState(false)
  const [hoveredCell, setHoveredCell] = useState<{ content: string; rect: DOMRect } | null>(null)
  const [showCopiedToast, setShowCopiedToast] = useState(false)

  // Initialize draft filters from store
  useEffect(() => {
    const initialDrafts: Record<string, string> = {}
    filters.forEach((f) => {
      initialDrafts[f.column] = f.value
    })
    setDraftFilters(initialDrafts)
  }, [filters])

  const { data: connections } = useConnections()
  const baseConn = connections?.find((c) => c.id === connectionId) || null

  const conn = baseConn && databaseName ? { ...baseConn, database: databaseName } : baseConn

  const offset = (page - 1) * pageSize

  // Fetch Table Metadata (PKs, FKs, Dependent Tables)
  const { data: meta } = useTableDetails(conn, activeTableName)

  const getInputType = (columnName: string) => {
    const colMetaData = meta?.columns?.find((c) => c.name === columnName)
    if (!colMetaData) return 'text'

    const type = colMetaData.type.toLowerCase()
    if (
      [
        'int',
        'integer',
        'number',
        'numeric',
        'decimal',
        'float',
        'double',
        'real',
        'smallint',
        'bigint'
      ].some((t) => type.includes(t))
    ) {
      return 'number'
    }
    if (['date', 'time', 'timestamp', 'datetime'].some((t) => type.includes(t))) {
      return 'datetime-local'
    }
    return 'text'
  }

  const isStringType = (columnName: string) => {
    const colMetaData = meta?.columns?.find((c) => c.name === columnName)
    if (!colMetaData) return true // Default to string/LIKE if unknown

    const type = colMetaData.type.toLowerCase()
    // Common string types across DBs
    return [
      'char',
      'text',
      'string',
      'varchar',
      'nvarchar',
      'blob',
      'clob',
      'uuid',
      'json',
      'xml'
    ].some((t) => type.includes(t))
  }

  const isDateType = (columnName: string) => {
    const colMetaData = meta?.columns?.find((c) => c.name === columnName)
    if (!colMetaData) return false
    const type = colMetaData.type.toLowerCase()
    return ['date', 'time', 'timestamp', 'datetime'].some((t) => type.includes(t))
  }

  const formatCellValue = (columnName: string, value: any) => {
    if (value === null || value === undefined) return 'NULL'
    if (isDateType(columnName)) {
      try {
        const d = new Date(value)
        return isNaN(d.getTime()) ? String(value) : d.toISOString()
      } catch {
        return String(value)
      }
    }
    return String(value)
  }

  const formatForInput = (columnName: string, value: any) => {
    if (!value) return ''
    if (isDateType(columnName)) {
      try {
        const d = new Date(value)
        if (isNaN(d.getTime())) return String(value)
        // datetime-local expects YYYY-MM-DDTHH:mm
        return d.toISOString().slice(0, 16)
      } catch {
        return String(value)
      }
    }
    return String(value)
  }

  const { query, countQuery } = generateQuery(
    conn,
    activeTableName,
    filters,
    sortState,
    page,
    pageSize
  )

  const {
    data,
    isLoading,
    error,
    refetch: refetchData,
    isFetching: isFetchingData
  } = useQueryData(conn, query)
  const {
    data: countData,
    refetch: refetchCount,
    isFetching: isFetchingCount
  } = useQueryData(conn, countQuery)

  const totalRows =
    countData?.rows[0]?.total ?? (conn?.driver === 'mongodb' ? countData?.rows[0]?.count : 0) ?? 0
  const totalPages = Math.ceil(totalRows / pageSize)

  const insertMutation = useInsertRow()
  const updateMutation = useUpdateRow()
  const deleteMutation = useDeleteRow()

  if (!grid) return null

  const handleRefresh = () => {
    refetchData()
    refetchCount()
  }

  const handleExportExcel = async () => {
    if (!data || data.rows.length === 0) return

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet(activeTableName.substring(0, 31))

    sheet.columns = data.fields.map((f) => ({ header: f.name, key: f.name, width: 20 }))
    data.rows.forEach((row) => {
      sheet.addRow(row)
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeTableName.replace(/[^a-z0-9]/gi, '_')}_export.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  const isRefreshing = isFetchingData || isFetchingCount

  const handleApplyFilters = () => {
    const newFilters = Object.entries(draftFilters)
      .filter(([_, value]) => value.trim() !== '')
      .map(([column, value]) => ({
        column,
        operator: isStringType(column) ? 'LIKE' : '=',
        value: value.trim()
      }))

    updateGrid(gridId, { filters: newFilters, page: 1 })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleApplyFilters()
    }
  }

  const validateRow = (rowData: any) => {
    if (!meta?.columns) return true

    for (const col of meta.columns) {
      const val = rowData[col.name]
      const isPK = meta.primaryKeys.includes(col.name)

      // 1. Check required fields (Primary Keys or Non-Nullable, but skip for Auto Increment)
      if (
        (isPK || !col.nullable) &&
        !col.isAutoIncrement &&
        (val === undefined || val === null || val === '')
      ) {
        setValidationError(`Field '${col.name}' is required.`)
        return false
      }

      // 2. Basic type validation for numbers
      if (getInputType(col.name) === 'number' && val !== undefined && val !== null && val !== '') {
        if (isNaN(Number(val))) {
          setValidationError(`Field '${col.name}' must be a valid number.`)
          return false
        }
      }
    }

    setValidationError(null)
    return true
  }

  const handleFKClick = (targetTable: string, column: string, value: any) => {
    pushGrid(targetTable, { column, operator: '=', value: String(value) }, gridId)
  }

  const handleDependentClick = (targetTable: string, columnName: string, row: any) => {
    const pkColumn = meta?.primaryKeys[0]
    if (pkColumn) {
      pushGrid(
        targetTable,
        { column: columnName, operator: '=', value: String(row[pkColumn]) },
        gridId
      )
    }
  }

  const handleSort = (column: string) => {
    let newDirection: 'asc' | 'desc' = 'asc'
    if (sortState?.column === column) {
      if (sortState.direction === 'asc') newDirection = 'desc'
      else {
        updateGrid(gridId, { sortState: null, page: 1 })
        return
      }
    }
    updateGrid(gridId, { sortState: { column, direction: newDirection }, page: 1 })
  }

  const handleStartEdit = (index: number, row: any) => {
    setEditingRowIndex(index)
    setEditingData({ ...row })
  }

  const handleCancelEdit = () => {
    setEditingData(null)
    setValidationError(null)
  }

  const handleCellMouseEnter = (e: React.MouseEvent<HTMLTableCellElement>, content: string) => {
    const target = e.currentTarget
    if (target.scrollWidth > target.clientWidth) {
      setHoveredCell({ content, rect: target.getBoundingClientRect() })
    }
  }

  const handleCellMouseLeave = () => {
    setHoveredCell(null)
  }

  const handleCellContextMenu = (e: React.MouseEvent, columnName: string, value: any) => {
    e.preventDefault()
    const textToCopy = formatCellValue(columnName, value)
    navigator.clipboard.writeText(textToCopy)
    setShowCopiedToast(true)
    setTimeout(() => setShowCopiedToast(false), 2000)
  }

  const handleSaveUpdate = async () => {
    if (editingRowIndex === null || !editingData || !conn) return
    if (!validateRow(editingData)) return

    const oldRow = data?.rows[editingRowIndex]
    if (!oldRow) return

    try {
      await updateMutation.mutateAsync({
        conn,
        tableName: activeTableName,
        pkKeys: meta?.primaryKeys || [],
        oldRow,
        newRow: editingData
      })
      handleCancelEdit()
    } catch (err) {
      alert(`Update failed: ${(err as any).message}`)
    }
  }

  const handleDeleteRow = (row: any) => {
    setDeleteTarget(row)
    setCascadeDelete(false)
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!conn || !deleteTarget) return
    try {
      await deleteMutation.mutateAsync({
        conn,
        tableName: activeTableName,
        pkKeys: meta?.primaryKeys || [],
        row: deleteTarget,
        cascade: cascadeDelete
      })
      setShowDeleteModal(false)
      setDeleteTarget(null)
    } catch (err) {
      alert(`Delete failed: ${(err as any).message}`)
    }
  }

  const handleInsertRow = async () => {
    if (!conn) return
    if (!validateRow(newData)) return

    try {
      await insertMutation.mutateAsync({
        conn,
        tableName: activeTableName,
        row: newData
      })
      setIsInserting(false)
      setNewData({})
      setValidationError(null)
    } catch (err) {
      alert(`Insert failed: ${(err as any).message}`)
    }
  }

  const setPage = (p: number) => updateGrid(gridId, { page: p })
  const setPageSize = (s: number) => updateGrid(gridId, { pageSize: s, page: 1 })

  return (
    <div
      className={`flex flex-col rounded-lg border border-border bg-card shadow-sm transition-all duration-200`}
    >
      {/* Header / Toolbar */}
      <div className="h-12 border-b border-border flex items-center justify-between px-4 shrink-0 bg-muted/30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => toggleGridCollapse(gridId)}
            className="p-1 hover:bg-secondary rounded-md transition-colors text-muted-foreground"
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground select-none">
              {activeTableName}
            </span>
            <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full">
              {isLoading ? '...' : totalRows.toLocaleString()}
            </span>
            {filters.length > 0 && (
              <div className="text-[10px] text-primary font-medium flex items-center gap-1 bg-primary/5 px-2 py-0.5 rounded-full border border-primary/10">
                <Search className="w-2.5 h-2.5" />
                {filters.length} {filters.length === 1 ? 'filter' : 'filters'}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {!isCollapsed && data && (
            <>
              <button
                onClick={() => addQueryTab(connectionId, databaseName || '', query)}
                className="p-1.5 hover:bg-secondary rounded-md transition-colors text-muted-foreground"
                title="Open in Query Tab"
              >
                <Terminal className="w-4 h-4" />
              </button>
              <button
                onClick={handleExportExcel}
                disabled={!data || data.rows.length === 0}
                className="p-1.5 hover:bg-green-600/10 hover:text-green-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground rounded-md transition-all text-muted-foreground group"
                title="Export this grid to Excel"
              >
                <FileDown className="w-4 h-4 group-hover:animate-bounce" />
              </button>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-1.5 hover:bg-secondary rounded-md transition-colors text-muted-foreground disabled:opacity-50"
                title="Refresh Table"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setIsInserting(true)}
                className="p-1.5 hover:bg-primary/20 hover:text-primary rounded-md transition-colors text-muted-foreground"
                title="Add New Row"
              >
                <Plus className="w-4 h-4" />
              </button>
              <div className="w-[1px] h-4 bg-border mx-1" />
              <ExportPanel data={data.rows} fields={data.fields} tableName={activeTableName} />
            </>
          )}

          {!isFirstInTab && (
            <button
              onClick={() => removeGrid(gridId)}
              className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-md transition-all text-muted-foreground/50 hover:opacity-100"
              title="Remove this view from stack"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2 text-destructive">
                <Trash2 className="w-5 h-5" />
                Confirm Delete
              </h3>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-foreground/80 mb-4">
                Are you sure you want to delete this record? This action cannot be undone.
              </p>

              {(meta?.dependentTables?.length ?? 0) > 0 && (
                <div className="bg-secondary/50 border border-border rounded-lg p-4 mb-4">
                  <p className="text-xs font-medium mb-2 flex items-center gap-1.5 text-amber-500">
                    <Terminal className="w-3.5 h-3.5" />
                    Dependent Records Detected
                  </p>
                  <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
                    This record is referenced by {meta?.dependentTables?.length} other tables.
                    Regular delete may fail due to foreign key constraints.
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        checked={cascadeDelete}
                        onChange={(e) => setCascadeDelete(e.target.checked)}
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20 cursor-pointer"
                      />
                    </div>
                    <span className="text-xs font-semibold group-hover:text-foreground transition-colors">
                      Cascade delete (remove related records)
                    </span>
                  </label>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 mt-2">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-4 py-2 text-sm font-medium hover:bg-muted rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg shadow-sm transition-all flex items-center gap-2"
                >
                  {deleteMutation.isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Delete Record
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isCollapsed && (
        <>
          <div className="p-4">
            {isLoading && (
              <div className="text-center text-sm text-muted-foreground py-10">Loading data...</div>
            )}
            {error && (
              <div className="text-destructive text-sm bg-destructive/10 p-4 rounded-md border border-destructive/20">
                {(error as any)?.message || 'An error occurred'}
              </div>
            )}
            {validationError && (
              <div className="mb-4 text-destructive text-xs bg-destructive/10 p-3 rounded-md border border-destructive/20 flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                <AlertCircle className="w-4 h-4" />
                {validationError}
              </div>
            )}

            {data && !isLoading && !error && (
              <div className="rounded-md border border-border overflow-x-auto bg-background">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="text-xs text-muted-foreground bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-4 py-3 font-medium tracking-wider text-center border-r border-border sticky left-0 bg-muted/80 z-20">
                        <span className="sr-only">Actions</span>
                      </th>
                      {data.fields.map((f) => (
                        <th key={f.name} className="px-4 py-3 font-medium tracking-wider">
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => handleSort(f.name)}
                              className="flex items-center gap-1.5 hover:text-foreground transition-colors group"
                            >
                              <span
                                className={
                                  sortState?.column === f.name ? 'text-primary font-bold' : ''
                                }
                              >
                                {f.name}
                              </span>
                              <div
                                className={`flex flex-col transition-opacity ${sortState?.column === f.name ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                              >
                                {sortState?.column === f.name ? (
                                  sortState.direction === 'asc' ? (
                                    <ChevronUp className="w-3 h-3 text-primary" />
                                  ) : (
                                    <ChevronDown className="w-3 h-3 text-primary" />
                                  )
                                ) : (
                                  <ChevronUp className="w-3 h-3 text-muted-foreground/30" />
                                )}
                              </div>
                            </button>
                            <div className="relative">
                              <input
                                type="text"
                                placeholder="Filter..."
                                className="w-full h-7 px-2 pl-7 pr-2 font-normal text-[10px] bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                                value={draftFilters[f.name] || ''}
                                onChange={(e) =>
                                  setDraftFilters((prev) => ({ ...prev, [f.name]: e.target.value }))
                                }
                                onKeyDown={handleKeyDown}
                              />
                              <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                            </div>
                          </div>
                        </th>
                      ))}
                      {(meta?.dependentTables?.length ?? 0) > 0 && (
                        <th className="px-4 py-3 font-medium tracking-wider text-primary/80 border-l border-border bg-secondary sticky right-0 z-10 align-top">
                          Dependent Tables
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {isInserting && (
                      <tr className="bg-primary/5 border-b border-border">
                        <td className="px-4 py-2 text-center border-r border-border sticky left-0 bg-background/80 z-20">
                          <div className="flex items-center gap-1 justify-center">
                            <button
                              onClick={handleInsertRow}
                              className="p-1 text-green-500 hover:bg-green-500/10 rounded"
                              title="Save"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setIsInserting(false)}
                              className="p-1 text-red-500 hover:bg-red-500/10 rounded"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                        {data.fields.map((f) => {
                          const colMetaData = meta?.columns?.find((c) => c.name === f.name)
                          const isAuto = colMetaData?.isAutoIncrement

                          return (
                            <td key={f.name} className="px-2 py-1">
                              {isAuto ? (
                                <div className="w-full h-8 px-3 flex items-center bg-muted/30 border border-dashed border-border rounded text-[10px] text-muted-foreground font-medium italic">
                                  (Auto)
                                </div>
                              ) : (
                                <input
                                  type={getInputType(f.name)}
                                  className="w-full h-8 px-2 bg-background border border-border rounded focus:ring-1 focus:ring-primary text-xs"
                                  placeholder={`New ${f.name}...`}
                                  value={
                                    getInputType(f.name) === 'datetime-local'
                                      ? formatForInput(f.name, newData[f.name])
                                      : newData[f.name] || ''
                                  }
                                  onChange={(e) => setNewData({ ...newData, [f.name]: e.target.value })}
                                />
                              )}
                            </td>
                          )
                        })}
                        {(meta?.dependentTables?.length ?? 0) > 0 && (
                          <td className="sticky right-0 bg-secondary/80 z-10" />
                        )}
                      </tr>
                    )}
                    {data.rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={data.fields.length + (meta?.dependentTables?.length ? 1 : 0) + 1}
                          className="px-4 py-8 text-center text-muted-foreground text-xs italic"
                        >
                          No records found match the criteria.
                        </td>
                      </tr>
                    ) : (
                      data.rows.map((row, i) => (
                        <tr
                          key={i}
                          className={`border-b border-border transition-colors ${editingRowIndex === i ? 'bg-primary/5' : 'hover:bg-muted/20'}`}
                        >
                          <td className="px-4 py-2.5 border-r border-border sticky left-0 bg-background/80 z-20">
                            <div className="flex items-center gap-1 justify-center">
                              {editingRowIndex === i ? (
                                <>
                                  <button
                                    onClick={handleSaveUpdate}
                                    className="p-1 text-green-500 hover:bg-green-500/10 rounded"
                                    title="Save"
                                  >
                                    <Save className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={handleCancelEdit}
                                    className="p-1 text-muted-foreground hover:bg-secondary rounded"
                                    title="Cancel"
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleStartEdit(i, row)}
                                    className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors"
                                    title="Edit Row"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteRow(row)}
                                    className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                                    title="Delete Row"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                          {data.fields.map((f) => {
                            const fk = meta?.foreignKeys.find((k) => k.column === f.name)
                            const isBeingEdited = editingRowIndex === i
                            const isPK = meta?.primaryKeys.includes(f.name)
                            const colMetaData = meta?.columns?.find((c) => c.name === f.name)

                            return (
                              <td
                                key={f.name}
                                className="px-4 py-2.5 max-w-[250px] truncate text-foreground/80 cursor-default"
                                onMouseEnter={(e) => handleCellMouseEnter(e, String(row[f.name] ?? ''))}
                                onMouseLeave={handleCellMouseLeave}
                                onContextMenu={(e) => handleCellContextMenu(e, f.name, row[f.name])}
                              >
                                 {isBeingEdited && !isPK && !colMetaData?.isAutoIncrement ? (
                                  <input
                                    type={getInputType(f.name)}
                                    className="w-full h-8 px-2 bg-background border border-primary/30 rounded focus:ring-1 focus:ring-primary text-xs"
                                    value={
                                      getInputType(f.name) === 'datetime-local'
                                        ? formatForInput(f.name, editingData[f.name])
                                        : editingData[f.name] ?? ''
                                    }
                                    onChange={(e) =>
                                      setEditingData({ ...editingData, [f.name]: e.target.value })
                                    }
                                  />
                                ) : (
                                  <div
                                    className={`flex items-center gap-2 ${isBeingEdited && (isPK || colMetaData?.isAutoIncrement) ? 'opacity-50 select-none' : ''}`}
                                  >
                                    {fk && row[f.name] ? (
                                      <button
                                        onClick={() =>
                                          handleFKClick(
                                            fk.referencedTable,
                                            fk.referencedColumn,
                                            row[f.name]
                                          )
                                        }
                                        className="text-blue-500 hover:text-blue-400 hover:underline inline-flex items-center gap-1"
                                        title={`Navigate to ${fk.referencedTable}.${fk.referencedColumn}`}
                                      >
                                        {formatCellValue(f.name, row[f.name])}
                                        <LinkIcon className="w-3 h-3" />
                                      </button>
                                    ) : (
                                      formatCellValue(f.name, row[f.name])
                                    )}
                                    {isBeingEdited && isPK && (
                                      <span className="text-[10px] bg-muted px-1 rounded border border-border">
                                        PK
                                      </span>
                                    )}
                                    {isBeingEdited && colMetaData?.isAutoIncrement && !isPK && (
                                      <span className="text-[10px] bg-muted px-1 rounded border border-border">
                                        Auto
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                            )
                          })}
                          {(meta?.dependentTables?.length ?? 0) > 0 && (
                            <td className="px-4 py-2.5 border-l border-border bg-secondary sticky right-0 z-10 shadow-[-4px_0_10px_rgba(0,0,0,0.02)]">
                              <div className="flex flex-wrap gap-2">
                                {((meta?.dependentTables as any[]) || []).map(
                                  (dep: any, idx: number) => (
                                    <button
                                      key={idx}
                                      onClick={() =>
                                        handleDependentClick(dep.table, dep.column, row)
                                      }
                                      className="text-[10px] bg-background border border-border rounded px-1.5 py-0.5 hover:border-primary hover:text-primary transition-colors flex items-center gap-1"
                                    >
                                      {dep.table}
                                      <ExternalLink className="w-2.5 h-2.5" />
                                    </button>
                                  )
                                )}
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
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">
                Showing {Math.min(offset + 1, totalRows).toLocaleString()} -{' '}
                {Math.min(offset + pageSize, totalRows).toLocaleString()} of{' '}
                {totalRows.toLocaleString()}
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

      {hoveredCell && (
        <div
          className="fixed z-[200] bg-popover text-popover-foreground px-3 py-2 rounded-lg border border-border shadow-xl text-xs pointer-events-none whitespace-pre-wrap max-w-md animate-in fade-in zoom-in duration-200"
          style={{
            left: Math.min(hoveredCell.rect.left, window.innerWidth - 300),
            top: hoveredCell.rect.top - 8,
            transform: 'translateY(-100%)'
          }}
        >
          <div className="font-medium mb-1 text-[10px] text-muted-foreground uppercase tracking-tight">Full Value</div>
          {hoveredCell.content}
        </div>
      )}

      {showCopiedToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[300] bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-2xl text-xs font-medium animate-in fade-in slide-in-from-bottom-4 duration-300 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground animate-pulse" />
          Value copied to clipboard
        </div>
      )}
    </div>
  )
}
