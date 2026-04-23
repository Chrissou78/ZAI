import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAppContext } from './context/AppContext';

// Layouts
import MainLayout from './components/Layout/MainLayout';

// Pages
import Home from './components/Pages/Home';
import Dashboard from './components/Pages/Dashboard';
import Products from './components/Pages/Products';
import Events from './components/Pages/Events';
import Community from './components/Pages/Community';
import Profile from './components/Pages/Profile';
import Settings from './components/Pages/Settings';

// Protected Route Wrapper
interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, isLoading } = useAppContext();

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const Router: React.FC = () => {
  const { user } = useAppContext();

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Home />} />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Dashboard />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Products />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/events"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Events />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/community"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Community />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Profile />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Settings />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default Router;
