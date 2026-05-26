import { ErrorBoundary } from '@components/ErrorBoundary';
import { PerformanceMonitor } from '@components/PerformanceMonitor';
import { AuthProvider } from './contexts/AuthContext';
import { NetworkProvider } from './contexts/NetworkContext';
import { AuthenticatedApp } from './components/AuthenticatedApp';
import { Toaster } from '@components/ui/sonner';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import { PlausiblePageview } from '@components/PlausiblePageview';

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <PlausiblePageview />
        <AuthProvider>
          <NetworkProvider>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/explore" element={<AuthenticatedApp />} />
              <Route path="/dataset/:datasetId" element={<AuthenticatedApp />} />
              <Route path="/admin" element={<AuthenticatedApp />} />
            </Routes>
            <PerformanceMonitor />
            <Toaster />
          </NetworkProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}
