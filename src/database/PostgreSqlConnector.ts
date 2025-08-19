import { Client } from 'pg';

import type {
  ZodPgConfig,
  ZodPgConnectionConfig,
  ZodPgRawColumnInfo,
} from '../types.js';

import { logDebug } from '../utils/debug.js';
import { sql } from '../utils/sql.js';
import { createConnectionString } from './client.js';
import { DatabaseConnector } from './DatabaseConnector.js';

/**
 * Default connector to interact with PostgreSQL database and retrieve schema information.
 * Supports postgresql version 9.3 and above.
 */
export class PostgreSqlConnector extends DatabaseConnector {
  protected override createClient = (options: ZodPgConnectionConfig) => {
    return new Client({
      connectionString: createConnectionString(options),
      ssl: options.ssl,
      application_name: 'zod-pg',
    });
  };

  protected override async fetchSchemaInfo(
    config: ZodPgConfig
  ): Promise<ZodPgRawColumnInfo[]> {
    const { schemaName = 'public' } = config;

    const client = this.createClient(config.connection);
    await client.connect();

    logDebug(`Retrieving schema information for schema '${schemaName}'`);

    try {
      const res = await client.query<ZodPgRawColumnInfo>(
        sql`
          SELECT
            c.relname AS "tableName",
            a.attname AS "name",
            pg_get_expr(d.adbin, d.adrelid) AS "defaultValue",
            t.typname AS "dataType",
            NOT a.attnotnull AS "isNullable",
            CASE 
              WHEN a.atttypmod > 0 THEN a.atttypmod - 4
              ELSE NULL
            END AS "maxLen",
            t.typname AS "dataType",
            checks."checkConstraints",
            col_description(c.oid, a.attnum) AS "description",
            CASE 
              WHEN c.relkind = 'r' THEN 'table'
              WHEN c.relkind = 'v' THEN 'view'
              WHEN c.relkind = 'm' THEN 'materialized_view'
              WHEN c.relkind = 'f' THEN 'foreign_table'
              ELSE 'unknown'
            END AS "tableType"
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          JOIN pg_attribute a ON a.attrelid = c.oid
          JOIN pg_type t ON t.oid = a.atttypid
          LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
          LEFT JOIN LATERAL (
            SELECT json_agg(json_build_object('checkClause', pg_get_constraintdef(pgc.oid))) AS "checkConstraints"
            FROM pg_constraint pgc
            WHERE pgc.conrelid = c.oid
              AND pgc.contype = 'c'
              AND pgc.conkey @> ARRAY[a.attnum]
          ) AS checks ON TRUE
          WHERE n.nspname = $1
            AND c.relkind IN ('r', 'v', 'm', 'f')
            AND a.attnum > 0
            AND NOT a.attisdropped
          ORDER BY c.relname, a.attnum;
        `,
        [schemaName]
      );

      logDebug(
        `Retrieved ${res.rows.length} columns from schema '${schemaName}'`
      );

      return res.rows.map((row) => ({
        ...row,
        schemaName,
      }));
    } finally {
      await client.end();
    }
  }
}
