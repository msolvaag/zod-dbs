import type { ZodPgColumnType, ZodPgConfig } from '../../types.js';

import { DefaultRenderer } from './DefaultRenderer.js';

export class Zod4Renderer extends DefaultRenderer {
  protected override renderZodType(
    zodType: ZodPgColumnType,
    config: ZodPgConfig,
    isReadField: boolean
  ): string {
    let renderedType = super.renderZodType(zodType, config, isReadField);

    if (zodType === 'json') {
      renderedType = 'z.json()';
    }

    // For read fields, we don't apply additional validation or transformations.
    if (isReadField) return renderedType;

    switch (zodType) {
      case 'email':
        return 'z.email()';
      case 'url':
        return 'z.url()';
      case 'int':
        return 'z.int()';
      case 'uuid':
        return 'z.uuid()';
      default:
        return renderedType;
    }
  }
}
