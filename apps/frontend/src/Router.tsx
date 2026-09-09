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
import AdminStore from './components/Pages/AdminStore';
import Rewards from './components/Pages/Rewards';
import Updates from './components/Pages/Updates';

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

// There is no longer an "exclusive" tier of member pages. These routes used to
// sit behind a guard that bounced anyone without an Experience Card to
// /dashboard, which made sense while membership had to be earned by spending
// CHF 500. Membership is open to everyone now and the card is minted
// automatically on registration, so that guard turned a newly registered
// member into someone silently redirected away from the very pages the home
// page invites them to — and away from their own onboarding steps.
// ProtectedRoute below still requires a signed-in user; that is the only gate.

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
            <Route path="/products" element={<Products />} />
            <Route path="/events" element={<Events />} />
            <Route path="/community" element={<Community />} />
            <Route path="/rewards" element={<Rewards />} />
            <Route path="/updates" element={<Updates />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/store" element={<AdminStore />} />
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
          <Route path="/products" element={<Products />} />
          <Route path="/events" element={<Events />} />
          <Route path="/community" element={<Community />} />
          <Route path="/rewards" element={<Rewards />} />
          <Route path="/updates" element={<Updates />} />
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
