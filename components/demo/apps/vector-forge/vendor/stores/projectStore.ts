/**
 * The project store, adapted for the demo.
 *
 * ─── Why this one is not the product's ────────────────────────────────────
 * The real `projectStore` is 595 lines, and nearly all of them are about the
 * disk: creating a project directory, writing and repairing `project.json`,
 * scanning a workspace, migrating projects written by older versions,
 * recovering from a half-written save. There is no disk here, so copying it
 * would mean copying six hundred lines of code whose every branch is dead.
 *
 * What the vendored screens actually read is small and is reproduced exactly:
 * `current` (TopBar's project name and saved-at, ConvertScreen's guard before
 * importing), `_projects` and the three mutators the sidebar's project list
 * calls, and `updateActiveRefs`, which the product uses to mirror the active
 * asset into the store after a write.
 *
 * Projects created here live in this object and nowhere else. Reloading the
 * page, or pressing the demo's Reset, returns the workstation to the sample
 * project and loses them — which is the correct behaviour for a demo and is
 * enforced by `resetProjectStore` below rather than left to chance.
 */

import { create } from 'zustand';

import { demoProject } from '@/lib/demo/apps/vector-forge/data';

import type { CurrentProject, Project } from '../types';

interface ProjectStore {
  current: CurrentProject | null;
  _projects: Record<string, Project>;

  openProject(id: string): Promise<void>;
  createProject(name: string, description: string): Promise<void>;
  editProject(id: string, name: string, description: string): Promise<void>;
  updateActiveRefs(refs: Partial<Pick<CurrentProject, 'activeAssetId' | 'activeSvgId'>>): void;
}

function currentFrom(project: Project): CurrentProject {
  return {
    id: project.metadata.id,
    name: project.metadata.name,
    saved: true,
    savedAt: project.metadata.updatedAt,
    dir: demoProject.dir,
    activeAssetId: '',
    activeSvgId: '',
    activeOptimizedSvgId: '',
  };
}

function seed(): Pick<ProjectStore, 'current' | '_projects'> {
  const sample: Project = {
    metadata: {
      id: demoProject.id,
      name: demoProject.name,
      description: demoProject.description,
      createdAt: demoProject.createdAt,
      updatedAt: demoProject.updatedAt,
    },
    settings: { qualityPreset: 'balanced', exportDir: '' },
  };

  return { current: currentFrom(sample), _projects: { [sample.metadata.id]: sample } };
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  ...seed(),

  openProject: async (id) => {
    const project = get()._projects[id];
    if (project) set({ current: currentFrom(project) });
  },

  createProject: async (name, description) => {
    // Deterministic id and timestamps: the sidebar sorts by `updatedAt`, and a
    // demo whose list reorders itself between two identical runs is a demo
    // that cannot be screenshotted.
    const count = Object.keys(get()._projects).length;
    const id = `vf-demo-project-${count}`;
    const at = demoProject.updatedAt + count * 60_000;

    const project: Project = {
      metadata: { id, name, description, createdAt: at, updatedAt: at },
      settings: { qualityPreset: 'balanced', exportDir: '' },
    };

    set((state) => ({
      _projects: { ...state._projects, [id]: project },
      current: currentFrom(project),
    }));
  },

  editProject: async (id, name, description) => {
    set((state) => {
      const project = state._projects[id];
      if (!project) return state;

      const updated: Project = {
        ...project,
        metadata: { ...project.metadata, name, description },
      };

      return {
        _projects: { ...state._projects, [id]: updated },
        current: state.current?.id === id ? currentFrom(updated) : state.current,
      };
    });
  },

  updateActiveRefs: (refs) => {
    set((state) => (state.current ? { current: { ...state.current, ...refs } } : state));
  },
}));

/** @internal Called by the demo's Reset. See vendor/demo-reset.ts. */
export function resetProjectStore(): void {
  useProjectStore.setState(seed());
}
