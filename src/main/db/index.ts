import type { DBConnection } from '../store'
import { testPgConnection, fetchPgSchema, executePgQuery, fetchPgDatabases, fetchPgTableDetails, insertPgRow, updatePgRow, deletePgRow } from './pg'
import { testMysqlConnection, fetchMysqlSchema, executeMysqlQuery, fetchMysqlDatabases, fetchMysqlTableDetails, insertMysqlRow, updateMysqlRow, deleteMysqlRow } from './mysql'
import { testMssqlConnection, fetchMssqlSchema, executeMssqlQuery, fetchMssqlDatabases, fetchMssqlTableDetails, insertMssqlRow, updateMssqlRow, deleteMssqlRow } from './mssql'
import { testMongoConnection, fetchMongoSchema, executeMongoQuery, fetchMongoDatabases, insertMongoRow, updateMongoRow, deleteMongoRow } from './mongo'
import { testSqliteConnection, fetchSqliteSchema, executeSqliteQuery, fetchSqliteDatabases, fetchSqliteTableDetails, insertSqliteRow, updateSqliteRow, deleteSqliteRow } from './sqlite'

export async function testConnection(conn: DBConnection): Promise<boolean> {
  switch (conn.driver) {
    case 'pg': return testPgConnection(conn)
    case 'mysql': return testMysqlConnection(conn)
    case 'mssql': return testMssqlConnection(conn)
    case 'mongodb': return testMongoConnection(conn)
    case 'sqlite': return testSqliteConnection(conn)
    default: throw new Error(`Unsupported driver: ${conn.driver}`)
  }
}

export async function fetchDatabases(conn: DBConnection): Promise<Array<{ name: string; type: string }>> {
  switch (conn.driver) {
    case 'pg': return fetchPgDatabases(conn)
    case 'mysql': return fetchMysqlDatabases(conn)
    case 'mssql': return fetchMssqlDatabases(conn)
    case 'mongodb': return fetchMongoDatabases(conn)
    case 'sqlite': return fetchSqliteDatabases(conn)
    default: throw new Error(`Unsupported driver: ${conn.driver}`)
  }
}

export async function fetchSchema(conn: DBConnection): Promise<Array<{ name: string; type: string }>> {
  switch (conn.driver) {
    case 'pg': return fetchPgSchema(conn)
    case 'mysql': return fetchMysqlSchema(conn)
    case 'mssql': return fetchMssqlSchema(conn)
    case 'mongodb': return fetchMongoSchema(conn)
    case 'sqlite': return fetchSqliteSchema(conn)
    default: throw new Error(`Unsupported driver: ${conn.driver}`)
  }
}

export async function executeQuery(conn: DBConnection, query: string, values?: any[]): Promise<{ rows: any[]; fields: { name: string }[] }> {
  switch (conn.driver) {
    case 'pg': return executePgQuery(conn, query, values)
    case 'mysql': return executeMysqlQuery(conn, query, values)
    case 'mssql': return executeMssqlQuery(conn, query, values)
    case 'mongodb': return executeMongoQuery(conn, query, values)
    case 'sqlite': return executeSqliteQuery(conn, query, values)
    default: throw new Error(`Unsupported driver: ${conn.driver}`)
  }
}

export async function fetchTableDetails(conn: DBConnection, tableName: string) {
  switch (conn.driver) {
    case 'pg': return fetchPgTableDetails(conn, tableName)
    case 'mysql': return fetchMysqlTableDetails(conn, tableName)
    case 'mssql': return fetchMssqlTableDetails(conn, tableName)
    case 'sqlite': return fetchSqliteTableDetails(conn, tableName)
    case 'mongodb': return { primaryKeys: ['_id'], foreignKeys: [], dependentTables: [] }
    default: throw new Error(`Unsupported driver: ${conn.driver}`)
  }
}

export async function insertRow(conn: DBConnection, tableName: string, row: any) {
  switch (conn.driver) {
    case 'pg': return insertPgRow(conn, tableName, row)
    case 'mysql': return insertMysqlRow(conn, tableName, row)
    case 'mssql': return insertMssqlRow(conn, tableName, row)
    case 'mongodb': return insertMongoRow(conn, tableName, row)
    case 'sqlite': return insertSqliteRow(conn, tableName, row)
    default: throw new Error(`Insert not supported for ${conn.driver}`)
  }
}

export async function updateRow(conn: DBConnection, tableName: string, pkKeys: string[], oldRow: any, newRow: any) {
  switch (conn.driver) {
    case 'pg': return updatePgRow(conn, tableName, pkKeys, oldRow, newRow)
    case 'mysql': return updateMysqlRow(conn, tableName, pkKeys, oldRow, newRow)
    case 'mssql': return updateMssqlRow(conn, tableName, pkKeys, oldRow, newRow)
    case 'mongodb': return updateMongoRow(conn, tableName, pkKeys, oldRow, newRow)
    case 'sqlite': return updateSqliteRow(conn, tableName, pkKeys, oldRow, newRow)
    default: throw new Error(`Update not supported for ${conn.driver}`)
  }
}

export async function deleteRow(conn: DBConnection, tableName: string, pkKeys: string[], row: any, cascade = false) {
  switch (conn.driver) {
    case 'pg': return deletePgRow(conn, tableName, pkKeys, row, cascade)
    case 'mysql': return deleteMysqlRow(conn, tableName, pkKeys, row, cascade)
    case 'mssql': return deleteMssqlRow(conn, tableName, pkKeys, row, cascade)
    case 'mongodb': return deleteMongoRow(conn, tableName, pkKeys, row) // Mongo doesn't have FKs in the same way
    case 'sqlite': return deleteSqliteRow(conn, tableName, pkKeys, row, cascade)
    default: throw new Error(`Delete not supported for ${conn.driver}`)
  }
}
