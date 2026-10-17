import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  Columns3,
  Folder,
  Layers,
  LayoutDashboard,
  List,
  Loader2,
  LogOut,
  Menu,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Auth } from './components/Auth';
import { IssueDetail } from './components/IssueDetail';
import { IssueForm } from './components/IssueForm';
import { IssueTable } from './components/IssueTable';
import { ProjectForm } from './components/ProjectForm';
import { Team } from './components/Team';
import { Avatar, Modal, Priority, StatusIcon } from './components/ui';
import { api, ApiError } from './lib/api';
import { readRoute, routeHash } from './lib/navigation';
import { cx, initials, priorities, statuses } from './lib/format';
import type { Issue, Page, Project, Stats, User } from './types';
export function App() {
  const [user, setUser] = useState<User | null>(null),
    [boot, setBoot] = useState(true),
    [page, setPage] = useState<Page>(() => readRoute().page),
    [projects, setProjects] = useState<Project[]>([]),
    [pid, setPid] = useState<number | null>(() => readRoute().projectId),
    [stats, setStats] = useState<Stats | null>(null),
    [issues, setIssues] = useState<Issue[]>([]),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [toast, setToast] = useState(''),
    [search, setSearch] = useState(''),
    [query, setQuery] = useState(''),
    [status, setStatus] = useState(''),
    [priority, setPriority] = useState(''),
    [index, setIndex] = useState(1),
    [view, setView] = useState('list'),
    [mobile, setMobile] = useState(false),
    [projectModal, setProjectModal] = useState<Project | 'new' | null>(null),
    [issueModal, setIssueModal] = useState<Issue | 'new' | null>(null),
    [newIssueStatus, setNewIssueStatus] = useState('Todo'),
    [detail, setDetail] = useState<Issue | null>(null),
    [team, setTeam] = useState(false),
    [confirm, setConfirm] = useState<{ kind: 'project' | 'issue'; id: number } | null>(null);
  const project = projects.find((p) => p.id === pid);
  const requestId = useRef(0);
  const notify = (text: string) => setToast(text);
  const clearSession = useCallback(() => {
    requestId.current += 1;
    setUser(null);
    setProjects([]);
    setIssues([]);
    setStats(null);
    setDetail(null);
    setIssueModal(null);
    setProjectModal(null);
    setConfirm(null);
    setTeam(false);
  }, []);
  useEffect(() => {
    api<User>('/auth/me')
      .then(setUser)
      .catch((e) => {
        if (!(e instanceof ApiError) || e.status !== 401) {
          setError('Could not load your session. Check your connection and try signing in again.');
        }
      })
      .finally(() => setBoot(false));
    const expired = clearSession;
    window.addEventListener('session-expired', expired);
    return () => window.removeEventListener('session-expired', expired);
  }, [clearSession]);
  useEffect(() => {
    const onRouteChange = () => {
      const route = readRoute();
      setPage(route.page);
      setPid(route.projectId);
      setSearch('');
      setQuery('');
      setStatus('');
      setPriority('');
      setIndex(1);
    };
    window.addEventListener('hashchange', onRouteChange);
    return () => window.removeEventListener('hashchange', onRouteChange);
  }, []);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    const t = setTimeout(() => setQuery(search), 250);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    setIndex(1);
  }, [query, status, priority, page, pid]);
  const refresh = useCallback(async () => {
    if (!user) return;
    const id = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(index), page_size: '50' });
      if (query) params.set('q', query);
      if (status) params.set('status', status);
      if (priority) params.set('priority', priority);
      if (page === 'mine') params.set('mine', 'true');
      const [p, s, i] = await Promise.all([
        api<Project[]>('/projects'),
        api<Stats>('/dashboard'),
        api<{ items: Issue[]; total: number }>(
          (page === 'project' && pid ? `/projects/${pid}/issues` : '/issues') + '?' + params,
        ),
      ]);
      if (id === requestId.current) {
        setProjects(p);
        setStats(s);
        setIssues(i.items);
        setTotal(i.total);
      }
    } catch (e) {
      if (id === requestId.current) setError((e as Error).message);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [user, page, pid, index, query, status, priority]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  const navigate = (p: Page, id: number | null = null) => {
    window.location.hash = routeHash(p, id);
    setPage(p);
    setPid(id);
    setSearch('');
    setQuery('');
    setStatus('');
    setPriority('');
    setIndex(1);
    setMobile(false);
  };
  async function logout() {
    try {
      await api('/auth/logout', 'POST');
      clearSession();
      navigate('overview');
    } catch (e) {
      notify((e as Error).message);
    }
  }
  async function changeStatus(i: Issue, next: string) {
    try {
      await api('/issues/' + i.id, 'PATCH', { status: next });
      await refresh();
      notify('Issue moved to ' + next);
    } catch (e) {
      notify((e as Error).message);
    }
  }
  async function doDelete() {
    if (!confirm) return;
    try {
      await api(
        '/' + (confirm.kind === 'project' ? 'projects' : 'issues') + '/' + confirm.id,
        'DELETE',
      );
      setConfirm(null);
      setDetail(null);
      if (confirm.kind === 'project') navigate('projects');
      await refresh();
      notify(confirm.kind === 'project' ? 'Project deleted' : 'Issue deleted');
    } catch (e) {
      notify((e as Error).message);
    }
  }
  if (boot)
    return (
      <div className="boot">
        <Loader2 className="spin" />
        Opening your workspace…
      </div>
    );
  if (!user)
    return (
      <Auth
        notice={error}
        onAuth={(u) => {
          setUser(u);
          navigate('overview');
        }}
      />
    );
  const navItems: [Page, typeof LayoutDashboard, string][] = [
    ['overview', LayoutDashboard, 'Overview'],
    ['issues', CircleDot, 'All issues'],
    ['mine', CheckCheck, 'My issues'],
    ['projects', Layers, 'Projects'],
  ];
  const title =
    page === 'overview'
      ? 'Workspace overview'
      : page === 'projects'
        ? 'Projects'
        : page === 'mine'
          ? 'My issues'
          : page === 'project'
            ? project?.name || 'Project'
            : 'All issues';
  const empty = (
    <div className="empty">
      <div className="empty-icon">
        <CircleDot size={27} />
      </div>
      <h3>{query || status || priority ? 'No matching issues' : 'No issues yet'}</h3>
      <p>
        {query || status || priority
          ? 'Try another search or change your filters.'
          : page === 'mine'
            ? 'Issues assigned to you will appear here.'
            : 'Create an issue to start tracking work in this project.'}
      </p>
      {!query && !status && !priority && page !== 'mine' && (
        <button
          className="btn"
          onClick={() => (projects.length ? setIssueModal('new') : setProjectModal('new'))}
        >
          <Plus size={15} />
          {projects.length ? 'Create an issue' : 'Create a project'}
        </button>
      )}
    </div>
  );
  return (
    <div className="app-shell">
      {mobile && <div className="sidebar-scrim" onClick={() => setMobile(false)} />}
      <aside className={cx('sidebar', mobile && 'mobile-open')}>
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            navigate('overview');
          }}
        >
          <span className="brand-icon">
            <Zap size={21} fill="currentColor" />
          </span>
          IssueFlow<span className="brand-period">.</span>
        </a>
        <div className="workspace-label">
          <span className="workspace-avatar">{initials(user.name)}</span>
          <div>
            <strong>{user.name.split(' ')[0]}’s workspace</strong>
            <small>Personal workspace</small>
          </div>
        </div>
        <div className="nav-caption">WORKSPACE</div>
        <nav>
          {navItems.map(([p, Icon, label]) => (
            <button
              key={p}
              className={cx('nav-item', page === p && 'active')}
              onClick={() => navigate(p)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {p === 'issues' && !!stats?.total && <small>{stats.total}</small>}
            </button>
          ))}
        </nav>
        <div className="nav-caption project-caption">
          YOUR PROJECTS
          <button
            title="New project"
            aria-label="New project"
            onClick={() => setProjectModal('new')}
          >
            <Plus size={15} />
          </button>
        </div>
        <nav>
          {projects.slice(0, 8).map((p) => (
            <button
              key={p.id}
              className={cx('nav-item project-nav', page === 'project' && pid === p.id && 'active')}
              onClick={() => navigate('project', p.id)}
            >
              <span className={'project-square color-' + (p.id % 4)}>
                <Folder size={13} />
              </span>
              <span>{p.name}</span>
            </button>
          ))}
          {!projects.length && <p className="sidebar-empty">Your projects will live here.</p>}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-note">
            <span>
              <Zap size={16} /> Project access
            </span>
            <p>Add registered teammates from a project’s Members panel.</p>
          </div>
          <div className="profile">
            <Avatar user={user} />
            <div>
              <strong>{user.name}</strong>
              <small title={user.email}>{user.email}</small>
            </div>
            <button className="icon-btn" title="Sign out" aria-label="Sign out" onClick={logout}>
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <button
              className="icon-btn mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={19} />
            </button>
            <span className="breadcrumb">Workspace</span>
            <ChevronRight size={13} />
            <span>{page === 'project' ? 'Projects / ' + title : title}</span>
          </div>
          <div className="topbar-right">
            <span className="live-label">
              <span className="dot green-bg" /> Issue tracker
            </span>
            <Avatar user={user} small />
          </div>
        </header>
        <main className="main-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {page === 'overview' ? 'WORKSPACE' : page === 'project' ? 'PROJECT' : 'WORKSPACE'}
              </div>
              <h1>
                {page === 'overview' ? (
                  <>
                    Overview<span className="heading-dot">.</span>
                  </>
                ) : (
                  title
                )}
              </h1>
              <p>
                {page === 'overview'
                  ? `Welcome back, ${user.name.split(' ')[0]}. Here is the current state of your projects.`
                  : page === 'projects'
                    ? 'Manage your projects and their issue backlogs.'
                    : page === 'project'
                      ? project?.description || 'Track issues and collaborate with project members.'
                      : page === 'mine'
                        ? 'Issues assigned to you across your projects.'
                        : 'Search and filter issues across projects you belong to.'}
              </p>
            </div>
            <div className="heading-actions">
              {page === 'project' && (
                <button className="btn" onClick={() => setTeam(true)}>
                  <Users size={16} />
                  Members
                </button>
              )}
              {page === 'project' && project?.owner_id === user.id && (
                <button
                  className="icon-btn bordered"
                  title="Edit project"
                  aria-label="Edit project"
                  onClick={() => setProjectModal(project)}
                >
                  <Pencil size={16} />
                </button>
              )}
              <button
                className="btn primary"
                onClick={() =>
                  page === 'projects' || !projects.length
                    ? setProjectModal('new')
                    : setIssueModal('new')
                }
              >
                <Plus size={17} />
                {page === 'projects' || !projects.length ? 'New project' : 'New issue'}
              </button>
            </div>
          </div>
          {error && (
            <div role="alert" className="error banner">
              {error}
              <button className="text-btn" onClick={refresh}>
                Try again
              </button>
            </div>
          )}
          {page === 'overview' && (
            <>
              <div className="stats-grid">
                {[
                  {
                    label: 'Total issues',
                    value: stats?.total,
                    Icon: Layers,
                    note: 'All project issues',
                    color: 'purple',
                  },
                  {
                    label: 'Open issues',
                    value: stats?.open,
                    Icon: CircleDot,
                    note: 'Todo and in progress',
                    color: 'orange',
                  },
                  {
                    label: 'In progress',
                    value: stats?.in_progress,
                    Icon: Clock3,
                    note: 'Currently being worked on',
                    color: 'blue',
                  },
                  {
                    label: 'Completed',
                    value: stats?.completed,
                    Icon: CheckCheck,
                    note: 'Marked done',
                    color: 'green',
                  },
                ].map((s) => (
                  <div className="stat-card" key={s.label}>
                    <div>
                      <span>{s.label}</span>
                      <span className={'stat-icon ' + s.color}>
                        <s.Icon size={18} />
                      </span>
                    </div>
                    <strong>{s.value ?? '—'}</strong>
                    <small>{s.note}</small>
                  </div>
                ))}
              </div>
              <div className="overview-grid">
                <section className="panel project-panel">
                  <div className="section-heading">
                    <div>
                      <h2>
                        Your projects <span className="count-badge">{projects.length}</span>
                      </h2>
                      <p>Issue counts and completion by project.</p>
                    </div>
                    <button className="text-btn" onClick={() => navigate('projects')}>
                      View all <ArrowUpRight size={14} />
                    </button>
                  </div>
                  {projects.length ? (
                    <div className="overview-projects">
                      {projects.slice(0, 3).map((p) => (
                        <button
                          className="overview-project"
                          key={p.id}
                          onClick={() => navigate('project', p.id)}
                        >
                          <div className={'project-tile color-' + (p.id % 4)}>
                            <Folder size={20} />
                          </div>
                          <div className="project-summary">
                            <h3>{p.name}</h3>
                            <p>
                              {p.total_issues} issues <span>·</span> {p.member_count}{' '}
                              {p.member_count === 1 ? 'member' : 'members'}
                            </p>
                            <div className="progress-row">
                              <div className="progress-track">
                                <span
                                  style={{
                                    width: `${p.total_issues ? (p.completed_issues / p.total_issues) * 100 : 0}%`,
                                  }}
                                />
                              </div>
                              <small>
                                {p.total_issues
                                  ? Math.round((p.completed_issues / p.total_issues) * 100)
                                  : 0}
                                %
                              </small>
                            </div>
                          </div>
                          <ChevronRight size={16} className="muted" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="mini-empty">
                      <Folder size={26} />
                      <h3>No projects yet</h3>
                      <p>Create your first project to get started.</p>
                      <button className="text-btn" onClick={() => setProjectModal('new')}>
                        Create project <ArrowRight size={14} />
                      </button>
                    </div>
                  )}
                </section>
                <section className="panel priority-panel">
                  <div className="section-heading">
                    <div>
                      <h2>By priority</h2>
                      <p>Distribution of issues by severity.</p>
                    </div>
                    <BarChart3 size={18} className="muted" />
                  </div>
                  <div className="priority-chart">
                    {[...priorities].reverse().map((p) => (
                      <div className="priority-chart-row" key={p}>
                        <Priority value={p} />
                        <div className="chart-track">
                          <span
                            className={'bar ' + p.toLowerCase()}
                            style={{
                              width: `${stats?.total ? Math.max(0, (stats.by_priority[p] / stats.total) * 100) : 0}%`,
                            }}
                          />
                        </div>
                        <strong>{stats?.by_priority[p] ?? 0}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="priority-footer">
                    <span className="dot purple-bg" /> Includes open and completed issues.
                  </div>
                </section>
              </div>
              <section className="panel recent-panel">
                <div className="section-heading">
                  <div>
                    <h2>
                      Recent issues <span className="count-badge">{stats?.total || 0}</span>
                    </h2>
                    <p>Issues ordered by creation date.</p>
                  </div>
                  <button className="text-btn" onClick={() => navigate('issues')}>
                    View all issues <ArrowUpRight size={14} />
                  </button>
                </div>
                {loading ? (
                  <div className="loading">
                    <Loader2 className="spin" size={20} />
                    Loading issues…
                  </div>
                ) : issues.length ? (
                  <IssueTable items={issues.slice(0, 6)} onOpenIssue={setDetail} />
                ) : (
                  empty
                )}
              </section>
            </>
          )}
          {page === 'projects' && (
            <div className="projects-grid">
              {projects.map((p) => (
                <article className="project-card" key={p.id}>
                  <div className="project-card-top">
                    <span className={'project-tile color-' + (p.id % 4)}>
                      <Folder size={22} />
                    </span>
                    {p.owner_id === user.id && (
                      <button
                        className="icon-btn"
                        title="Edit project"
                        aria-label={'Edit ' + p.name}
                        onClick={() => setProjectModal(p)}
                      >
                        <MoreHorizontal size={19} />
                      </button>
                    )}
                  </div>
                  <button className="project-card-title" onClick={() => navigate('project', p.id)}>
                    {p.name}
                    <ArrowUpRight size={18} />
                  </button>
                  <p>{p.description || 'No project description.'}</p>
                  <div className="project-card-meta">
                    <span>
                      <CircleDot size={14} />
                      {p.total_issues} issues
                    </span>
                    <span>
                      <Users size={14} />
                      {p.member_count} members
                    </span>
                  </div>
                  <div className="progress-row">
                    <div className="progress-track">
                      <span
                        style={{
                          width: `${p.total_issues ? (p.completed_issues / p.total_issues) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <small>
                      {p.total_issues ? Math.round((p.completed_issues / p.total_issues) * 100) : 0}
                      %
                    </small>
                  </div>
                  <button className="project-open" onClick={() => navigate('project', p.id)}>
                    Open project <ArrowRight size={15} />
                  </button>
                </article>
              ))}
              <button className="new-project-card" onClick={() => setProjectModal('new')}>
                <span>
                  <Plus size={24} />
                </span>
                <strong>Create a project</strong>
                <p>Create a project to track a separate area of work.</p>
              </button>
            </div>
          )}
          {['issues', 'mine', 'project'].includes(page) && (
            <section className="panel issues-panel">
              <div className="issue-toolbar">
                <div className="search-box">
                  <Search size={16} />
                  <input
                    aria-label="Search issues"
                    placeholder="Search issues…"
                    value={search}
                    maxLength={200}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {search && (
                    <button aria-label="Clear search" onClick={() => setSearch('')}>
                      <X size={13} />
                    </button>
                  )}
                </div>
                <div className="filter-controls">
                  <SlidersHorizontal size={15} className="muted" />
                  <select
                    aria-label="Filter status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="">All statuses</option>
                    {statuses.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Filter priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                  >
                    <option value="">All priorities</option>
                    {priorities.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                  <div className="view-switch">
                    <button
                      aria-label="List view"
                      title="List view"
                      className={cx(view === 'list' && 'selected')}
                      onClick={() => setView('list')}
                    >
                      <List size={17} />
                    </button>
                    <button
                      aria-label="Board view"
                      title="Board view"
                      className={cx(view === 'board' && 'selected')}
                      onClick={() => setView('board')}
                    >
                      <Columns3 size={16} />
                    </button>
                  </div>
                </div>
              </div>
              {loading ? (
                <div className="loading">
                  <Loader2 className="spin" size={20} />
                  Loading issues…
                </div>
              ) : !issues.length ? (
                empty
              ) : view === 'list' ? (
                <IssueTable items={issues} compact={page === 'project'} onOpenIssue={setDetail} />
              ) : (
                <div className="board">
                  {statuses.map((s) => (
                    <div className="board-column" key={s}>
                      <div className="board-heading">
                        <StatusIcon status={s} />
                        <strong>{s}</strong>
                        <span>{issues.filter((i) => i.status === s).length}</span>
                        <button
                          title={'Add issue to ' + s}
                          aria-label={'Add issue to ' + s}
                          onClick={() => {
                            setNewIssueStatus(s);
                            setIssueModal('new');
                          }}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      {issues
                        .filter((i) => i.status === s)
                        .map((i) => (
                          <article className="board-card" key={i.id}>
                            <button onClick={() => setDetail(i)}>
                              <span className="issue-key">{i.key}</span>
                              <h3>{i.title}</h3>
                              <p>{i.project_name}</p>
                            </button>
                            <div className="board-card-bottom">
                              <Priority value={i.priority} />
                              {i.assignee && <Avatar user={i.assignee} small />}
                            </div>
                            <select
                              aria-label={'Change status for ' + i.title}
                              value={i.status}
                              onChange={(e) => changeStatus(i, e.target.value)}
                            >
                              {statuses.map((st) => (
                                <option key={st}>{st}</option>
                              ))}
                            </select>
                          </article>
                        ))}
                      {!issues.some((i) => i.status === s) && (
                        <div className="column-empty">No issues in this status.</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="pagination">
                <span>
                  {total === 0
                    ? 'No issues'
                    : `${(index - 1) * 50 + 1}–${Math.min(index * 50, total)} of ${total} issues`}
                  {view === 'board' && total > 50 ? ' · Board shows this page' : ''}
                </span>
                <div>
                  <button
                    className="icon-btn bordered"
                    aria-label="Previous page"
                    disabled={index === 1 || loading}
                    onClick={() => setIndex(index - 1)}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span>Page {index}</span>
                  <button
                    className="icon-btn bordered"
                    aria-label="Next page"
                    disabled={index * 50 >= total || loading}
                    onClick={() => setIndex(index + 1)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
      {toast && (
        <div role="status" className="toast">
          <Check size={17} />
          {toast}
          <button aria-label="Dismiss notification" onClick={() => setToast('')}>
            <X size={15} />
          </button>
        </div>
      )}
      {projectModal && (
        <ProjectForm
          project={projectModal}
          onClose={() => setProjectModal(null)}
          onSaved={() => {
            setProjectModal(null);
            refresh();
            notify('Project saved');
          }}
          onDelete={(id) => {
            setProjectModal(null);
            setConfirm({ kind: 'project', id });
          }}
        />
      )}
      {issueModal && (
        <IssueForm
          issue={issueModal}
          projects={projects}
          defaultPid={pid}
          defaultStatus={newIssueStatus}
          onClose={() => {
            setIssueModal(null);
            setNewIssueStatus('Todo');
          }}
          onSaved={(i) => {
            setIssueModal(null);
            setNewIssueStatus('Todo');
            if (detail) setDetail(i);
            refresh();
            notify('Issue saved');
          }}
        />
      )}
      {detail && !issueModal && (
        <IssueDetail
          issue={detail}
          user={user}
          onClose={() => setDetail(null)}
          onEdit={() => setIssueModal(detail)}
          onDelete={() => setConfirm({ kind: 'issue', id: detail.id })}
          onUpdate={(i) => {
            setDetail(i);
            refresh();
          }}
        />
      )}
      {team && project && (
        <Team project={project} user={user} onClose={() => setTeam(false)} onSaved={refresh} />
      )}
      {confirm && (
        <Modal title={'Delete ' + confirm.kind + '?'} onClose={() => setConfirm(null)}>
          <div className="modal-body">
            <p className="confirm-copy">
              {confirm.kind === 'project'
                ? 'This permanently deletes the project, its issues, and all comments.'
                : 'This permanently deletes this issue and its comments.'}{' '}
              This action cannot be undone.
            </p>
            <div className="form-actions">
              <button className="btn" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button className="btn danger" onClick={doDelete}>
                Delete {confirm.kind}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
