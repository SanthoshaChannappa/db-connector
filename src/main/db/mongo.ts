import { MongoClient } from 'mongodb'
import type { DBConnection } from '../store'

export async function testMongoConnection(conn: DBConnection) {
  const url = `mongodb://${conn.user ? `${conn.user}:${conn.password}@` : ''}${conn.host}${conn.port ? `:${conn.port}` : ''}`
  const tlsParam = conn.ssl ? (url.includes('?') ? '&tls=true' : '?tls=true') : ''
  const client = new MongoClient(url + tlsParam)
  await client.connect()
  await client.close()
  return true
}

export async function fetchMongoDatabases(conn: DBConnection) {
  const url = `mongodb://${conn.user ? `${conn.user}:${conn.password}@` : ''}${conn.host}${conn.port ? `:${conn.port}` : ''}`
  const tlsParam = conn.ssl ? (url.includes('?') ? '&tls=true' : '?tls=true') : ''
  const client = new MongoClient(url + tlsParam)
  await client.connect()
  const dbs = await client.db().admin().listDatabases()
  await client.close()
  return dbs.databases.map((db) => ({ name: db.name, type: 'database' }))
}

export async function fetchMongoSchema(conn: DBConnection) {
  const url = `mongodb://${conn.user ? `${conn.user}:${conn.password}@` : ''}${conn.host}${conn.port ? `:${conn.port}` : ''}`
  const tlsParam = conn.ssl ? (url.includes('?') ? '&tls=true' : '?tls=true') : ''
  const client = new MongoClient(url + tlsParam)
  await client.connect()
  const db = client.db(conn.database)
  const collections = await db.listCollections().toArray()
  await client.close()
  return collections.map((c) => ({ name: c.name, type: 'collection' }))
}

export async function executeMongoQuery(conn: DBConnection, query: string, _values?: any[]) {
  // Simple executor for document retrieval
  // e.g. "{"collection":"users","filter":{"age":{ "$gt": 18 }}}"
  const url = `mongodb://${conn.user ? `${conn.user}:${conn.password}@` : ''}${conn.host}${conn.port ? `:${conn.port}` : ''}`
  const tlsParam = conn.ssl ? (url.includes('?') ? '&tls=true' : '?tls=true') : ''
  const client = new MongoClient(url + tlsParam)
  try {
    await client.connect()
    const db = client.db(conn.database)
    let parsed
    try {
      parsed = JSON.parse(query)
    } catch {
      throw new Error(
        'MongoDB query must be valid JSON: { collection: string, filter?: any, limit?: number }'
      )
    }
    const collection = db.collection(parsed.collection || 'unknown')
    const limit = parsed.limit || 100
    const skip = parsed.skip || 0
    const filter = parsed.filter || {}
    const sort = parsed.sort || {}

    const docs = await collection.find(filter).sort(sort).skip(skip).limit(limit).toArray()

    // Extrapolate fields from the first 10 docs
    const fieldSet = new Set<string>()
    docs.slice(0, 10).forEach((doc) => Object.keys(doc).forEach((k) => fieldSet.add(k)))

    return {
      rows: docs,
      fields: Array.from(fieldSet).map((name) => ({ name }))
    }
  } finally {
    await client.close()
  }
}

export async function insertMongoRow(conn: DBConnection, tableName: string, row: any) {
  const url = `mongodb://${conn.user ? `${conn.user}:${conn.password}@` : ''}${conn.host}${conn.port ? `:${conn.port}` : ''}`
  const tlsParam = conn.ssl ? (url.includes('?') ? '&tls=true' : '?tls=true') : ''
  const client = new MongoClient(url + tlsParam)
  try {
    await client.connect()
    const db = client.db(conn.database)
    const collection = db.collection(tableName)
    await collection.insertOne(row)
    return true
  } finally {
    await client.close()
  }
}

export async function updateMongoRow(
  conn: DBConnection,
  tableName: string,
  pkKeys: string[],
  oldRow: any,
  newRow: any
) {
  const url = `mongodb://${conn.user ? `${conn.user}:${conn.password}@` : ''}${conn.host}${conn.port ? `:${conn.port}` : ''}`
  const tlsParam = conn.ssl ? (url.includes('?') ? '&tls=true' : '?tls=true') : ''
  const client = new MongoClient(url + tlsParam)
  try {
    await client.connect()
    const db = client.db(conn.database)
    const collection = db.collection(tableName)

    // For Mongo, we usually just use _id as PK
    const filter: any = {}
    pkKeys.forEach((k) => {
      filter[k] = oldRow[k]
      // Try to handle ObjectId if k is _id
      if (k === '_id' && typeof filter[k] === 'string' && filter[k].length === 24) {
        try {
          const { ObjectId } = require('mongodb')
          filter[k] = new ObjectId(filter[k])
        } catch {}
      }
    })

    const { _id, ...updateData } = newRow
    await collection.updateOne(filter, { $set: updateData })
    return true
  } finally {
    await client.close()
  }
}

export async function deleteMongoRow(
  conn: DBConnection,
  tableName: string,
  pkKeys: string[],
  row: any
) {
  const url = `mongodb://${conn.user ? `${conn.user}:${conn.password}@` : ''}${conn.host}${conn.port ? `:${conn.port}` : ''}`
  const tlsParam = conn.ssl ? (url.includes('?') ? '&tls=true' : '?tls=true') : ''
  const client = new MongoClient(url + tlsParam)
  try {
    await client.connect()
    const db = client.db(conn.database)
    const collection = db.collection(tableName)

    const filter: any = {}
    pkKeys.forEach((k) => {
      filter[k] = row[k]
      if (k === '_id' && typeof filter[k] === 'string' && filter[k].length === 24) {
        try {
          const { ObjectId } = require('mongodb')
          filter[k] = new ObjectId(filter[k])
        } catch {}
      }
    })

    await collection.deleteOne(filter)
    return true
  } finally {
    await client.close()
  }
}
