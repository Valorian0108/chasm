import type { Response } from "express";

type ValidationResult =
  | { success: true; data: unknown }
  | { success: false; error: { flatten: () => unknown } };

type ValidationSchema = {
  safeParse: (input: unknown) => ValidationResult;
};

export function parseWithValidation<TSchema extends ValidationSchema>(
  schema: TSchema,
  input: unknown,
  res: Response,
  error: string,
): ReturnType<TSchema["safeParse"]>;

export function parseWithValidation(
  schema: ValidationSchema,
  input: unknown,
  res: Response,
  error: string,
): ValidationResult {
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    res.status(400).json({
      error,
      details: parsed.error.flatten(),
    });
  }

  return parsed;
}
