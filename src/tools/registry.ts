import type { ZodType } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { ToolDefinition } from "../core/contracts";
import { HarnessError } from "../core/errors";

export interface ToolContext {
  signal: AbortSignal;
}

export interface Tool<TInput, TOutput> {
  name: string;
  description: string;
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

  async execute(name: string, input: unknown, context: ToolContext): Promise<unknown> {
    // TODO(step-2): Find the named tool, validate input with safeParse, and
    // execute it. Throw UNKNOWN_TOOL or INVALID_ARGUMENTS HarnessErrors.
    void name;
    void input;
    void context;
    throw new Error("Not implemented: ToolRegistry.execute");
  }
}
