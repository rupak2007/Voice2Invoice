import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, BarChart3, Boxes, FileText, LayoutGrid, Loader2, Menu, Mic, Plug,
  Receipt, Search, Settings as SettingsIcon, Users, X,
} from 'lucide-react';
import { useActiveJobs } from '../lib/activeJobs';
import { useApi } from '../lib/useApi';
import type { DraftSummary, Settings, Stats } from '../lib/types';
import { buttonStyles } from './Button';

interface NavEntry {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
  end: boolean;
  count?: number;
  tone?: 'warning' | 'plain';
  /** Real data, but the actions on the screen are not backed yet. */
  preview?: boolean;
}
interface NavGroup { label: string; items: NavEntry[] }

function navGroups(needsReview: number, drafts: number, invoices: number): NavGroup[] {
  return [
    {
      label: 'Workspace',
      items: [
        { to: '/', label: 'Overview', icon: LayoutGrid, end: true },
        { to: '/jobs', label: 'Jobs', icon: FileText, end: false, count: needsReview, tone: 'warning' },
        { to: '/new', label: 'Drafts', icon: Mic, end: false, count: drafts, tone: 'plain' },
        { to: '/invoices', label: 'Invoices', icon: Receipt, end: false, count: invoices, tone: 'plain' },
      ],
    },
    {
      label: 'Business',
      items: [
        { to: '/customers', label: 'Customers', icon: Users, end: false, preview: true },
        { to: '/products', label: 'Products', icon: Boxes, end: false, preview: true },
      ],
    },
    {
      label: 'Insights',
      items: [{ to: '/analytics', label: 'Analytics', icon: BarChart3, end: false, preview: true }],
    },
    {
      label: 'System',
      items: [
        { to: '/integrations', label: 'Integrations', icon: Plug, end: false, preview: true },
        { to: '/settings', label: 'Settings', icon: SettingsIcon, end: false },
      ],
    },
  ];
}

/** Five bars breathing slowly — the product's mark, and its only idle motion. */
export function WaveMark({ size = 30 }: { size?: number }) {
  const bars = [7, 13, 19, 13, 7];
  return (
    <span
      className="flex shrink-0 items-center justify-center gap-[2px] rounded-[9px] border
        border-accent-line bg-accent-soft"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {bars.map((h, i) => (
        <span
          key={i}
          className="wave-bar w-[2px] rounded-full bg-accent"
          style={{ height: `${(h / 30) * size}px`, animationDelay: `${i * 180}ms` }}
        />
      ))}
    </span>
  );
}

function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link to="/" onClick={onNavigate} className="flex items-center gap-2.5 rounded-lg">
      <WaveMark />
      <span className="text-[14px] font-semibold tracking-[-0.01em] text-ink">Voice2Invoice</span>
    </Link>
  );
}

function Nav({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="space-y-5">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="eyebrow px-2.5 pb-1.5">{group.label}</p>
          <div className="flex flex-col gap-px">
            {group.items.map(({ to, label, icon: Icon, end, count, tone, preview }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `relative flex items-center gap-2.5 rounded-lg py-[7px] pl-2.5 pr-2 text-[13px]
                   transition-colors duration-[120ms] ${isActive
                    ? 'bg-accent-soft font-medium text-ink'
                    : 'text-muted hover:bg-raised hover:text-dim'}`
                }
              >
                {({ isActive }) => (
                  <>
                    {/* The active marker is a shape, not only a tint. */}
                    <span
                      aria-hidden
                      className={`absolute left-0 top-1/2 h-3.5 w-[2px] -translate-y-1/2 rounded-r-full
                        bg-accent transition-opacity duration-[120ms] ${isActive ? 'opacity-100' : 'opacity-0'}`}
                    />
                    <Icon size={15} aria-hidden className={isActive ? 'text-accent' : ''} />
                    <span className="flex-1 truncate">{label}</span>
                    {preview && (
                      <span
                        className="rounded border border-line px-1 py-px text-[9px] font-semibold
                          uppercase tracking-wider text-muted"
                        title="Design preview — not backed by a live API yet"
                      >
                        Preview
                      </span>
                    )}
                    {count ? (
                      <span
                        className={`tabular rounded-full px-1.5 text-[10.5px] font-semibold leading-[17px] ${
                          tone === 'warning'
                            ? 'bg-warning-soft text-warning'
                            : 'bg-raised text-muted'
                        }`}
                      >
                        {count}
                      </span>
                    ) : null}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function AccountRow({ businessName }: { businessName: string }) {
  const { running, online } = useActiveJobs();
  return (
    <div className="border-t border-line-soft p-3">
      <div className="flex items-center gap-2.5 rounded-lg px-1 py-1">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-line
            bg-raised text-[10.5px] font-semibold uppercase tracking-wide text-dim"
          aria-hidden
        >
          {businessName.slice(0, 2)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-medium text-ink">{businessName}</p>
          <p className="flex items-center gap-1.5 text-[11px] text-muted">
            {running.length > 0 ? (
              <>
                <Loader2 size={9} className="animate-spin text-accent" aria-hidden />
                {running.length} processing
              </>
            ) : (
              <>
                <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-success' : 'bg-danger'}`} />
                {online ? 'Connected' : 'Offline'}
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Searches the job log — the only index the product actually has. */
function GlobalSearch() {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        navigate(value.trim() ? `/jobs?q=${encodeURIComponent(value.trim())}` : '/jobs');
      }}
      className="relative hidden w-full max-w-md md:block"
    >
      <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Search jobs, invoices and customers"
        placeholder="Search jobs, invoices, customers…"
        className="h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-14 text-[12.5px] text-ink
          placeholder:text-muted transition-[border-color,background-color] duration-[120ms]
          hover:border-line-strong focus:border-accent focus:bg-raised focus:outline-none
          focus:ring-4 focus:ring-accent/10"
      />
      <kbd
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded
          border border-line bg-raised px-1.5 py-0.5 font-mono text-[10px] text-muted lg:block"
      >
        ⌘K
      </kbd>
    </form>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const first = useRef(true);

  const { data: stats } = useApi<Stats>('/api/stats', { pollMs: 10000 });
  const { data: draftData } = useApi<{ drafts: DraftSummary[] }>('/api/drafts', { pollMs: 10000 });
  const { data: settings } = useApi<Settings>('/api/settings');

  const openDrafts = (draftData?.drafts ?? []).filter((d) => !d.finalized_job_id);
  const groups = navGroups(stats?.needs_review ?? 0, openDrafts.length, stats?.invoiced ?? 0);
  const businessName = settings?.business_name ?? 'Voice2Invoice';

  useEffect(() => setMenuOpen(false), [pathname]);

  // Client-side navigation does not move focus on its own, which strands
  // keyboard and screen-reader users on the previous page's controls.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    mainRef.current?.focus();
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const rail = (onNavigate?: () => void) => (
    <>
      <div className="px-4 py-4">
        <Brand onNavigate={onNavigate} />
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <Link to="/new" onClick={onNavigate} className={buttonStyles('primary', 'md', 'mb-5 w-full')}>
          <Mic size={15} aria-hidden /> New invoice
        </Link>
        <Nav groups={groups} onNavigate={onNavigate} />
      </div>
      <AccountRow businessName={businessName} />
    </>
  );

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50
          focus:rounded-lg focus:bg-elevated focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>

      {/* Sidebar: quiet, compact, one shade above the canvas. */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-[228px] flex-col
        border-r border-line bg-base-soft lg:flex">
        {rail()}
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setMenuOpen(false)}
            className="fade absolute inset-0 bg-black/60 backdrop-blur-[2px]"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="slide-up absolute inset-y-0 left-0 flex w-[272px] flex-col border-r
              border-line bg-base-soft"
          >
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close navigation menu"
              className="absolute right-3 top-4 flex h-8 w-8 items-center justify-center rounded-lg
                text-muted transition-colors duration-[120ms] hover:bg-raised hover:text-ink"
            >
              <X size={16} aria-hidden />
            </button>
            {rail(() => setMenuOpen(false))}
          </div>
        </div>
      )}

      <div className="lg:pl-[228px] print:pl-0">
        <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-3 border-b
          border-line bg-base/80 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
            className="-ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-muted
              transition-colors duration-[120ms] hover:bg-raised hover:text-ink lg:hidden"
          >
            <Menu size={18} aria-hidden />
          </button>

          <div className="lg:hidden"><Brand /></div>

          <div className="ml-auto flex flex-1 items-center justify-end gap-2 lg:ml-0 lg:justify-between">
            <GlobalSearch />
            <div className="flex items-center gap-1">
              <Link
                to="/jobs?status=needs_review"
                aria-label={stats?.needs_review
                  ? `${stats.needs_review} jobs need review`
                  : 'Nothing needs review'}
                title="Needs review"
                className="relative hidden h-9 w-9 items-center justify-center rounded-lg text-muted
                  transition-colors duration-[120ms] hover:bg-raised hover:text-ink sm:flex"
              >
                <Bell size={16} aria-hidden />
                {(stats?.needs_review ?? 0) > 0 && (
                  <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-warning" aria-hidden />
                )}
              </Link>
              <Link to="/new" className={buttonStyles('primary', 'sm', 'lg:hidden')}>
                <Mic size={14} aria-hidden /> Record
              </Link>
            </div>
          </div>
        </header>

        <main id="main" ref={mainRef} tabIndex={-1} className="outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * Page width. Standard screens get a comfortable measure; ultrawide gets more
 * room rather than a narrow column floating in empty margins.
 */
export function PageBody({
  children, wide = false, className = '',
}: { children: ReactNode; wide?: boolean; className?: string }) {
  return (
    <div
      className={`print-root mx-auto w-full px-4 py-7 sm:px-6 lg:px-8 lg:py-9
        ${wide ? 'max-w-[1680px] 2xl:max-w-[1960px]' : 'max-w-[1320px] 2xl:max-w-[1480px]'} ${className}`}
    >
      {children}
    </div>
  );
}

/** Page identity. One per screen, always in the same place. */
export function PageHeader({
  title, description, actions, eyebrow,
}: { title: string; description?: string; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="display text-[24px] text-ink sm:text-[27px]">{title}</h1>
        {description && (
          <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-muted">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
