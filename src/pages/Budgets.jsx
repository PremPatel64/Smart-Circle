import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { PiggyBank, AlertTriangle, ShieldCheck, PenTool, Check, Save } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';

const Budgets = () => {
  const [budgetStatus, setBudgetStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Settings edit states
  const [isEditing, setIsEditing] = useState(false);
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [categoryLimits, setCategoryLimits] = useState({
    Food: '', Travel: '', Rent: '', Shopping: '', Entertainment: '',
    Utilities: '', Healthcare: '', Education: '', Others: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  const fetchBudgetStatus = async () => {
    try {
      const { data } = await api.get('/budgets/status');
      if (data.success) {
        setBudgetStatus(data.data);
        setMonthlyLimit(data.data.monthlyLimit || '');
        
        const catLimits = {
          Food: '', Travel: '', Rent: '', Shopping: '', Entertainment: '',
          Utilities: '', Healthcare: '', Education: '', Others: ''
        };
        data.data.categoryLimits.forEach(cl => {
          catLimits[cl.category] = cl.limit || '';
        });
        setCategoryLimits(catLimits);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load budget details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgetStatus();
  }, []);

  const handleSaveBudget = async (e) => {
    e.preventDefault();
    if (!monthlyLimit || parseFloat(monthlyLimit) < 0) {
      return toast.error('Please enter a valid monthly limit');
    }

    setIsSaving(true);
    try {
      const formattedCategoryLimits = Object.entries(categoryLimits)
        .map(([category, limit]) => ({
          category,
          limit: limit === '' ? 0 : parseFloat(limit)
        }))
        .filter(cl => cl.limit > 0);

      const { data } = await api.post('/budgets', {
        monthlyLimit: parseFloat(monthlyLimit),
        categoryLimits: formattedCategoryLimits
      });

      if (data.success) {
        toast.success('Budget limits updated successfully!');
        setIsEditing(false);
        fetchBudgetStatus();
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Failed to save budget settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCategoryLimitChange = (cat, val) => {
    setCategoryLimits(prev => ({
      ...prev,
      [cat]: val
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Calculate Overall consumption percentages
  const limit = budgetStatus?.monthlyLimit || 0;
  const spent = budgetStatus?.totalSpent || 0;
  const percent = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
  const remaining = Math.max(0, limit - spent);

  // Prepare chart data comparing Category limit vs Category spent
  // Exclude categories that have 0 limit AND 0 spent to keep the chart readable
  const categoriesList = ['Food', 'Travel', 'Rent', 'Shopping', 'Entertainment', 'Utilities', 'Healthcare', 'Education', 'Others'];
  const chartData = categoriesList.map(cat => {
    const cl = budgetStatus.categoryLimits.find(item => item.category === cat);
    const catLimit = cl ? cl.limit : 0;
    const catSpent = budgetStatus.categorySpent[cat] || 0;
    return {
      name: cat,
      Limit: catLimit,
      Spent: catSpent
    };
  }).filter(item => item.Limit > 0 || item.Spent > 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Header section */}
      <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800/40 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100">Financial Budgets</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure monthly targets and track category-wise overspending.
          </p>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-green-500 hover:bg-green-600 rounded-xl transition-all shadow-md shadow-green-500/10"
          >
            <PenTool className="w-4 h-4" />
            <span>Adjust Limits</span>
          </button>
        )}
      </div>

      {isEditing ? (
        /* BUDGET SETTING FORM */
        <form onSubmit={handleSaveBudget} className="glass-card border border-slate-200 dark:border-slate-800/80 p-6 rounded-3xl flex flex-col gap-6 max-w-2xl">
          <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800/40 pb-3">
            <h3 className="font-bold text-slate-800 dark:text-slate-100">Adjust Budget Targets</h3>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-850"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Total Monthly Limit */}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Total Monthly Budget (₹)</label>
              <input
                type="number"
                value={monthlyLimit}
                onChange={(e) => setMonthlyLimit(e.target.value)}
                placeholder="e.g. 10000"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/15"
                required
              />
            </div>

            {/* Category Limits */}
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider sm:col-span-2 mt-2">Category Limits (Optional)</h4>
            {categoriesList.map(cat => (
              <div key={cat} className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">{cat} Limit (₹)</label>
                <input
                  type="number"
                  value={categoryLimits[cat]}
                  onChange={(e) => handleCategoryLimitChange(cat, e.target.value)}
                  placeholder="No limit"
                  className="w-full px-4.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:border-green-500"
                />
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-green-500 hover:bg-green-600 disabled:bg-green-500/50 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-green-500/10 flex items-center justify-center gap-2 transition-all"
          >
            {isSaving ? 'Saving Changes...' : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Limits</span>
              </>
            )}
          </button>
        </form>
      ) : (
        /* BUDGET VIEW DASHBOARD */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Consumption Status */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="glass-card p-5 border border-slate-200/80 dark:border-slate-800/80 flex flex-col gap-5">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <PiggyBank className="w-5 h-5 text-slate-500" />
                <span>Monthly Budget Consumption</span>
              </h3>

              {limit > 0 ? (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-3 bg-slate-100 dark:bg-slate-900/40 rounded-2xl flex flex-col gap-1">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Limit</span>
                      <span className="text-lg font-black text-slate-700 dark:text-slate-300">₹{limit}</span>
                    </div>
                    <div className="p-3 bg-slate-100 dark:bg-slate-900/40 rounded-2xl flex flex-col gap-1">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Spent</span>
                      <span className="text-lg font-black text-slate-700 dark:text-slate-300">₹{spent}</span>
                    </div>
                    <div className="p-3 bg-slate-100 dark:bg-slate-900/40 rounded-2xl flex flex-col gap-1">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Remaining</span>
                      <span className={`text-lg font-black ${percent >= 100 ? 'text-rose-500' : 'text-green-500'}`}>₹{remaining}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 mt-2">
                    <div className="flex justify-between items-center text-xs text-slate-500">
                      <span>Consumed ({percent}%)</span>
                      <span>₹{spent} / ₹{limit}</span>
                    </div>
                    {/* Overall Slider */}
                    <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          percent >= 100 ? 'bg-rose-500' :
                          percent >= 80 ? 'bg-amber-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-slate-400 dark:text-slate-500 text-xs">
                  No monthly budget limit configured. Adjust limits above to get started.
                </div>
              )}
            </div>

            {/* Category Chart comparison */}
            {chartData.length > 0 && (
              <div className="glass-card p-5 border border-slate-200/80 dark:border-slate-800/80 flex flex-col gap-4">
                <h3 className="font-bold text-slate-800 dark:text-slate-100">Limits vs Spent (Category-wise)</h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ 
                          background: 'rgba(15, 23, 42, 0.9)', 
                          border: '1px solid rgba(255,255,255,0.1)', 
                          borderRadius: '8px',
                          color: '#f8fafc',
                          fontSize: '12px'
                        }}
                      />
                      <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="Limit" fill="#475569" radius={[4, 4, 0, 0]} barSize={15} />
                      <Bar dataKey="Spent" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={15} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: category list */}
          <div className="flex flex-col gap-6">

            {/* Category Lists detailed review */}
            <div className="glass-card p-5 border border-slate-200/80 dark:border-slate-800/80 flex flex-col gap-4">
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Category Budgets</h3>
              <div className="flex flex-col gap-2.5">
                {categoriesList.map(cat => {
                  const cl = budgetStatus.categoryLimits.find(item => item.category === cat);
                  const catLimit = cl ? cl.limit : 0;
                  const catSpent = budgetStatus.categorySpent[cat] || 0;
                  const isOverspent = catLimit > 0 && catSpent > catLimit;
                  const catPercent = catLimit > 0 ? Math.min(100, Math.round((catSpent / catLimit) * 100)) : 0;

                  return (
                    <div key={cat} className="flex justify-between items-center text-xs pb-2 border-b border-slate-100 dark:border-slate-900 last:border-0 last:pb-0">
                      <div className="flex flex-col text-left">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{cat}</span>
                        <span className="text-[10px] text-slate-400">
                          {catLimit > 0 ? `Limit: ₹${catLimit}` : 'No Limit'}
                        </span>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <span className="font-bold text-slate-700 dark:text-slate-300">₹{catSpent}</span>
                        {catLimit > 0 && (
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${
                            isOverspent ? 'bg-rose-500/10 text-rose-500' : 'bg-green-500/10 text-green-500'
                          }`}>
                            {catPercent}%
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default Budgets;
