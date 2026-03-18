import { FileDown } from 'lucide-react'
import * as ExcelJS from 'exceljs'

interface ExportPanelProps {
  data: any[]
  fields: { name: string }[]
  tableName: string
}

export function ExportPanel({ data, fields, tableName }: ExportPanelProps) {
  
  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet(tableName)
    
    sheet.columns = fields.map(f => ({ header: f.name, key: f.name, width: 20 }))
    data.forEach(row => {
      sheet.addRow(row)
    })
    
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${tableName}_export.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex gap-2">
      <button 
        onClick={handleExportExcel}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/20 text-green-600 hover:bg-green-600/30 rounded-md text-sm font-medium transition-colors"
        title="Export to Excel"
      >
        <FileDown className="w-4 h-4" />
        <span className="hidden sm:inline">Excel</span>
      </button>
    </div>
  )
}
