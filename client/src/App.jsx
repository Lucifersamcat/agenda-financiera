import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SettingsProvider } from './settings-context.jsx';
import Sidebar from './components/Sidebar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Transactions from './pages/Transactions.jsx';
import Transfers from './pages/Transfers.jsx';
import Accounts from './pages/Accounts.jsx';
import Notes from './pages/Notes.jsx';
import Settings from './pages/Settings.jsx';
import Debts from './pages/Debts.jsx';
import CatalogCategories from './pages/CatalogCategories.jsx';
import CatalogAccountTypes from './pages/CatalogAccountTypes.jsx';
import CatalogCustomFields from './pages/CatalogCustomFields.jsx';
import CatalogDebtTypes from './pages/CatalogDebtTypes.jsx';
import './index.css';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <SettingsProvider>
    <BrowserRouter>
      <div className="layout">
        {sidebarOpen && (
          <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
        )}

        <header className="mobile-header">
          <button
            className="hamburger"
            onClick={() => setSidebarOpen(o => !o)}
            aria-label="Abrir menú"
          >
            <span /><span /><span />
          </button>
          <span className="mobile-header-logo">Agenda</span>
        </header>

        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="main">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"    element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/transfers"    element={<Transfers />} />
            <Route path="/accounts"     element={<Accounts />} />
            <Route path="/debts"        element={<Debts />} />
            <Route path="/notes"        element={<Notes />} />
            <Route path="/settings"                element={<Settings />} />
            <Route path="/settings/categories"    element={<CatalogCategories />} />
            <Route path="/settings/account-types" element={<CatalogAccountTypes />} />
            <Route path="/settings/custom-fields" element={<CatalogCustomFields />} />
            <Route path="/settings/debt-types"    element={<CatalogDebtTypes />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
    </SettingsProvider>
  );
}
