/**
 * `scampjs/templates` — the shapes of the templates export. Contract 0
 * ships the types; the implementations arrive with contract 1 (phase 2),
 * ported from the Scamp app's `src/shared/templates/`, so that
 * `create-scampjs` and the app's New project scaffold identical files
 * from one source. See CONTRACT.md, section 3.
 */

/** Relative POSIX path from the project root → file contents. */
export type FileMap = Record<string, string>;

/** Options for scaffolding a whole project. */
export type ProjectTemplateOptions = {
  /** The project name, used for package.json and the document title. */
  name: string;
};

/** Scaffolds a whole project: views/, routes/index.tsx, design/, package.json. */
export type ProjectTemplate = (opts: ProjectTemplateOptions) => FileMap;

/** Scaffolds `views/<Name>/<Name>.tsx` and its CSS module. */
export type ViewTemplate = (name: string) => FileMap;

/** Scaffolds `components/<Name>/<Name>.tsx` and its CSS module. */
export type ComponentTemplate = (name: string) => FileMap;
