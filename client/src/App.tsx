import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Dashboard from './pages/Dashboard.js';
import JobDetail from './pages/JobDetail.js';
import CVEditor from './pages/CVEditor.js';

const queryClient = new QueryClient();

const navCls = ({ isActive }: { isActive: boolean }) =>
  `px-4 py-2 rounded text-sm font-medium transition-colors ${
    isActive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
  }`;

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50 flex">
          <aside className="w-52 bg-white border-r border-gray-200 flex flex-col p-4 gap-1 shrink-0">
            <div className="mb-6">
              <h1 className="text-lg font-bold text-gray-900">PipeJob</h1>
              <p className="text-xs text-gray-400">Personal Career Agent</p>
            </div>
            <NavLink to="/" end className={navCls}>Dashboard</NavLink>
            <NavLink to="/cv" className={navCls}>CV Editor</NavLink>
          </aside>
          <main className="flex-1 p-8 overflow-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/jobs/:id" element={<JobDetail />} />
              <Route path="/cv" element={<CVEditor />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
