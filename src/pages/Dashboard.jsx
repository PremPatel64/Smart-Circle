import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { 
  Users, Receipt, ArrowDownRight, ArrowUpRight, Landmark, PiggyBank, 
  Plus, Search, ArrowRight, TrendingUp, ShieldAlert 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [budgetData, setBudgetData] = useState(null);
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const [dashRes, budgetRes, expenseRes] = await Promise.all([
        api.get('/reports/dashboard'),
        api.get('/budgets/status'),
        api.get('/expenses/search')
      ]);

      if (dashRes.data.success) {
        setDashboardData(dashRes.data.data);
      }
      if (budgetRes.data.success) {
        setBudgetData(budgetRes.data.data);
      }
      if (expenseRes.data.success) {
        // Show only the 5 most recent expenses
        setRecentExpenses(expenseRes.data.data.slice(0, 5));
      }
    } catch (error) {
      console.error('Error fetching dashboard details:', error);
      toast.error('Unable to fetch some dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Budget progress calculations
  const monthlyLimit = budgetData?.monthlyLimit || 0;
  const totalSpent = budgetData?.totalSpent || 0;
  const budgetRemaining = Math.max(0, monthlyLimit - totalSpent);
  const budgetPercent = monthlyLimit > 0 ? Math.min(100, Math.round((totalSpent / monthlyLimit) * 100)) : 0;

  const cards = [
    {
      title: 'Total Groups',
      value: dashboardData?.totalGroups || 0,
      icon: Users,
      color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
      link: '/groups'
    },
    {
      title: 'Total Expenses',
      value: dashboardData?.totalExpenses || 0,
      icon: Receipt,
      color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
      link: '/reports'
    },
    {
      title: 'You Owe',
      value: `₹${dashboardData?.youOwe || 0}`,
      icon: ArrowDownRight,
      color: dashboardData?.youOwe > 0 
        ? 'text-rose-500 bg-rose-500/10 border-rose-500/20 font-bold' 
        : 'text-slate-400 bg-slate-500/5 border-slate-500/10',
      link: '/groups'
    },
    {
      title: 'You Are Owed',
      value: `₹${dashboardData?.youAreOwed || 0}`,
      icon: ArrowUpRight,
      color: dashboardData?.youAreOwed > 0 
        ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20 font-bold' 
        : 'text-slate-400 bg-slate-500/5 border-slate-500/10',
      link: '/groups'
    },
    {
      title: 'Pending Settlements',
      value: dashboardData?.pendingSettlementsCount || 0,
      icon: Landmark,
      color: 'text-sky-500 bg-sky-500/10 border-sky-500/20',
      link: '/groups'
    },
    {
      title: 'Budget Remaining',
      value: monthlyLimit > 0 ? `₹${budgetRemaining}` : 'No limit set',
      icon: PiggyBank,
      color: budgetPercent >= 100 
        ? 'text-rose-500 bg-rose-500/10 border-rose-500/20' 
        : budgetPercent >= 80 
          ? 'text-amber-500 bg-amber-500/10 border-amber-500/20' 
          : 'text-green-500 bg-green-500/10 border-green-500/20',
      link: '/budgets'
    }
  ];

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {/* Welcome banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100">
            Welcome back, {user?.name} 👋
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Here is your spending and split summary for this month.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/groups"
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-white dark:text-slate-300 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all shadow-sm"
          >
            <Users className="w-4 h-4" />
            <span>View Groups</span>
          </Link>
          <Link
            to="/reports"
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-green-500 hover:bg-green-600 rounded-xl transition-all shadow-md shadow-green-500/15"
          >
            <Plus className="w-4 h-4" />
            <span>Add Expense</span>
          </Link>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 md:gap-4">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Link
              key={idx}
              to={card.link}
              className={`glass-card p-4 flex flex-col justify-between border hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${card.color}`}
            >
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {card.title}
                </span>
                <span className="p-1 rounded-lg bg-white/20 dark:bg-black/10">
                  <Icon className="w-4 h-4" />
                </span>
              </div>
              <h3 className="text-lg md:text-xl font-bold text-slate-800 dark:text-slate-100 mt-4">
                {card.value}
              </h3>
            </Link>
          );
        })}
      </div>

      {/* Main Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Spending Trend */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Trend Chart */}
          <div className="glass-card p-5 border border-slate-200/80 dark:border-slate-800/80 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                <h3 className="font-bold text-slate-800 dark:text-slate-100">Monthly Spending Trend</h3>
              </div>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-semibold">Last 6 Months</span>
            </div>

            <div className="h-64 w-full">
              {dashboardData?.monthlyTrend && dashboardData.monthlyTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dashboardData.monthlyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSpent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis 
                      dataKey="month" 
                      stroke="#64748b" 
                      fontSize={11}
                      tickLine={false} 
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="#64748b" 
                      fontSize={11}
                      tickLine={false} 
                      axisLine={false}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        background: 'rgba(15, 23, 42, 0.9)', 
                        border: '1px solid rgba(255,255,255,0.1)', 
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '12px'
                      }}
                      labelStyle={{ fontWeight: 'bold' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="Spent" 
                      stroke="#22c55e" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorSpent)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400">
                  No spending trend data available.
                </div>
              )}
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="glass-card p-5 border border-slate-200/80 dark:border-slate-800/80 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Recent Transactions</h3>
              <Link to="/reports" className="text-xs text-green-500 hover:text-green-600 hover:underline flex items-center gap-1 font-semibold">
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800/40">
              {recentExpenses.length === 0 ? (
                <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                  No expenses added yet. Create a group and add expenses to see them here!
                </div>
              ) : (
                recentExpenses.map((exp) => (
                  <div key={exp._id} className="py-3 flex justify-between items-center gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-green-500/10 dark:bg-green-500/5 text-green-500 flex items-center justify-center font-bold text-xs">
                        {exp.category ? exp.category[0] : 'O'}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {exp.description}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          Paid by {exp.paidBy?._id === user?._id ? 'You' : exp.paidBy?.name} &bull; {new Date(exp.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        ₹{exp.amount}
                      </span>
                      <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">
                        {exp.category}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Budgets & AI summary */}
        <div className="flex flex-col gap-6">
          {/* Budget remaining component */}
          <div className="glass-card p-5 border border-slate-200/80 dark:border-slate-800/80 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Monthly Budget</h3>
              <Link to="/budgets" className="text-xs text-green-500 hover:text-green-600 font-semibold">
                Manage
              </Link>
            </div>

            {monthlyLimit > 0 ? (
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-end">
                  <div className="flex flex-col">
                    <span className="text-2xl font-black text-slate-800 dark:text-slate-100">
                      ₹{totalSpent}
                    </span>
                    <span className="text-[11px] text-slate-400">spent of ₹{monthlyLimit} limit</span>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    budgetPercent >= 100 
                      ? 'text-rose-500 bg-rose-500/10' 
                      : budgetPercent >= 80 
                        ? 'text-amber-500 bg-amber-500/10' 
                        : 'text-green-500 bg-green-500/10'
                  }`}>
                    {budgetPercent}% Used
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      budgetPercent >= 100 
                        ? 'bg-rose-500' 
                        : budgetPercent >= 80 
                          ? 'bg-amber-500' 
                          : 'bg-green-500'
                    }`}
                    style={{ width: `${budgetPercent}%` }}
                  ></div>
                </div>

                {budgetPercent >= 80 && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl flex items-start gap-2 text-xs">
                    <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>You are approaching your budget limit! Consider pausing non-essential expenses.</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-6 text-center flex flex-col items-center gap-3">
                <PiggyBank className="w-8 h-8 text-slate-400" />
                <p className="text-xs text-slate-500 max-w-[200px] leading-relaxed">
                  Plan your finances by setting a monthly spending limit.
                </p>
                <Link to="/budgets" className="text-xs font-bold text-white bg-green-500 hover:bg-green-600 px-3 py-1.5 rounded-lg">
                  Set Budget Now
                </Link>
              </div>
            )}
          </div>

          {/* Quick Actions Panel */}
          <div className="glass-card p-5 border border-slate-200/80 dark:border-slate-800/80 flex flex-col gap-4">
            <h3 className="font-bold text-slate-800 dark:text-slate-100">Quick Actions</h3>
            <div className="flex flex-col gap-2">
              <Link 
                to="/groups" 
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white/40 dark:bg-slate-900/30 hover:bg-green-500/5 dark:hover:bg-green-500/5 hover:border-green-500/30 transition-all text-slate-700 dark:text-slate-300 font-semibold text-sm"
              >
                <span>Create Shared Group</span>
                <Plus className="w-4 h-4 text-green-500" />
              </Link>
              <Link 
                to="/reports" 
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white/40 dark:bg-slate-900/30 hover:bg-green-500/5 dark:hover:bg-green-500/5 hover:border-green-500/30 transition-all text-slate-700 dark:text-slate-300 font-semibold text-sm"
              >
                <span>Add Group Expense</span>
                <Plus className="w-4 h-4 text-green-500" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
