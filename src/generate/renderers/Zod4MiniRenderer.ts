import type { ZodPgConfig } from '../../types.js';
import type { ZodPgColumnBaseModel } from './types.js';

import { Zod4Renderer } from './Zod4Renderer.js';

export class Zod4MiniRenderer extends Zod4Renderer {
  protected getSchemaTemplateName(config: ZodPgConfig): string {
    if (config.disableCaseTransform) return 'schema.simple';
    return 'schema.4mini';
  }

  protected override renderReadField(
    column: ZodPgColumnBaseModel,
    config: ZodPgConfig
  ): string {
    let zodType = this.renderZodType(column.type, config, true);

    if (column.isEnum) {
      zodType = `z.enum(${column.enumConstantName})`;
    }

    if (column.isArray) {
      zodType = `z.array(${zodType})`;
    }

    if (
      column.type === 'json' &&
      config.jsonSchemaImportLocation &&
      column.jsonSchemaName
    ) {
      zodType = column.jsonSchemaName;
    }

    if (column.isNullable) {
      zodType = `z.nullable(${zodType})`;
    }

    if (column.isOptional) {
      zodType = `z.optional(${zodType})`;
    }

    if (column.isNullable || column.isOptional) {
      if (column.isArray && config.defaultEmptyArray)
        zodType = `z.pipe(${zodType}, z.transform(val => val ?? []))`;
      else zodType = `z.pipe(${zodType}, z.transform(val => val ?? undefined))`;
    }

    return zodType;
  }

  protected override renderWriteField(
    column: ZodPgColumnBaseModel,
    config: ZodPgConfig
  ): string {
    let zodType = this.renderZodType(column.type, config, false);

    if (column.writeTransforms?.includes('trim')) {
      zodType = `${zodType}.check(z.trim())`;
    }

    if (column.writeTransforms?.includes('lowercase')) {
      zodType = `${zodType}.check(z.lowercase())`;
    }

    if (column.writeTransforms?.includes('uppercase')) {
      zodType = `${zodType}.check(z.uppercase())`;
    }

    if (column.writeTransforms?.includes('normalize')) {
      zodType = `${zodType}.check(z.normalize())`;
    }

    if (column.writeTransforms?.includes('nonnegative')) {
      zodType = `${zodType}.check(z.nonnegative())`;
    }

    if (column.isEnum) {
      zodType = `z.enum(${column.enumConstantName})`;
    }

    if (column.isArray) {
      zodType = `z.array(${zodType})`;
    }

    if (
      column.type === 'json' &&
      config.jsonSchemaImportLocation &&
      column.jsonSchemaName
    ) {
      zodType = column.jsonSchemaName;
    }

    if (
      column.minLen !== undefined &&
      column.minLen !== null &&
      !column.isEnum
    ) {
      if (column.type === 'string')
        zodType = `${zodType}.check(z.minLength(${column.minLen}))`;
      else if (column.type === 'number' || column.type === 'int')
        zodType = `${zodType}.check(z.minimum(${column.minLen}))`;
    }

    if (
      column.maxLen !== undefined &&
      column.maxLen !== null &&
      !column.isEnum
    ) {
      if (column.type === 'string')
        zodType = `${zodType}.check(z.maxLength(${column.maxLen}))`;
      else if (column.type === 'number' || column.type === 'int')
        zodType = `${zodType}.check(z.maximum(${column.maxLen}))`;
    }

    if (column.isNullable) {
      zodType = `z.nullable(${zodType})`;
    }

    if (column.isOptional) {
      zodType = `z.optional(${zodType})`;
    }

    if (column.type === 'json' && !config.disableStringifyJson) {
      if (!column.isNullable)
        zodType = `z.pipe(${zodType}, z.transform((value) => JSON.stringify(value)))`;
      else
        zodType = `z.pipe(${zodType}, z.transform((value) => value ? JSON.stringify(value) : value))`;
    }

    if (column.type === 'date' && config.stringifyDates) {
      if (column.isArray) {
        if (!column.isNullable)
          zodType = `z.pipe(${zodType}, z.transform((value) => value.map(date => date.toISOString())))`;
        else
          zodType = `z.pipe(${zodType}, z.transform((value) => value ? value.map(date => date.toISOString()) : value))`;
      } else {
        if (!column.isNullable)
          zodType = `z.pipe(${zodType}, z.transform((value) => value.toISOString()))`;
        else
          zodType = `z.pipe(${zodType}, z.transform((value) => value ? value.toISOString() : value))`;
      }
    }

    return zodType;
  }
}
