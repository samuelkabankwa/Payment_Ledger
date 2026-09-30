import {
  LayoutDashboard,
  Users,
  Trophy,
  Zap,
  Download,
  Database,
  FileSpreadsheet,
  Sparkles,
} from 'lucide-react';
import { api } from '../services/api';

interface NavbarProps {
  currentTab: 'dashboard' | 'leaderboard' | 'workers';
  onSelectTab: (tab: 'dashboard' | 'leaderboard' | 'workers') => void;
  onOpenQuickAdd: () => void;
  onOpenTrainModal?: () => void;
}

export function Navbar({
  currentTab,
  onSelectTab,
  onOpenQuickAdd,
  onOpenTrainModal,
}: NavbarProps) {
  const handleExportAll = () => {
    window.open(api.getExportAllUrl(), '_blank');
  };

  const handleBackup = () => {
    window.open(api.getBackupUrl(), '_blank');
  };

  return (
    <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-6">
            <div
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => onSelectTab('dashboard')}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                <FileSpreadsheet className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-bold text-lg tracking-tight flex items-center gap-2">
                  <span>Worker Debt Ledger</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Live
                  </span>
                </div>
                <div className="text-xs text-slate-400 hidden sm:block">
                  Driver Repayment & SMS Parsing System
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="hidden md:flex items-center space-x-1 pl-4 border-l border-slate-800">
              <button
                onClick={() => onSelectTab('dashboard')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                  currentTab === 'dashboard'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 text-emerald-400" />
                Dashboard
              </button>

              <button
                onClick={() => onSelectTab('leaderboard')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                  currentTab === 'leaderboard'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Trophy className="w-4 h-4 text-amber-400" />
                Leaderboard
              </button>

              <button
                onClick={() => onSelectTab('workers')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                  currentTab === 'workers'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Users className="w-4 h-4 text-blue-400" />
                Workers & Ledgers
              </button>
            </nav>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            {onOpenTrainModal && (
              <button
                onClick={onOpenTrainModal}
                title="Train SMS Templates & Manage Formats"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 hover:text-indigo-200 border border-indigo-500/30 text-sm font-medium transition-all"
              >
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span className="hidden xl:inline">Train SMS</span>
              </button>
            )}

            <button
              onClick={onOpenQuickAdd}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm shadow-md shadow-emerald-500/25 transition-all transform active:scale-95"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span className="hidden sm:inline">Quick Add (Paste SMS)</span>
              <span className="sm:hidden">Add SMS</span>
            </button>

            <button
              onClick={handleExportAll}
              title="Export All Workers Summary to Excel"
              className="p-2 sm:px-3 sm:py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-sm font-medium flex items-center gap-2 transition-all"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span className="hidden lg:inline">Export Excel</span>
            </button>

            <button
              onClick={handleBackup}
              title="Download Full Database JSON Backup"
              className="p-2 sm:px-3 sm:py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-sm font-medium flex items-center gap-2 transition-all"
            >
              <Database className="w-4 h-4 text-cyan-400" />
              <span className="hidden lg:inline">Backup</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Row */}
        <div className="flex md:hidden items-center justify-around py-2 border-t border-slate-800/80">
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium ${
              currentTab === 'dashboard'
                ? 'bg-slate-800 text-emerald-400'
                : 'text-slate-400'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Dashboard
          </button>
          <button
            onClick={() => onSelectTab('leaderboard')}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium ${
              currentTab === 'leaderboard'
                ? 'bg-slate-800 text-amber-400'
                : 'text-slate-400'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            Leaderboard
          </button>
          <button
            onClick={() => onSelectTab('workers')}
            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium ${
              currentTab === 'workers'
                ? 'bg-slate-800 text-blue-400'
                : 'text-slate-400'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Workers
          </button>
        </div>
      </div>
    </header>
  );
}
