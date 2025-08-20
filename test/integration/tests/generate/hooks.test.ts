import fs from 'fs';
import path from 'path';

import { generateZodSchemas } from '../../../../src/generateZodSchemas.js';
import {
  getClientConnectionString,
  getOutputDir,
  getOutputFiles,
  setupTestDb,
  teardownTestDb,
  TestDbContext,
} from '../../testDbUtils.js';

let ctx: TestDbContext;
let connectionString: string;

beforeAll(async () => {
  ctx = await setupTestDb();
  connectionString = getClientConnectionString();
});

afterAll(async () => {
  await teardownTestDb(ctx);
});

describe('hook options', () => {
  it('applies onColumnModelCreated hook to modify column schemas', async () => {
    const outputDir = getOutputDir('generate', 'hooks', 'column-hook');

    await generateZodSchemas({
      connectionString,
      moduleResolution: 'esm',
      outputDir,
      include: ['users'],
      onColumnModelCreated: (column) => {
        // Add custom validation to email columns
        if (column.name === 'email') {
          return {
            ...column,
            type: 'email',
            writeTransforms: ['trim', 'lowercase'],
          };
        }

        return column;
      },
    });

    const outputFiles = await getOutputFiles(outputDir);

    for (const file of outputFiles) {
      const content = fs.readFileSync(file, 'utf8');

      // Check if email validation was applied
      if (file.includes('schema.ts')) {
        expect(content).toMatch(/\.email\(\).trim\(\).lowercase\(\)/);
      }

      expect(content).toMatchSnapshot(path.relative(outputDir, file));
    }
  });

  it('applies onTableModelCreated hook to modify table schemas', async () => {
    const outputDir = getOutputDir('generate', 'hooks', 'table-hook');

    await generateZodSchemas({
      connectionString,
      moduleResolution: 'esm',
      outputDir,
      include: ['users'],
      onTableModelCreated: (table) => {
        // Add a custom description to all tables
        return {
          ...table,
          description: `Generated schema for ${table.name} table`,
        };
      },
    });

    const outputFiles = await getOutputFiles(outputDir);

    for (const file of outputFiles) {
      const content = fs.readFileSync(file, 'utf8');

      // Test captures the actual generated code
      expect(content).toMatchSnapshot(path.relative(outputDir, file));
    }
  });

  it('applies both column and table hooks together', async () => {
    const outputDir = getOutputDir('generate', 'hooks', 'combined-hooks');

    await generateZodSchemas({
      connectionString,
      moduleResolution: 'esm',
      outputDir,
      include: ['users'],
      onColumnModelCreated: (column) => {
        // Mark all string columns as trimmed
        if (column.type === 'string') {
          return {
            ...column,
            isTrimmed: true,
          };
        }
        return column;
      },
      onTableModelCreated: (table) => {
        // Add table metadata
        return {
          ...table,
          description: `Table: ${table.name} (${table.columns.length} columns)`,
        };
      },
    });

    const outputFiles = await getOutputFiles(outputDir);

    for (const file of outputFiles) {
      const content = fs.readFileSync(file, 'utf8');

      // Test captures the actual generated code
      expect(content).toMatchSnapshot(path.relative(outputDir, file));
    }
  });
});
