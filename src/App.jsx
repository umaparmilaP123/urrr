import React, { useState } from 'react';
import { UrbanGuardProvider, useUrbanGuard } from './context/UrbanGuardContext';
import AuthGateway from './components/AuthGateway';
import Header from './components/Header';
import CitizenDashboard from './components/CitizenDashboard';
import AuthorityDashboard from './components/AuthorityDashboard';
import CameraModal from './components/CameraModal';
import Toast from './components/Toast';
import { motion, AnimatePresence } from 'framer-motion';

function MainApp() {
  const { currentUser } = useUrbanGuard();
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // ── No session → show Authentication Gateway ──────────────────
  if (!currentUser) {
    return <AuthGateway />;
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0f172a] text-slate-100 selection:bg-blue-600/30">
      {/* Platform Header — role-aware, no public toggle */}
      <Header onReportClick={() => setIsReportModalOpen(true)} />

      {/* Main Dashboard — strictly role-gated */}
      <main className="flex-1 w-full overflow-x-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentUser.role}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="w-full h-full"
          >
            {currentUser.role === 'CITIZEN' ? (
              <CitizenDashboard onReportClick={() => setIsReportModalOpen(true)} />
            ) : (
              <AuthorityDashboard />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Camera modal — only accessible to CITIZENs (role-gated upstream) */}
      {currentUser.role === 'CITIZEN' && (
        <CameraModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
        />
      )}

      <Toast />

      <footer className="py-5 text-center border-t border-slate-900 bg-slate-950/20 text-[10px] text-slate-500 font-medium font-mono uppercase tracking-wider">
        UrbanGuard Monsoon Civic Response System © 2026 · GHMC Ward 14 · Cyberabad
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <UrbanGuardProvider>
      <MainApp />
    </UrbanGuardProvider>
  );
}
