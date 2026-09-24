import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './index.css';
import { AppShell } from './components/AppShell';
import { ToastHost } from './components/ui';
import { ActiveJobsProvider } from './lib/activeJobs';
import Overview from './pages/Overview';
import NewInvoice from './pages/NewInvoice';
import Jobs from './pages/Jobs';
import JobDetail from './pages/JobDetail';
import Invoices from './pages/Invoices';
import InvoiceView from './pages/InvoiceView';
import Customers from './pages/Customers';
import Products from './pages/Products';
import Analytics from './pages/Analytics';
import Integrations from './pages/Integrations';
import Settings from './pages/Settings';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ActiveJobsProvider>
        <ToastHost>
          <AppShell>
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/new" element={<NewInvoice />} />
              <Route path="/jobs" element={<Jobs />} />
              <Route path="/jobs/:id" element={<JobDetail />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/invoices/:id" element={<InvoiceView />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/products" element={<Products />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/integrations" element={<Integrations />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppShell>
        </ToastHost>
      </ActiveJobsProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
