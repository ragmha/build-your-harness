import { readdir, readFile, realpath, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { z } from "zod";
import { ToolRegistry } from "./registry";

async function workspacePath(root: string, requested: string): Promise<string> {
  if (isAbsolute(requested)) throw new Error("Use a workspace-relative path");

  const workspace = await realpath(root);
  const path = await realpath(resolve(workspace, requested || "."));
  const fromRoot = relative(workspace, path);
  if (fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
    throw new Error("Path is outside the workspace");
  }
  return path;
}

export function registerFileTools(tools: ToolRegistry, root: string): void {
  tools.register({
    name: "list_files",
    description: "List files and directories directly inside a workspace directory.",
    schema: z.object({ path: z.string().default("") }),
    async execute({ path }) {
      const entries = await readdir(await workspacePath(root, path ?? ""), {
        withFileTypes: true,
      });
      return entries
        .filter((entry) => !entry.isSymbolicLink())
        .map((entry) => ({
          name: entry.name,
          type: entry.isDirectory() ? "directory" : "file",
        }));
    },
  });

  tools.register({
    name: "read_file",
    description: "Read a UTF-8 text file inside the workspace.",
    schema: z.object({ path: z.string().min(1) }),
    async execute({ path }) {
      return await readFile(await workspacePath(root, path), "utf8");
    },
  });

  tools.register({
    name: "edit_file",
    description: "Replace one exact, unique text range in an existing workspace file.",
    effect: "write",
    schema: z.object({
      path: z.string().min(1),
      oldText: z.string().min(1),
      newText: z.string(),
    }),
    async execute({ path, oldText, newText }) {
      const file = await workspacePath(root, path);
      const contents = await readFile(file, "utf8");
      const start = contents.indexOf(oldText);
      if (start < 0 || contents.indexOf(oldText, start + oldText.length) >= 0) {
        throw new Error("Expected text must match exactly once; file was not changed");
      }
      await writeFile(
        file,
        contents.slice(0, start) + newText + contents.slice(start + oldText.length),
      );
      return { path, changed: true };
    },
  });
}
