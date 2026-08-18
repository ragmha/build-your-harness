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
  // TODO(step-3): Read root/SKILL.md and all .md files under root/references.
  // Sort references by relative path so prompts and tests stay deterministic.
  void root;
  throw new Error("Not implemented: loadSkill");
}

export function renderSkillPrompt(skill: LoadedSkill): string {
  const references = skill.references
    .map((reference) => `\n## Reference: ${reference.path}\n\n${reference.content.trim()}`)
    .join("\n");

  return `${skill.instructions.trim()}${references}\n`;
}
