import type { Response } from "express";
import type { z } from "zod/v4";

export function parseWithValidation<TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown,
  res: Response,
  error: string,
): z.ZodSafeParseResult<z.output<TSchema>> {
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    res.status(400).json({
      error,
      details: parsed.error.flatten(),
    });
  }

  return parsed;
}
