import Database from 'better-sqlite3'
import type { DBConnection } from '../store'

export async function testSqliteConnection(conn: DBConnection) {
  // host contains the file path for sqlite
  const db = new Database(conn.host || ':memory:', { readonly: true })
  db.close()
  return true
}

export async function fetchSqliteDatabases(_conn: DBConnection) {
  // SQLite is file-based, just return 'main' or a named default
  return [{ name: 'main', type: 'database' }]
}

export async function fetchSqliteSchema(conn: DBConnection) {
  const db = new Database(conn.host || ':memory:', { readonly: true })
  try {
    const stmt = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `)
    const rows = stmt.all() as any[]
    return rows.map(row => ({ name: row.name, type: 'table' }))
  } finally {
    db.close()
  }
}

export async function executeSqliteQuery(conn: DBConnection, query: string, values: any[] = []) {
  const db = new Database(conn.host || ':memory:', { readonly: true })
  try {
    const stmt = db.prepare(query)
    // better-sqlite3 returns column names in stmt.columns()
    const fields = stmt.columns().map(c => ({ name: c.name }))
    const rows = stmt.all(...values)
    return { rows, fields }
  } finally {
    db.close()
  }
}

export async function fetchSqliteTableDetails(conn: DBConnection, tableName: string) {
  const db = new Database(conn.host || ':memory:', { readonly: true })
  try {
    // 1. Get Primary Keys
    const info = db.prepare(`PRAGMA table_info('${tableName}')`).all() as any[]
    const primaryKeys = info.filter(c => c.pk > 0).map(c => c.name)

    // 2. Get Foreign Keys
    const fks = db.prepare(`PRAGMA foreign_key_list('${tableName}')`).all() as any[]
    const foreignKeys = fks.map(f => ({
      column: f.from,
      referencedTable: f.table,
      referencedColumn: f.to
    }))

    // 3. Dependent Tables (Scanning sqlite_master for other tables that reference this one)
    const allTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[]
    const dependentTables: { table: string, column: string }[] = []

    for (const t of allTables) {
      if (t.name === tableName) continue
      const otherFks = db.prepare(`PRAGMA foreign_key_list('${t.name}')`).all() as any[]
      otherFks.forEach(f => {
        if (f.table === tableName) {
          dependentTables.push({ table: t.name, column: f.from })
        }
      })
    }

    return {
      primaryKeys,
      foreignKeys,
      dependentTables
    }
  } finally {
    db.close()
  }
}

export async function insertSqliteRow(conn: DBConnection, tableName: string, row: any) {
  const db = new Database(conn.host || ':memory:')
  try {
    const columns = Object.keys(row).map(c => `"${c}"`).join(', ')
    const placeholders = Object.keys(row).map(() => '?').join(', ')
    const values = Object.values(row)
    const query = `INSERT INTO "${tableName}" (${columns}) VALUES (${placeholders})`
    db.prepare(query).run(values)
    return true
  } finally {
    db.close()
  }
}

export async function updateSqliteRow(conn: DBConnection, tableName: string, pkKeys: string[], oldRow: any, newRow: any) {
  const db = new Database(conn.host || ':memory:')
  try {
    const setParts: string[] = []
    const values: any[] = []

    Object.entries(newRow).forEach(([col, val]) => {
      setParts.push(`"${col}" = ?`)
      values.push(val)
    })

    const whereParts: string[] = []
    pkKeys.forEach(pk => {
      whereParts.push(`"${pk}" = ?`)
      values.push(oldRow[pk])
    })

    const query = `UPDATE "${tableName}" SET ${setParts.join(', ')} WHERE ${whereParts.join(' AND ')}`
    db.prepare(query).run(values)
    return true
  } finally {
    db.close()
  }
}

export async function deleteSqliteRow(conn: DBConnection, tableName: string, pkKeys: string[], row: any, cascade = false) {
  const db = new Database(conn.host || ':memory:')
  try {
    if (cascade) {
      const details = await fetchSqliteTableDetails(conn, tableName)
      for (const dep of details.dependentTables) {
        const pkValue = row[pkKeys[0]]
        const query = `DELETE FROM "${dep.table}" WHERE "${dep.column}" = ?`
        db.prepare(query).run([pkValue])
      }
    }

    const whereParts: string[] = []
    const values: any[] = []

    pkKeys.forEach(pk => {
      whereParts.push(`"${pk}" = ?`)
      values.push(row[pk])
    })

    const query = `DELETE FROM "${tableName}" WHERE ${whereParts.join(' AND ')}`
    db.prepare(query).run(values)
    return true
  } finally {
    db.close()
  }
}
