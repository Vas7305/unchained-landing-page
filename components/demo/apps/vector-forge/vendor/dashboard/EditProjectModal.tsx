import { useState } from 'react';
import { Modal } from '../primitives/Modal';
import { Input } from '../primitives/Input';
import { Button } from '../primitives/Button';
import { PROJECT_NAME_MAX } from '../services/projects';
import styles from './NewProjectModal.module.css';

interface EditProjectModalProps {
  open: boolean;
  currentName: string;
  currentDescription: string;
  onClose: () => void;
  onSave: (name: string, description: string) => void;
}

export function EditProjectModal({
  open,
  currentName,
  currentDescription,
  onClose,
  onSave,
}: EditProjectModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState(false);

  // DEMO DIVERGENCE — as in NewProjectModal, the product fills the form from
  // an effect. Adjusting during render fills it before anything is painted,
  // so the dialog never flashes an empty name field on the way to the right
  // one. Same values, same trigger, one render pass instead of two.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setName(currentName);
      setDescription(currentDescription);
      setNameError(false);
    }
  }

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > PROJECT_NAME_MAX) {
      setNameError(true);
      return;
    }
    onSave(trimmed, description.trim());
    onClose();
  }

  function handleNameChange(v: string) {
    setName(v);
    if (nameError && v.trim()) setNameError(false);
  }

  const valid = name.trim().length > 0 && name.trim().length <= PROJECT_NAME_MAX;

  return (
    <Modal open={open} title="Edit Project" variant="default" onClose={onClose}>
      <div className={styles.body}>
        <Input
          label="Project Name"
          value={name}
          onChange={handleNameChange}
          placeholder="Project name"
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
            label="Save"
            disabled={!valid}
            onClick={handleSubmit}
          />
        </div>
      </div>
    </Modal>
  );
}
