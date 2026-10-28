import type { ZodType } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { ToolDefinition } from "../core/contracts";
import { HarnessError } from "../core/errors";

export interface ToolContext {
  signal: AbortSignal;
  runId?: string;
  toolCallId?: string;
  idempotencyKey?: string;
}

export interface Tool<TInput, TOutput> {
  name: string;
  description: string;
  effect?: "read" | "write";
  schema: ZodType<TInput>;
  execute(input: TInput, context: ToolContext): Promise<TOutput> | TOutput;
}

type AnyTool = Tool<unknown, unknown>;

export class ToolRegistry {
  readonly #tools = new Map<string, AnyTool>();

  register<TInput, TOutput>(tool: Tool<TInput, TOutput>): this {
    if (this.#tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }
    this.#tools.set(tool.name, tool as AnyTool);
    return this;
  }

  definitions(): ToolDefinition[] {
    return [...this.#tools.values()].map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: zodToJsonSchema(tool.schema) as Record<string, unknown>,
    }));
  }

  effectOf(name: string): "read" | "write" {
    const tool = this.#tools.get(name);
    if (!tool) {
      throw new HarnessError("UNKNOWN_TOOL", `Unknown tool: ${name}`);
    }
    return tool.effect ?? "read";
  }

  async execute(name: string, input: unknown, context: ToolContext): Promise<unknown> {
    const tool = this.#tools.get(name);
    if (!tool) {
      throw new HarnessError("UNKNOWN_TOOL", `Unknown tool: ${name}`);
    }

    const parsed = tool.schema.safeParse(input);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "(input)"}: ${issue.message}`)
        .join("; ");
      throw new HarnessError("INVALID_ARGUMENTS", `Invalid arguments for ${name}: ${issues}`);
    }

    return await tool.execute(parsed.data, context);
  }
}
