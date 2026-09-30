import { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { LeaderboardView } from './components/LeaderboardView';
import { WorkerListView } from './components/WorkerListView';
import { WorkerDetailView } from './components/WorkerDetailView';
import { QuickAddPaymentModal } from './components/QuickAddPaymentModal';
import { AddWorkerModal } from './components/AddWorkerModal';
import { TrainSmsModal } from './components/TrainSmsModal';
import { ToastContainer, ToastMessage } from './components/Toast';
import { api } from './services/api';
import { Worker } from './types';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'leaderboard' | 'workers'>('dashboard');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddWorkerId, setQuickAddWorkerId] = useState<string | null>(null);
  const [isAddWorkerOpen, setIsAddWorkerOpen] = useState(false);
  const [workerToEdit, setWorkerToEdit] = useState<Worker | null>(null);
  const [isTrainModalOpen, setIsTrainModalOpen] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback(
    (type: 'success' | 'error' | 'info', message: string, title?: string) => {
      const newToast: ToastMessage = {
        id: `${Date.now()}-${Math.random()}`,
        type,
        message,
        title,
      };
      setToasts((prev) => [...prev, newToast]);
    },
    []
  );

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const loadWorkers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getWorkers();
      setWorkers(data);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to load workers list.');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadWorkers();
  }, [loadWorkers]);

  const handleSelectTab = (tab: 'dashboard' | 'leaderboard' | 'workers') => {
    setCurrentTab(tab);
    setSelectedWorkerId(null);
  };

  const handleSelectWorker = (workerId: string) => {
    setSelectedWorkerId(workerId);
  };

  const handleBackToWorkers = () => {
    setSelectedWorkerId(null);
    setCurrentTab('workers');
    loadWorkers();
  };

  const handleOpenQuickAdd = (workerId?: string) => {
    setQuickAddWorkerId(workerId || null);
    setIsQuickAddOpen(true);
  };

  const handleOpenAddWorker = () => {
    setWorkerToEdit(null);
    setIsAddWorkerOpen(true);
  };

  const handleOpenEditWorker = (worker: Worker) => {
    setWorkerToEdit(worker);
    setIsAddWorkerOpen(true);
  };

  const handlePaymentSuccess = (msg: string) => {
    showToast('success', msg);
    loadWorkers();
  };

  const handleWorkerSaved = (msg: string) => {
    showToast('success', msg);
    loadWorkers();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Top Navigation */}
      <Navbar
        currentTab={selectedWorkerId ? 'workers' : currentTab}
        onSelectTab={handleSelectTab}
        onOpenQuickAdd={() => handleOpenQuickAdd()}
        onOpenTrainModal={() => setIsTrainModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {selectedWorkerId ? (
          <WorkerDetailView
            workerId={selectedWorkerId}
            onBack={handleBackToWorkers}
            onOpenQuickAddWithWorker={(id) => handleOpenQuickAdd(id)}
            onOpenEditWorker={handleOpenEditWorker}
            onShowToast={showToast}
          />
        ) : (
          <>
            {currentTab === 'dashboard' && (
              <DashboardView
                onSelectWorker={handleSelectWorker}
                onOpenQuickAddWithWorker={(id) => handleOpenQuickAdd(id)}
                onViewAllWorkers={() => setCurrentTab('workers')}
              />
            )}

            {currentTab === 'leaderboard' && (
              <LeaderboardView onSelectWorker={handleSelectWorker} />
            )}

            {currentTab === 'workers' && (
              <WorkerListView
                workers={workers}
                isLoading={isLoading}
                onSelectWorker={handleSelectWorker}
                onOpenAddWorker={handleOpenAddWorker}
                onOpenEditWorker={handleOpenEditWorker}
                onOpenQuickAddWithWorker={(id) => handleOpenQuickAdd(id)}
                onRefresh={loadWorkers}
              />
            )}
          </>
        )}
      </main>

      {/* Quick Add Payment (Paste SMS) Modal */}
      <QuickAddPaymentModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        workers={workers}
        preselectedWorkerId={quickAddWorkerId}
        onPaymentSuccess={handlePaymentSuccess}
        onShowToast={showToast}
      />

      {/* Add / Edit Worker Modal */}
      <AddWorkerModal
        isOpen={isAddWorkerOpen}
        onClose={() => setIsAddWorkerOpen(false)}
        workerToEdit={workerToEdit}
        onSuccess={handleWorkerSaved}
      />

      {/* Standalone Train SMS Modal */}
      <TrainSmsModal
        isOpen={isTrainModalOpen}
        onClose={() => setIsTrainModalOpen(false)}
        onPatternSaved={() => showToast('success', 'SMS Pattern saved and active for future SMS!')}
        onShowToast={showToast}
      />

      {/* Toasts Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
