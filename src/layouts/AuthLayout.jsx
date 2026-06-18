import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AuthLayout = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-slate-900 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-sm text-slate-400 mt-4 font-semibold">Loading SmartSplit...</span>
      </div>
    );
  }

  // Redirect to dashboard if already logged in
  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen w-full bg-slate-900 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Decorative Blur Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-green-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">
        {/* App Title Header */}
        <div className="text-center mb-8 flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-green-500 flex items-center justify-center font-bold text-2xl text-white shadow-xl shadow-green-500/35">
            S
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            SmartSplit
          </h1>
          <p className="text-slate-400 text-sm max-w-xs leading-relaxed">
            Split costs, optimize debts, and track budgets with intelligent AI insights.
          </p>
        </div>

        {/* Child Router Panel */}
        <div className="glass-card bg-slate-800/40 border border-slate-700/35 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
