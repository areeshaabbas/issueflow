import { Loader2, Plus } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Project, User } from '../types';
import { Avatar, Modal } from './ui';
export function Team({
  project,
  user,
  onClose,
  onSaved,
}: {
  project: Project;
  user: User;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [members, setMembers] = useState<User[]>([]),
    [email, setEmail] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api<User[]>(`/projects/${project.id}/members`)
      .then(setMembers)
      .catch((e) => setError(e.message));
  }, [project.id]);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const m = await api<User>(`/projects/${project.id}/members`, 'POST', { email });
      setMembers([...members, m]);
      setEmail('');
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Project members" onClose={onClose}>
      <div className="modal-body">
        <p className="form-intro">Members of {project.name}.</p>
        <div className="members">
          {members.map((m) => (
            <div className="member" key={m.id}>
              <Avatar user={m} />
              <div>
                <strong>{m.name}</strong>
                <small>{m.email}</small>
              </div>
              <span className="chip">{m.id === project.owner_id ? 'Owner' : 'Member'}</span>
            </div>
          ))}
        </div>
        {user.id === project.owner_id && (
          <form onSubmit={add} className="team-form">
            <label>
              Add a team member
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@company.com"
                required
              />
            </label>
            <p className="muted">They’ll need to create an IssueFlow account first.</p>
            <button className="btn primary" disabled={busy}>
              {busy ? (
                <Loader2 size={15} className="spin" />
              ) : (
                <>
                  <Plus size={15} />
                  Add member
                </>
              )}
            </button>
          </form>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
