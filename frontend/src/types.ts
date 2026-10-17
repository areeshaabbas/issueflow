export type User = { id: number; name: string; email: string };
export type Project = {
  id: number;
  name: string;
  description: string;
  owner_id: number;
  total_issues: number;
  completed_issues: number;
  member_count: number;
};
export type Issue = {
  id: number;
  key: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  project_id: number;
  project_name: string;
  created_by: number;
  assigned_to: number | null;
  assignee: User | null;
  created_at: string;
  updated_at: string;
  comment_count: number;
};
export type Comment = { id: number; body: string; author: User; created_at: string };
export type Stats = {
  total: number;
  open: number;
  completed: number;
  in_progress: number;
  by_priority: Record<string, number>;
  by_status: Record<string, number>;
};
export type Page = 'overview' | 'projects' | 'issues' | 'mine' | 'project';
