import { useState } from 'react';
import { FolderOpen, Plus, Pencil, ChevronDown, ChevronRight } from 'lucide-react';
import { useProjectStore } from '../stores/projectStore';
import { EditProjectModal } from '../dashboard/EditProjectModal';
import { NewProjectModal } from '../dashboard/NewProjectModal';
import type { Project } from '../types';
import styles from './SidebarProjectsSection.module.css';

export function SidebarProjectsSection() {
  const _projects = useProjectStore((s) => s._projects);
  const current = useProjectStore((s) => s.current);
  const openProject = useProjectStore((s) => s.openProject);
  const createProject = useProjectStore((s) => s.createProject);
  const editProject = useProjectStore((s) => s.editProject);

  const [collapsed, setCollapsed] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Project | null>(null);

  const sorted = Object.values(_projects).sort(
    (a, b) => b.metadata.updatedAt - a.metadata.updatedAt
  );

  return (
    <>
      <div className={styles.section}>
        <div className={styles.header}>
          <button
            className={styles.collapseBtn}
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            type="button"
          >
            <span className={styles.chevron} aria-hidden="true">
              {collapsed
                ? <ChevronRight size={11} strokeWidth={2} />
                : <ChevronDown size={11} strokeWidth={2} />}
            </span>
            <span className={styles.headerLabel}>Projects</span>
            {sorted.length > 0 && (
              <span className={styles.count}>{sorted.length}</span>
            )}
          </button>
          <button
            className={styles.addBtn}
            onClick={() => setNewOpen(true)}
            type="button"
            title="New project"
            aria-label="New project"
          >
            <Plus size={12} strokeWidth={2} />
          </button>
        </div>

        {!collapsed && (
          <ul className={styles.list}>
            {sorted.length === 0 ? (
              <li className={styles.empty}>No projects yet</li>
            ) : (
              sorted.map((project) => {
                const isActive = current?.id === project.metadata.id;
                return (
                  <li
                    key={project.metadata.id}
                    className={`${styles.row} ${isActive ? styles.active : ''}`}
                  >
                    <button
                      className={styles.nameBtn}
                      onClick={() => void openProject(project.metadata.id)}
                      type="button"
                      title={project.metadata.description || project.metadata.name}
                    >
                      <FolderOpen
                        size={13}
                        strokeWidth={1.5}
                        className={styles.folderIcon}
                        aria-hidden="true"
                      />
                      <span className={styles.name}>{project.metadata.name}</span>
                    </button>
                    <button
                      className={styles.editBtn}
                      onClick={(e) => { e.stopPropagation(); setEditTarget(project); }}
                      type="button"
                      title="Edit project"
                      aria-label={`Edit ${project.metadata.name}`}
                    >
                      <Pencil size={11} strokeWidth={1.5} />
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        )}
      </div>

      <NewProjectModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreate={(name, desc) => void createProject(name, desc)}
      />

      {editTarget && (
        <EditProjectModal
          open
          currentName={editTarget.metadata.name}
          currentDescription={editTarget.metadata.description}
          onClose={() => setEditTarget(null)}
          onSave={(name, description) => {
            void editProject(editTarget.metadata.id, name, description);
            setEditTarget(null);
          }}
        />
      )}
    </>
  );
}
