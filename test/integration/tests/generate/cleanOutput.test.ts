import fs from 'fs';
import path from 'path';

import { generateZodSchemas } from '../../../../src/generateZodSchemas.js';
import {
  deleteOutputFiles,
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
  await deleteOutputFiles(getOutputDir('generate', 'cleanOutput'));
});

describe('clean output option', () => {
  it('cleans output directory when cleanOutput is true', async () => {
    const outputDir = getOutputDir('generate', 'cleanOutput', 'clean-enabled');

    // Create the output directory with some existing files
    await fs.promises.mkdir(`${outputDir}/tables`, { recursive: true });
    await fs.promises.writeFile(
      `${outputDir}/tables/old-file.ts`,
      '// old content'
    );
    await fs.promises.writeFile(
      `${outputDir}/old-root-file.ts`,
      '// old root content'
    );

    // Verify files exist before generation
    expect(fs.existsSync(`${outputDir}/tables/old-file.ts`)).toBe(true);
    expect(fs.existsSync(`${outputDir}/old-root-file.ts`)).toBe(true);

    await generateZodSchemas({
      connection: {
        connectionString,
        ssl: false,
      },
      outputDir: outputDir,
      cleanOutput: true,
      include: ['users'],
    });

    // Old files in tables directory should be cleaned
    expect(fs.existsSync(`${outputDir}/tables/old-file.ts`)).toBe(false);

    // cleanOutput should clean the entire output directory
    expect(fs.existsSync(`${outputDir}/tables/old-table-file.ts`)).toBe(false);
    expect(fs.existsSync(`${outputDir}/old-root-file.ts`)).toBe(false);

    const outputFiles = await getOutputFiles(outputDir);

    for (const file of outputFiles) {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toMatchSnapshot(path.relative(outputDir, file));
    }
  });

  it('preserves existing files when cleanOutput is false', async () => {
    const outputDir = getOutputDir('generate', 'cleanOutput', 'clean-disabled');

    // Create the output directory with some existing files
    await fs.promises.mkdir(`${outputDir}/tables`, { recursive: true });
    await fs.promises.writeFile(
      `${outputDir}/tables/old-file.ts`,
      '// old content'
    );

    // Verify file exists before generation
    expect(fs.existsSync(`${outputDir}/tables/old-file.ts`)).toBe(true);

    await generateZodSchemas({
      connection: {
        connectionString,
        ssl: false,
      },
      outputDir,
      cleanOutput: false,
      include: ['users'],
    });

    // Old file should still exist
    expect(fs.existsSync(`${outputDir}/tables/old-file.ts`)).toBe(true);
    const oldContent = fs.readFileSync(
      `${outputDir}/tables/old-file.ts`,
      'utf8'
    );
    expect(oldContent).toBe('// old content');

    const outputFiles = await getOutputFiles(outputDir);

    for (const file of outputFiles) {
      const content = fs.readFileSync(file, 'utf8');
      expect(content).toMatchSnapshot(path.relative(outputDir, file));
    }
  });
});
