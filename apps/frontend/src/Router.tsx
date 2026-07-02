import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAppContext } from './context/AppContext';

import MainLayout from './components/Layout/MainLayout';
import Home from './components/Pages/Home';
import Dashboard from './components/Pages/Dashboard';
import Products from './components/Pages/Products';
import Events from './components/Pages/Events';
import Community from './components/Pages/Community';
import Profile from './components/Pages/Profile';
import Settings from './components/Pages/Settings';
import Admin from './components/Pages/Admin';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, isLoading } = useAppContext();

  if (isLoading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const ExclusiveRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAppContext();
  const isAdminUser = user?.role === 'admin' || user?.role === 'owner';
  const stored = localStorage.getItem('zai_experience_card');
  const hasExperienceCard = !!stored && stored !== 'null' && stored !== 'undefined';

  if (!hasExperienceCard && !isAdminUser) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const Router: React.FC = () => {
  const { user, isLoading } = useAppContext();

  if (!isLoading && user) {
    return (
      <BrowserRouter>
        <Routes>
          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/products" element={<ExclusiveRoute><Products /></ExclusiveRoute>} />
            <Route path="/events" element={<ExclusiveRoute><Events /></ExclusiveRoute>} />
            <Route path="/community" element={<ExclusiveRoute><Community /></ExclusiveRoute>} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/admin" element={<Admin />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />

        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/products" element={<ExclusiveRoute><Products /></ExclusiveRoute>} />
          <Route path="/events" element={<ExclusiveRoute><Events /></ExclusiveRoute>} />
          <Route path="/community" element={<ExclusiveRoute><Community /></ExclusiveRoute>} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/admin" element={<Admin />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default Router;
