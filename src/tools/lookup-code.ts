import { z } from "zod";
import type { Tool } from "./registry";

const entries: Readonly<Record<string, string>> = {
  ALPHA: "Alpha is the first synthetic entry.",
  BRAVO: "Bravo is the second synthetic entry.",
};

export const lookupCodeTool: Tool<{ code: string }, { found: boolean; value: string | null }> = {
  name: "lookup_code",
  description: "Look up a value in a small synthetic, read-only code table.",
  schema: z.object({
    code: z.string().trim().min(1).transform((value) => value.toUpperCase()),
  }),
  execute({ code }) {
    const value = entries[code];
    return { found: value !== undefined, value: value ?? null };
  },
};
