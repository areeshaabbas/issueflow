import { Loader2, MessageSquare, Pencil, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { date, statuses } from '../lib/format';
import type { Comment, Issue, User } from '../types';
import { Avatar, Modal, Priority } from './ui';
export function IssueDetail({
  issue,
  user,
  onClose,
  onEdit,
  onDelete,
  onUpdate,
}: {
  issue: Issue;
  user: User;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onUpdate: (i: Issue) => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [body, setBody] = useState('');
  useEffect(() => {
    let active = true;
    setComments([]);
    setError('');
    api<Comment[]>(`/issues/${issue.id}/comments`)
      .then((rows) => {
        if (active) setComments(rows);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [issue.id]);
  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const c = await api<Comment>(`/issues/${issue.id}/comments`, 'POST', { body });
      setComments([...comments, c]);
      setBody('');
      onUpdate({ ...issue, comment_count: issue.comment_count + 1 });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function change(status: string) {
    try {
      onUpdate(await api<Issue>('/issues/' + issue.id, 'PATCH', { status }));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Modal wide title={issue.key + ' / ' + issue.project_name} onClose={onClose}>
      <div className="modal-body issue-detail">
        <div className="detail-title">
          <h2>{issue.title}</h2>
          <button
            className="icon-btn bordered"
            title="Edit issue"
            aria-label="Edit issue"
            onClick={onEdit}
          >
            <Pencil size={16} />
          </button>
        </div>
        <div className="detail-properties">
          <label>
            Status
            <select value={issue.status} onChange={(e) => change(e.target.value)}>
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <div>
            <small>Priority</small>
            <Priority value={issue.priority} />
          </div>
          <div>
            <small>Assignee</small>
            {issue.assignee ? (
              <span className="person">
                <Avatar user={issue.assignee} small />
                {issue.assignee.name}
              </span>
            ) : (
              <span>Unassigned</span>
            )}
          </div>
        </div>
        <h3>Description</h3>
        <p className="issue-description">{issue.description || 'No description provided.'}</p>
        <div className="detail-date">
          Created {date(issue.created_at)} · Updated {date(issue.updated_at)}
        </div>
        <section className="comments">
          <h3>
            <MessageSquare size={16} />
            Discussion <span className="count-badge">{comments.length}</span>
          </h3>
          {comments.map((c) => (
            <article className="comment" key={c.id}>
              <Avatar user={c.author} small />
              <div>
                <strong>{c.author.name}</strong>
                <time>{date(c.created_at)}</time>
                <p>{c.body}</p>
              </div>
            </article>
          ))}
          {!comments.length && <p className="muted">No comments yet.</p>}
          <form className="comment-form" onSubmit={addComment}>
            <Avatar user={user} small />
            <div>
              <textarea
                aria-label="Write a comment"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Share an update or ask a question…"
                rows={3}
                maxLength={5000}
                required
              />
              <button className="btn primary" disabled={busy || !body.trim()}>
                {busy ? (
                  <Loader2 className="spin" size={15} />
                ) : (
                  <>
                    <MessageSquare size={14} />
                    Add comment
                  </>
                )}
              </button>
            </div>
          </form>
        </section>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="detail-footer">
          <button className="text-btn delete-action" onClick={onDelete}>
            <Trash2 size={14} />
            Delete issue
          </button>
          <button className="btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
