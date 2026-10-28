import { join } from "node:path";

export interface LoadedReference {
  path: string;
  content: string;
}

export interface LoadedSkill {
  root: string;
  instructions: string;
  references: LoadedReference[];
}

export async function loadSkill(root: string): Promise<LoadedSkill> {
  const instructions = await Bun.file(join(root, "SKILL.md")).text();

  const paths: string[] = [];
  for await (const path of new Bun.Glob("references/**/*.md").scan({ cwd: root })) {
    paths.push(path.replaceAll("\\", "/"));
  }
  paths.sort();

  const references = await Promise.all(
    paths.map(async (path) => ({
      path,
      content: await Bun.file(join(root, path)).text(),
    })),
  );

  return { root, instructions, references };
}

export function renderSkillPrompt(skill: LoadedSkill): string {
  const references = skill.references
    .map((reference) => `\n## Reference: ${reference.path}\n\n${reference.content.trim()}`)
    .join("\n");

  return `${skill.instructions.trim()}${references}\n`;
}
