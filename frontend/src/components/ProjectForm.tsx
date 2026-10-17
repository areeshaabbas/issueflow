import { Loader2, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { api } from '../lib/api';
import type { Project } from '../types';
import { Modal } from './ui';
export function ProjectForm({
  project,
  onClose,
  onSaved,
  onDelete,
}: {
  project: Project | 'new';
  onClose: () => void;
  onSaved: () => void;
  onDelete: (id: number) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const editing = project !== 'new';
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const f = new FormData(e.currentTarget);
    try {
      await api(editing ? '/projects/' + project.id : '/projects', editing ? 'PATCH' : 'POST', {
        name: f.get('name'),
        description: f.get('description'),
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={editing ? 'Edit project' : 'New project'} onClose={onClose}>
      <form className="modal-body form-stack" onSubmit={submit}>
        <p className="form-intro">Use a name your teammates will recognize.</p>
        <label>
          Project name
          <input
            name="name"
            placeholder="e.g. Website redesign"
            defaultValue={editing ? project.name : ''}
            minLength={2}
            maxLength={100}
            required
          />
        </label>
        <label>
          Description <span className="optional">optional</span>
          <textarea
            name="description"
            placeholder="What are we building?"
            defaultValue={editing ? project.description : ''}
            maxLength={5000}
            rows={4}
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="form-actions">
          {editing && (
            <button
              type="button"
              className="icon-btn delete-action"
              aria-label="Delete project"
              onClick={() => onDelete(project.id)}
            >
              <Trash2 size={17} />
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? (
              <Loader2 size={16} className="spin" />
            ) : editing ? (
              'Save changes'
            ) : (
              'Create project'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
