import { Loader2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { priorities, statuses } from '../lib/format';
import type { Issue, Project, User } from '../types';
import { Modal } from './ui';
export function IssueForm({
  issue,
  projects,
  defaultPid,
  defaultStatus,
  onClose,
  onSaved,
}: {
  issue: Issue | 'new';
  projects: Project[];
  defaultPid: number | null;
  defaultStatus: string;
  onClose: () => void;
  onSaved: (i: Issue) => void;
}) {
  const editing = issue !== 'new';
  const [pid, setPid] = useState(editing ? issue.project_id : defaultPid || projects[0]?.id),
    [members, setMembers] = useState<User[]>([]),
    [assignee, setAssignee] = useState(editing ? String(issue.assigned_to || '') : ''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setMembers([]);
    api<User[]>(`/projects/${pid}/members`)
      .then((m) => {
        if (active) setMembers(m);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [pid]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const f = new FormData(e.currentTarget);
    try {
      const i = await api<Issue>(
        editing ? '/issues/' + issue.id : `/projects/${pid}/issues`,
        editing ? 'PATCH' : 'POST',
        {
          title: f.get('title'),
          description: f.get('description'),
          status: f.get('status'),
          priority: f.get('priority'),
          assigned_to: assignee ? Number(assignee) : null,
        },
      );
      onSaved(i);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={editing ? 'Edit ' + issue.key : 'New issue'} onClose={onClose}>
      <form className="modal-body form-stack" onSubmit={submit}>
        <label>
          Project
          <select
            value={pid}
            disabled={editing}
            onChange={(e) => {
              setPid(Number(e.target.value));
              setAssignee('');
            }}
          >
            {projects.map((p) => (
              <option value={p.id} key={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Issue title
          <input
            name="title"
            placeholder="e.g. Login redirects to an empty page"
            defaultValue={editing ? issue.title : ''}
            minLength={3}
            maxLength={180}
            required
          />
        </label>
        <label>
          Description <span className="optional">optional</span>
          <textarea
            name="description"
            placeholder="Describe the problem, expected behavior, and steps to reproduce."
            defaultValue={editing ? issue.description : ''}
            rows={4}
            maxLength={15000}
          />
        </label>
        <div className="form-row">
          <label>
            Status
            <select name="status" defaultValue={editing ? issue.status : defaultStatus}>
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Priority
            <select name="priority" defaultValue={editing ? issue.priority : 'Medium'}>
              {priorities.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Assignee
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option value={m.id} key={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? (
              <Loader2 className="spin" size={16} />
            ) : editing ? (
              'Save changes'
            ) : (
              'Create issue'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
