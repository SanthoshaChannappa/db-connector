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
    const dependentTables: string[] = []

    for (const t of allTables) {
      if (t.name === tableName) continue
      const otherFks = db.prepare(`PRAGMA foreign_key_list('${t.name}')`).all() as any[]
      if (otherFks.some(f => f.table === tableName)) {
        dependentTables.push(t.name)
      }
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
