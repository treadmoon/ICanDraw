/**
 * Sanitization utilities for AI prompts
 * Prevents prompt injection by escaping user-controlled data
 */

const MAX_STRING_LENGTH = 2000;

/**
 * Sanitize a string for safe embedding in AI prompts
 * Removes potential prompt injection patterns
 */
export function sanitizeForPrompt(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .slice(0, MAX_STRING_LENGTH)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'")
    .replace(/`/g, "\\`")
    .replace(/```/g, "`` `")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\n/g, "\\n")
    .replace(/[\x00-\x1F\x7F]/g, "");
}

/**
 * Sanitize a file path for safe embedding in prompts
 */
export function sanitizePath(path: string): string {
  if (!path) return "";
  return path
    .slice(0, 500)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'")
    .replace(/`/g, "\\`")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/\n/g, " ")
    .replace(/[\x00-\x1F\x7F]/g, "");
}

/**
 * Sanitize an array of strings
 */
export function sanitizeStringArray(arr: string[]): string[] {
  return arr.map((s) => sanitizeForPrompt(s));
}
