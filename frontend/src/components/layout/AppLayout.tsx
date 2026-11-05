import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ComposeModal } from '../emails/ComposeModal';

export const AppLayout: React.FC = () => {
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans antialiased">
      {/* Sidebar */}
      <Sidebar onOpenCompose={() => setIsComposeOpen(true)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet context={{ onOpenCompose: () => setIsComposeOpen(true) }} />
        </main>
      </div>

      {/* Global Compose Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={() => {
          // Trigger a custom event so active pages refresh their data
          window.dispatchEvent(new Event('campaign-scheduled'));
        }}
      />
    </div>
  );
};
