import type { DBConnection } from '../store'
import { testPgConnection, fetchPgSchema, executePgQuery, fetchPgDatabases } from './pg'
import { testMysqlConnection, fetchMysqlSchema, executeMysqlQuery, fetchMysqlDatabases } from './mysql'
import { testMssqlConnection, fetchMssqlSchema, executeMssqlQuery, fetchMssqlDatabases } from './mssql'
import { testMongoConnection, fetchMongoSchema, executeMongoQuery, fetchMongoDatabases } from './mongo'
import { testSqliteConnection, fetchSqliteSchema, executeSqliteQuery, fetchSqliteDatabases } from './sqlite'

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
