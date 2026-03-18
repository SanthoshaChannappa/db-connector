import type { DBConnection, QueryFilter, SortState } from '../store'

export function generateQuery(
  conn: DBConnection | null,
  tableName: string | null,
  filters: QueryFilter[],
  sortState: SortState | null,
  page: number,
  pageSize: number
) {
  if (!conn || !tableName) return { query: '', countQuery: '' }

  const offset = (page - 1) * pageSize
  let whereClause = ''

  if (filters.length > 0) {
    const parts = filters.map(f => {
      const val = f.value
      const escapedVal = val.replace(/'/g, "''")

      if (conn.driver === 'mongodb') {
        return { [f.column]: val }
      }
      
      if (conn.driver === 'mysql') {
        return `\`${f.column}\` LIKE '%${escapedVal}%'`
      } else if (conn.driver === 'mssql') {
        return `[${f.column}] LIKE '%${escapedVal}%'`
      } else if (conn.driver === 'sqlite') {
        return `"${f.column}" LIKE '%${escapedVal}%'`
      } else {
        // Postgres
        return `CAST("${f.column}" AS TEXT) ILIKE '%${escapedVal}%'`
      }
    })
    
    if (conn.driver !== 'mongodb') {
      whereClause = ` WHERE ${parts.join(' AND ')}`
    }
  }

  let query = ''
  let countQuery = ''

  if (conn.driver === 'mongodb') {
    const mongoFilter = filters.reduce((acc, f) => {
      acc[f.column] = { $regex: f.value, $options: 'i' }
      return acc
    }, {} as any)
    
    query = JSON.stringify({ 
      collection: tableName, 
      filter: mongoFilter,
      limit: pageSize, 
      skip: offset 
    }, null, 2)
    countQuery = JSON.stringify({ 
      collection: tableName, 
      filter: mongoFilter,
      count: true 
    }, null, 2)
  } else {
    const orderBy = sortState ? ` ORDER BY "${sortState.column}" ${sortState.direction}` : ' ORDER BY (SELECT NULL)'
    
    if (conn.driver === 'mssql') {
      query = `SELECT * FROM [${tableName}]${whereClause}${orderBy} OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY`
      countQuery = `SELECT COUNT(*) as total FROM [${tableName}]${whereClause}`
    } else if (conn.driver === 'mysql') {
      const mysqlOrder = orderBy.replace(/"/g, '`')
      const mysqlWhere = whereClause.replace(/"/g, '`')
      query = `SELECT * FROM \`${tableName}\`${mysqlWhere}${mysqlOrder} LIMIT ${pageSize} OFFSET ${offset}`
      countQuery = `SELECT COUNT(*) as total FROM \`${tableName}\`${mysqlWhere}`
    } else {
      query = `SELECT * FROM "${tableName}"${whereClause}${orderBy} LIMIT ${pageSize} OFFSET ${offset}`
      countQuery = `SELECT COUNT(*) as total FROM "${tableName}"${whereClause}`
    }
  }

  return { query, countQuery }
}
