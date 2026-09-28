import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { BookOpen, Bot, Inbox, SquareKanban, LayoutDashboard, Settings as SettingsIcon, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { api } from './api/client';
import { EventsProvider, useEvents } from './lib/events';
import { cx } from './lib/styles';
import Overview from './pages/Overview';
import Agent from './pages/Agent';
import Review from './pages/Review';
import Pipeline from './pages/Pipeline';
import JobDetail from './pages/JobDetail';
import Stories from './pages/Stories';
import Profile from './pages/Profile';
import Settings from './pages/Settings';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, refetchOnWindowFocus: false, retry: 1 } },
});

function NavItem({ to, icon, children, badge }: { to: string; icon: ReactNode; children: ReactNode; badge?: number }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cx(
          'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
        )
      }
    >
      {icon}
      <span className="flex-1">{children}</span>
      {badge ? <span className="rounded-full bg-blue-500 px-1.5 py-px text-[11px] font-semibold text-white">{badge}</span> : null}
    </NavLink>
  );
}

function Shell() {
  const { connected } = useEvents();
  const { data: system } = useQuery({ queryKey: ['system'], queryFn: api.system, staleTime: 60_000 });
  const { data: review } = useQuery({ queryKey: ['jobs', 'review'], queryFn: () => api.jobs({ review: true }) });

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col bg-slate-900 px-3 py-5">
        <div className="mb-8 px-3">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">P</div>
            <div>
              <div className="text-sm font-semibold text-white">PipeJob</div>
              <div className="text-[11px] text-slate-400">Career research agent</div>
            </div>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          <NavItem to="/" icon={<LayoutDashboard className="size-4" />}>Overview</NavItem>
          <NavItem to="/agent" icon={<Bot className="size-4" />}>Agent</NavItem>
          <NavItem to="/review" icon={<Inbox className="size-4" />} badge={review?.length}>Review queue</NavItem>
          <NavItem to="/pipeline" icon={<SquareKanban className="size-4" />}>Pipeline</NavItem>
          <NavItem to="/stories" icon={<BookOpen className="size-4" />}>Story bank</NavItem>
          <NavItem to="/profile" icon={<UserRound className="size-4" />}>Profile</NavItem>
          <NavItem to="/settings" icon={<SettingsIcon className="size-4" />}>Settings</NavItem>
        </nav>
        <div className="mt-auto space-y-1 px-3 text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className={cx('size-1.5 rounded-full', connected ? 'bg-emerald-400' : 'bg-slate-600')} />
            {connected ? 'Live' : 'Reconnecting…'}
          </div>
          {system && <div className="truncate" title={system.model}>{system.model}</div>}
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        {system && !system.llmConfigured && (
          <div className="border-b border-amber-200 bg-amber-50 px-8 py-2 text-sm text-amber-900">
            AI features are off — add <code className="rounded bg-amber-100 px-1">ANTHROPIC_API_KEY</code> to <code className="rounded bg-amber-100 px-1">server/.env</code>. Portal search and tracking still work.
          </div>
        )}
        <div className="mx-auto max-w-7xl px-8 py-8">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/agent" element={<Agent />} />
            <Route path="/agent/:runId" element={<Agent />} />
            <Route path="/review" element={<Review />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
            <Route path="/stories" element={<Stories />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <EventsProvider>
        <BrowserRouter>
          <Shell />
        </BrowserRouter>
      </EventsProvider>
    </QueryClientProvider>
  );
}
