import type { Page } from '../types';

export function readRoute(hash = window.location.hash): { page: Page; projectId: number | null } {
  const [section, id] = hash.replace(/^#\/?/, '').split('/');
  if (section === 'projects' && /^\d+$/.test(id ?? '') && Number(id) > 0) {
    return { page: 'project', projectId: Number(id) };
  }
  const page = ['projects', 'issues', 'mine'].includes(section) ? (section as Page) : 'overview';
  return { page, projectId: null };
}

export function routeHash(page: Page, projectId: number | null) {
  return page === 'project' ? `#/projects/${projectId}` : `#/${page}`;
}
