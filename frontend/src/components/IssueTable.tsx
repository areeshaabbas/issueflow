import { MessageSquare } from 'lucide-react';
import type { Issue } from '../types';
import { Avatar, Priority, StatusIcon } from './ui';
export function IssueTable({
  items,
  compact = false,
  onOpenIssue,
}: {
  items: Issue[];
  compact?: boolean;
  onOpenIssue: (issue: Issue) => void;
}) {
  return (
    <div className="table-scroll">
      <table className="issues-table">
        <thead>
          <tr>
            <th>Issue</th>
            {!compact && <th>Project</th>}
            <th>Status</th>
            <th>Priority</th>
            <th>Assignee</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id}>
              <td>
                <button className="issue-title" onClick={() => onOpenIssue(i)}>
                  <span className="issue-key">{i.key}</span>
                  <strong>{i.title}</strong>
                  {i.comment_count > 0 && (
                    <span className="comment-count">
                      <MessageSquare size={12} />
                      {i.comment_count}
                    </span>
                  )}
                </button>
              </td>
              {!compact && (
                <td>
                  <span className="project-label">
                    <span className={'project-dot color-' + (i.project_id % 4)} />
                    {i.project_name}
                  </span>
                </td>
              )}
              <td>
                <span className="status-label">
                  <StatusIcon status={i.status} />
                  {i.status}
                </span>
              </td>
              <td>
                <Priority value={i.priority} />
              </td>
              <td>
                {i.assignee ? (
                  <Avatar user={i.assignee} small />
                ) : (
                  <span className="unassigned" title="Unassigned">
                    —
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
