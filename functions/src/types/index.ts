// Re-export everything from the types layer for convenient single-import access.
export * from "./enums";
export * from "./order";
export * from "./product";
export * from "./user";

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string; field?: string };
