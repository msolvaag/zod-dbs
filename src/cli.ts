import { Option, program } from 'commander';

import { getConfiguration } from './config.js';
import { createConnectionString } from './database/client.js';
import { generateZodSchemas } from './generateZodSchemas.js';
import { ZodPgConfig } from './types.js';
import {
  enableDebug,
  logAppName,
  logDebug,
  logError,
  logSetting,
  toError,
} from './utils/index.js';
import { maskConnectionString } from './utils/mask.js';
import { createProgressHandler } from './utils/progress.js';
import { getAppVersion } from './utils/version.js';

/**
 * Main entrypoint: connects to Postgres, cleans output, generates Zod schemas for all tables, and writes an index file.
 */
export const main = async (overrides?: Partial<ZodPgConfig>) => {
  const config = await getConfiguration(overrides);
  const appVersion = await getAppVersion();

  program.name('zod-pg');
  program.description('Generates Zod schemas from PostgreSQL database tables.');
  program.option(
    '-o,--output-dir <path>',
    'Output directory for generated schemas'
  );
  program.option('--silent', 'Suppress all console output', config.silent);
  program.option(
    '--module-resolution <type>',
    'Module resolution type for generated files (commonjs or esm)'
  );
  program.option(
    '--clean-output',
    'Clean output directory before generating schemas'
  );
  program.option(
    '--no-coerce-dates',
    'Disable using z.coerce.date() for date fields in read schemas'
  );
  program.option(
    '--no-stringify-json',
    'Disable JSON.stringify() on json fields in write schemas'
  );
  program.option(
    '--stringify-dates',
    'Convert dates to ISO strings in write schemas'
  );
  program.option(
    '--default-empty-array',
    'Provide empty arrays as defaults for nullable array fields'
  );
  program.addOption(
    new Option(
      '--object-name-casing <type>',
      'Casing for generated object/type names'
    )
      .choices(['PascalCase', 'camelCase', 'snake_case'])
      .default(config.objectNameCasing)
  );
  program.addOption(
    new Option(
      '--field-name-casing <type>',
      'Casing for field/property names in schemas & records'
    )
      .choices(['camelCase', 'snake_case', 'PascalCase', 'passthrough'])
      .default(config.fieldNameCasing)
  );
  program.option(
    '--no-case-transform',
    'Disable case transformations / conversions for generated schemas'
  );
  program.option(
    '--no-singularize',
    'Disable singularization of type and enum names'
  );
  program.option('--exclude <regex>', 'Exclude tables matching this regex');
  program.option(
    '--include <regex>',
    'Include only tables matching this regex'
  );
  program.option('--schema <name>', 'Specify schema name (default: public)');
  program.option(
    '--json-schema-import-location <path>',
    'Path to import JSON schemas'
  );
  program.option('--connection-string <string>', 'Postgres connection string');
  program.option('--password <string>', 'Postgres password');
  program.option('--user <string>', 'Postgres user');
  program.option('--database <string>', 'Postgres database');
  program.option('--host <string>', 'Postgres host');
  program.option('--ssl', 'Use SSL for Postgres connection');
  program.option('--port <number>', 'Postgres port');
  program.option('--zod-version <number>', 'Zod version to use');
  program.option(
    '--debug',
    'Enable debug logging',
    () => {
      enableDebug();
      return true;
    },
    false
  );

  program.parse();
  const options = program.opts();

  const cliConfig: ZodPgConfig = { ...config, ...options };

  logDebug('CLI configuration:', cliConfig);

  if (!cliConfig.silent) {
    logAppName(`zod-pg CLI v${appVersion}`);

    logSetting('output', cliConfig.outputDir);
    if (cliConfig.cleanOutput) logSetting('clean-output', 'true');
    if (cliConfig.coerceDates) logSetting('coerce-dates', 'true');
    if (cliConfig.stringifyDates) logSetting('stringify-dates', 'true');
    if (cliConfig.defaultEmptyArray) logSetting('default-empty-array', 'true');
    if (cliConfig.stringifyJson) logSetting('stringify-json', 'true');
    if (cliConfig.coerceDates) logSetting('coerce-dates', 'true');
    if (cliConfig.caseTransform) logSetting('case-transform', 'true');
    if (cliConfig.moduleResolution)
      logSetting('module', cliConfig.moduleResolution);
    if (cliConfig.zodVersion) logSetting('zod-version', cliConfig.zodVersion);
    logSetting(
      'connection-string',
      maskConnectionString(createConnectionString(cliConfig))
    );
    logSetting('ssl', cliConfig.ssl ? 'true' : 'false');
    if (cliConfig.schemaName) logSetting('schema', cliConfig.schemaName);

    if (process.env.DEBUG) logSetting('debug', process.env.DEBUG);

    if (cliConfig.include) logSetting('include', options.include);
    if (cliConfig.exclude) logSetting('exclude', options.exclude);

    if (cliConfig.jsonSchemaImportLocation) {
      logSetting('json-import-location', cliConfig.jsonSchemaImportLocation);
    }

    console.log();
  }

  const spinner = createProgressHandler(cliConfig.silent);

  try {
    await generateZodSchemas({
      ...cliConfig,
      onProgress: spinner.onProgress,
    });

    spinner.done();
  } catch (error) {
    spinner.fail();

    logError(toError(error).message);
    logDebug(error);

    process.exit(1);
  }
};
