import './index.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/lib/theme';
import { AuthProvider, useAuth } from '@/lib/authContext';
import AuthModal from '@/components/AuthModal';
import Workspace from '@/pages/Workspace';
import { useEffect } from 'react';
import { fetchCloudWorkspace } from '@/lib/store';

function AppContent() {
  const { token, isAuthenticated } = useAuth();

  useEffect(() => {
    if (token && isAuthenticated) {
      fetchCloudWorkspace(token);
    }
  }, [token, isAuthenticated]);

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Workspace />} />
          <Route path="*" element={<Workspace />} />
        </Routes>
      </BrowserRouter>
      <AuthModal />
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
      <Toaster
        position="bottom-left"
        theme="system"
        toastOptions={{ style: { fontFamily: 'IBM Plex Sans, sans-serif' } }}
      />
    </ThemeProvider>
  );
}

export default App;
