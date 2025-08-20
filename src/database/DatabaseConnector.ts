import {
  ZodPgColumnInfo,
  ZodPgConfig,
  ZodPgConnectionConfig,
  ZodPgDbConnector,
  ZodPgHooks,
  ZodPgRawColumnInfo,
  ZodPgSchemaInfo,
  ZodPgTableInfo,
} from '../types.js';
import { logDebug } from '../utils/debug.js';
import { getEnumConstraints } from './enumConstraints.js';
import { getZodType, isArrayType, isSerialType } from './typeMap.js';

export interface DatabaseClient {
  connect: () => Promise<void>;
  query: (query: string, params?: any[]) => Promise<any>;
  end: () => Promise<void>;
}

/**
 * Base class for database connectors.
 * Provides common functionality for fetching schema information and processing columns.
 * Should be extended by specific database connectors like PostgreSqlConnector.
 */
export abstract class DatabaseConnector implements ZodPgDbConnector {
  protected options: ZodPgHooks;

  constructor(options: ZodPgHooks = {}) {
    this.options = options;
  }

  protected abstract createClient(
    options: ZodPgConnectionConfig
  ): DatabaseClient;

  protected async createColumnInfo(
    column: ZodPgRawColumnInfo,
    schemaName: string
  ): Promise<ZodPgColumnInfo> {
    const parsedColumn: ZodPgColumnInfo = {
      ...column,
      schemaName,
      maxLen: column.maxLen ?? undefined,
      isEnum: false,
      isSerial: false,
      isArray: false,
      isWritable: true,
      type: 'any', // Default type, will be updated later
    };

    if (column.checkConstraints) {
      parsedColumn.enumValues = getEnumConstraints(
        column.name,
        column.checkConstraints.map((c) => c.checkClause)
      );

      logDebug(
        `Extracted enum values for column '${column.tableName}.${column.name}': ${JSON.stringify(parsedColumn.enumValues)}`
      );
    }

    parsedColumn.type = getZodType(column);
    parsedColumn.isArray = isArrayType(column);
    parsedColumn.isSerial = isSerialType(column);
    parsedColumn.isWritable =
      !parsedColumn.isSerial && parsedColumn.tableType === 'table';
    parsedColumn.isOptional = parsedColumn.isNullable;
    parsedColumn.isEnum = !!parsedColumn.enumValues?.length;

    if (this.options.onColumnModelCreated) {
      return this.options.onColumnModelCreated(parsedColumn);
    }

    return parsedColumn;
  }

  protected async createSchemaInfo(
    tables: ZodPgTableInfo[],
    schemaName: string
  ): Promise<ZodPgSchemaInfo> {
    const result: ZodPgSchemaInfo = { name: schemaName, tables };

    if (this.options.onTableModelCreated) {
      const modifiedTables = [];

      for (const table of tables) {
        const modifiedTable = await this.options.onTableModelCreated(table);
        modifiedTables.push(modifiedTable);
      }

      result.tables = modifiedTables;
    }

    return result;
  }

  protected abstract fetchSchemaInfo(
    config: ZodPgConfig
  ): Promise<ZodPgRawColumnInfo[]>;

  protected filterColumns(
    columns: ZodPgRawColumnInfo[],
    config: ZodPgConfig
  ): ZodPgRawColumnInfo[] {
    const { include, exclude } = config;

    if (!exclude && !include) return columns;

    let filteredColumns = [...columns];

    if (include) {
      if (typeof include === 'string') {
        const includeRegex = new RegExp(include);
        filteredColumns = filteredColumns.filter((column) =>
          includeRegex.test(column.tableName)
        );
      } else {
        filteredColumns = filteredColumns.filter((column) =>
          include.includes(column.tableName)
        );
      }
    }

    if (exclude) {
      if (typeof exclude === 'string') {
        const excludeRegex = new RegExp(exclude);
        filteredColumns = filteredColumns.filter(
          (column) => !excludeRegex.test(column.tableName)
        );
      } else {
        filteredColumns = filteredColumns.filter(
          (column) => !exclude.includes(column.tableName)
        );
      }
    }

    return filteredColumns;
  }

  protected async createTables(
    columns: ZodPgRawColumnInfo[],
    schemaName: string
  ): Promise<ZodPgTableInfo[]> {
    const tablesMap = new Map<string, ZodPgTableInfo>();

    for (const column of columns) {
      const key = `${schemaName}:${column.tableName}`;
      let table = tablesMap.get(key);

      const parsedColumn = await this.createColumnInfo(column, schemaName);

      if (!table) {
        table = {
          type: column.tableType,
          name: column.tableName,
          schemaName,
          columns: [],
        };

        tablesMap.set(key, table);
      }

      table.columns.push(parsedColumn);
    }

    let tables = Array.from(tablesMap.values());

    // sort tables by type and name
    tables.sort((a, b) => {
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      return a.name.localeCompare(b.name);
    });

    logDebug(`Found ${tables.length} tables in schema '${schemaName}'`);

    return tables;
  }

  async getSchemaInformation(config: ZodPgConfig): Promise<ZodPgSchemaInfo> {
    const { schemaName = 'public' } = config;

    const columns = await this.fetchSchemaInfo(config);
    const filteredColumns = this.filterColumns(columns, config);
    const tables = await this.createTables(filteredColumns, schemaName);

    return await this.createSchemaInfo(tables, schemaName);
  }
}
