import { useState } from 'react';
import { Modal } from '../primitives/Modal';
import { Input } from '../primitives/Input';
import { Button } from '../primitives/Button';
import { PROJECT_NAME_MAX } from '../services/projects';
import styles from './NewProjectModal.module.css';

interface NewProjectModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string) => void;
}

export function NewProjectModal({ open, onClose, onCreate }: NewProjectModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState(false);

  // DEMO DIVERGENCE — the product clears the form in an effect keyed on
  // `open`, which runs after a render has already painted the stale values.
  // Adjusting during render is React's own remedy for state that has to follow
  // a prop: the component re-renders immediately with the cleared form and the
  // stale one is never shown. Behaviour is identical; the extra pass is not.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) {
      setName('');
      setDescription('');
      setNameError(false);
    }
  }

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > PROJECT_NAME_MAX) {
      setNameError(true);
      return;
    }
    onCreate(trimmed, description.trim());
    onClose();
  }

  function handleNameChange(v: string) {
    setName(v);
    if (nameError && v.trim()) setNameError(false);
  }

  const valid = name.trim().length > 0 && name.trim().length <= PROJECT_NAME_MAX;

  return (
    <Modal open={open} title="New Project" variant="default" onClose={onClose}>
      <div className={styles.body}>
        <Input
          label="Project Name"
          value={name}
          onChange={handleNameChange}
          placeholder="My Project"
          error={nameError}
        />
        {nameError && (
          <span className={styles.errorMsg} role="alert">
            {!name.trim() ? 'Name is required' : `Name must be ${PROJECT_NAME_MAX} characters or less`}
          </span>
        )}
        <Input
          label="Description (optional)"
          value={description}
          onChange={setDescription}
          placeholder="A brief description of this project"
        />
        <div className={styles.actions}>
          <Button variant="ghost" size="sm" label="Cancel" onClick={onClose} />
          <Button
            variant="primary"
            size="sm"
            label="Create Project"
            disabled={!valid}
            onClick={handleSubmit}
          />
        </div>
      </div>
    </Modal>
  );
}
