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
