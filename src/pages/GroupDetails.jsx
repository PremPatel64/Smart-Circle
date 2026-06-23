import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeft, Plus, Zap, Heart, Trash2, Edit2, ShieldAlert,
  ArrowRight, Users, CheckCircle, Clock, Landmark, DollarSign, X, HelpCircle 
} from 'lucide-react';
import toast from 'react-hot-toast';

const GroupDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [group, setGroup] = useState(null);
  const [health, setHealth] = useState(null);
  const [optimization, setOptimization] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('expenses'); // expenses, balances, settlements

  // Modals
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [showOptimizeModal, setShowOptimizeModal] = useState(false);

  // Expense Form State
  const [expAmount, setExpAmount] = useState('');
  const [expDescription, setExpDescription] = useState('');
  const [expCategory, setExpCategory] = useState('Others');
  const [expSplitType, setExpSplitType] = useState('equal');
  const [expSplitAmong, setExpSplitAmong] = useState([]); // Array of { user: userId, share: number }
  const [isAddingExpense, setIsAddingExpense] = useState(false);

  // Direct Settlement Form State
  const [settleRecipient, setSettleRecipient] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [isLoggingSettlement, setIsLoggingSettlement] = useState(false);

  const fetchGroupDetails = useCallback(async () => {
    try {
      const [detailsRes, expensesRes, settlementsRes] = await Promise.all([
        api.get(`/groups/${id}?t=${Date.now()}`),
        api.get(`/expenses/group/${id}?t=${Date.now()}`),
        api.get(`/settlements/group/${id}?t=${Date.now()}`)
      ]);

      if (detailsRes.data.success) {
        const { group, health, optimization } = detailsRes.data.data;
        setGroup(group);
        setHealth(health);
        setOptimization(optimization);
        
        // Initialize expense splits template (all members checked by default)
        const initSplits = group.members.map(m => ({
          user: m._id,
          name: m.name,
          share: 1, // default share/percentage value
          checked: true
        }));
        setExpSplitAmong(initSplits);
      }

      if (expensesRes.data.success) {
        setExpenses(expensesRes.data.data);
      }

      if (settlementsRes.data.success) {
        setSettlements(settlementsRes.data.data);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load group details');
      navigate('/groups');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchGroupDetails();
  }, [fetchGroupDetails]);

  // Handle direct category prediction lookup as user types description
  useEffect(() => {
    if (expDescription.trim().length > 2) {
      const localKeywords = {
        Food: ['pizza', 'domino', 'burger', 'restaurant', 'food', 'cafe', 'lunch', 'dinner', 'starbucks', 'zomato', 'swiggy', 'grocery', 'grocery', 'eat'],
        Travel: ['uber', 'ola', 'cab', 'taxi', 'flight', 'train', 'bus', 'ticket', 'petrol', 'fuel', 'metro', 'trip'],
        Rent: ['rent', 'flat', 'deposit', 'room', 'lease'],
        Shopping: ['amazon', 'flipkart', 'myntra', 'clothes', 'shoes', 'shopping'],
        Entertainment: ['netflix', 'spotify', 'movie', 'cinema', 'game', 'bar', 'party', 'drinks', 'beer'],
        Utilities: ['electricity', 'water', 'gas', 'internet', 'wifi', 'recharge', 'phone', 'bill'],
        Healthcare: ['doctor', 'hospital', 'medicine', 'pharmacy', 'clinic', 'gym'],
        Education: ['book', 'course', 'tuition', 'school', 'fee', 'udemy']
      };

      const descLower = expDescription.toLowerCase();
      let predicted = 'Others';
      
      for (const [cat, keywords] of Object.entries(localKeywords)) {
        if (keywords.some(kw => descLower.includes(kw))) {
          predicted = cat;
          break;
        }
      }
      setExpCategory(predicted);
    }
  }, [expDescription]);

  // Calculations for split displays in Add Expense modal
  const getCalculatedShares = () => {
    const amt = parseFloat(expAmount) || 0;
    const activeParticipants = expSplitAmong.filter(s => s.checked);
    
    if (amt <= 0 || activeParticipants.length === 0) return {};

    const shares = {};

    if (expSplitType === 'equal') {
      const splitVal = Math.round((amt / activeParticipants.length) * 100) / 100;
      activeParticipants.forEach(p => {
        shares[p.user] = splitVal;
      });
    } else if (expSplitType === 'percentage') {
      activeParticipants.forEach(p => {
        const val = parseFloat(p.share) || 0;
        shares[p.user] = Math.round((amt * (val / 100)) * 100) / 100;
      });
    } else if (expSplitType === 'exact') {
      activeParticipants.forEach(p => {
        shares[p.user] = parseFloat(p.share) || 0;
      });
    } else if (expSplitType === 'shares') {
      const totalShares = activeParticipants.reduce((sum, p) => sum + (parseFloat(p.share) || 0), 0);
      if (totalShares > 0) {
        activeParticipants.forEach(p => {
          const val = parseFloat(p.share) || 0;
          shares[p.user] = Math.round((amt * (val / totalShares)) * 100) / 100;
        });
      } else {
        activeParticipants.forEach(p => {
          shares[p.user] = 0;
        });
      }
    }
    return shares;
  };

  const calculatedShares = getCalculatedShares();

  const handleSplitParticipantChange = (userId, field, val) => {
    setExpSplitAmong(prev => prev.map(item => {
      if (item.user === userId) {
        return { ...item, [field]: val };
      }
      return item;
    }));
  };

  // Submit Expense
  const handleAddExpenseSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(expAmount);
    
    if (!amt || amt <= 0) return toast.error('Amount must be greater than zero');
    if (!expDescription) return toast.error('Please enter a description');

    const activeParticipants = expSplitAmong.filter(p => p.checked);
    if (activeParticipants.length === 0) {
      return toast.error('Please select at least one member to split among');
    }

    // ValPct
    if (expSplitType === 'percentage') {
      const sumPct = activeParticipants.reduce((sum, p) => sum + (parseFloat(p.share) || 0), 0);
      if (Math.abs(sumPct - 100) > 0.1) {
        return toast.error(`Percentages must sum to 100% (currently ${sumPct}%)`);
      }
    }
    // ValExact
    if (expSplitType === 'exact') {
      const sumExact = activeParticipants.reduce((sum, p) => sum + (parseFloat(p.share) || 0), 0);
      if (Math.abs(sumExact - amt) > 0.5) {
        return toast.error(`Exact splits must sum to total expense amount (currently ₹${sumExact} of ₹${amt})`);
      }
    }
    // ValShares
    if (expSplitType === 'shares') {
      const totalShares = activeParticipants.reduce((sum, p) => sum + (parseFloat(p.share) || 0), 0);
      if (totalShares <= 0) {
        return toast.error('Total shares must be greater than zero');
      }
    }

    setIsAddingExpense(true);
    try {
      const splitAmongPayload = activeParticipants.map(p => ({
        user: p.user,
        share: parseFloat(p.share) || 0
      }));

      const { data } = await api.post('/expenses', {
        amount: amt,
        description: expDescription,
        category: expCategory,
        splitType: expSplitType,
        splitAmong: splitAmongPayload,
        groupId: id
      });

      if (data.success) {
        toast.success('Expense added successfully!');
        setShowExpenseModal(false);
        setExpAmount('');
        setExpDescription('');
        setExpCategory('Others');
        setExpSplitType('equal');
        
        // Reset split shares
        setExpSplitAmong(prev => prev.map(item => ({ ...item, share: 1, checked: true })));
        fetchGroupDetails();
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Failed to add expense');
    } finally {
      setIsAddingExpense(false);
    }
  };

  // Submit Direct Settlement
  const handleSettleSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(settleAmount);

    if (!settleRecipient) return toast.error('Please select who you are paying');
    if (!amt || amt <= 0) return toast.error('Amount must be greater than zero');

    // Find who owes whom to dynamically assign payer and receiver
    const oweTx = optimization?.originalTransactions?.find(
      tx => tx.fromUser?._id === user?._id && tx.toUser?._id === settleRecipient
    );
    const owedTx = optimization?.originalTransactions?.find(
      tx => tx.toUser?._id === user?._id && tx.fromUser?._id === settleRecipient
    );

    const finalPayerId = owedTx ? settleRecipient : user?._id;
    const finalReceiverId = owedTx ? user?._id : settleRecipient;

    setIsLoggingSettlement(true);
    try {
      const { data } = await api.post('/settlements/pay', {
        groupId: id,
        payerId: finalPayerId,
        receiverId: finalReceiverId,
        amount: amt
      });

      if (data.success) {
        toast.success('Payment recorded successfully! Balance updated.');
        setShowSettleModal(false);
        setSettleRecipient('');
        setSettleAmount('');
        fetchGroupDetails();
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Failed to record payment');
    } finally {
      setIsLoggingSettlement(false);
    }
  };

  // Pre-fill and open quick settle modal
  const handleQuickSettle = (recipientId, amount) => {
    setSettleRecipient(recipientId);
    setSettleAmount(amount.toString());
    setShowSettleModal(true);
  };

  // Confirm P2P Settlement
  const handleConfirmSettlement = async (settleId) => {
    try {
      const { data } = await api.put(`/settlements/${settleId}/confirm`);
      if (data.success) {
        toast.success('Payment confirmed! Balance cleared.');
        fetchGroupDetails();
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Failed to confirm payment');
    }
  };

  // Confirm Smart Circle Optimization
  const handleConfirmOptimize = async () => {
    if (!window.confirm("Are you sure you want to apply Smart Circle optimization? This will simplify and settle all intermediate debts in the group.")) {
      return;
    }
    try {
      const { data } = await api.post(`/settlements/optimize/${id}`);
      if (data.success) {
        toast.success('Smart Circle optimization applied successfully!');
        setShowOptimizeModal(false);
        fetchGroupDetails();
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Failed to apply optimization');
    }
  };

  // Delete Expense
  const handleDeleteExpense = async (expId, desc) => {
    if (!window.confirm(`Are you sure you want to delete expense "${desc}"?`)) {
      return;
    }

    try {
      const { data } = await api.delete(`/expenses/${expId}`);
      if (data.success) {
        toast.success(`Expense "${desc}" deleted.`);
        fetchGroupDetails();
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Failed to delete expense');
    }
  };

  // Delete Settlement
  const handleDeleteSettlement = async (settleId) => {
    if (!window.confirm('Are you sure you want to delete this settlement? This will restore outstanding balances.')) {
      return;
    }

    try {
      const { data } = await api.delete(`/settlements/${settleId}`);
      if (data.success) {
        toast.success('Settlement deleted successfully!');
        fetchGroupDetails();
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Failed to delete settlement');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Health Score Style
  const hs = health?.score || 100;
  const healthBadgeColor = 
    hs >= 90 ? 'text-green-500 bg-green-500/10' :
    hs >= 70 ? 'text-sky-500 bg-sky-500/10' :
    hs >= 50 ? 'text-amber-500 bg-amber-500/10' : 'text-rose-500 bg-rose-500/10';

  return (
    <div className="flex flex-col gap-6">
      {/* Top Navigation Row */}
      <div className="flex justify-between items-center">
        <Link to="/groups" className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 flex items-center gap-1 font-bold">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Groups</span>
        </Link>
      </div>

      {/* Hero header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-slate-800/40 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 dark:text-slate-100">
            {group?.groupName}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
            {group?.description || 'Shared splits and peer accounts.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Record transfer */}
          <button
            onClick={() => {
              const firstMember = group?.members.find(m => m._id !== user?._id);
              if (firstMember) {
                setSettleRecipient(firstMember._id);
              }
              setSettleAmount('');
              setShowSettleModal(true);
            }}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 bg-white dark:text-slate-300 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all shadow-sm"
          >
            <Landmark className="w-3.5 h-3.5" />
            <span>Record Payment</span>
          </button>
          {/* Add Expense */}
          <button
            onClick={() => setShowExpenseModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-green-500 hover:bg-green-600 rounded-xl transition-all shadow-md shadow-green-500/10"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {/* SMART CIRCLE SUGGESTION BANNER */}
      {optimization?.middleUsers?.includes(user?._id) && optimization?.optimizedTransactions?.length > 0 && (
        <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 dark:border-emerald-500/10 p-6 rounded-3xl flex flex-col gap-4 shadow-lg shadow-emerald-500/5 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex justify-between items-start md:items-center flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-555 bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Zap className="w-5 h-5 fill-current" />
              </div>
              <div className="flex flex-col text-left">
                <h3 className="font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <span>Smart Circle Available</span>
                  <span className="text-[10px] uppercase bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-full">
                    Optimizable Chain
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  You are a middle user in a debt chain. Apply Smart Circle to bypass intermediate transfers.
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 bg-white/60 dark:bg-slate-900/40 px-4 py-2 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="flex flex-col text-left">
                <span className="text-[9px] uppercase tracking-wider font-semibold text-slate-400">Transactions Reduced</span>
                <span className="text-sm font-black text-slate-850 dark:text-slate-100">
                  {optimization.originalTransactions.length} &rarr; {optimization.optimizedTransactions.length}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
            {/* Current Chain */}
            <div className="flex flex-col gap-2 p-4 bg-white/40 dark:bg-slate-900/20 border border-slate-100 dark:border-slate-850 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider text-left">Current:</span>
              <div className="flex flex-col gap-2 max-h-36 overflow-y-auto no-scrollbar">
                {optimization.originalTransactions.map((tx, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">{tx.fromUser?.name} &rarr; {tx.toUser?.name}</span>
                    <span className="font-bold text-slate-700 dark:text-slate-350">₹{tx.amount}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Optimized Chain */}
            <div className="flex flex-col gap-2 p-4 bg-emerald-500/5 dark:bg-emerald-500/2 border border-emerald-500/10 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-emerald-555 dark:text-emerald-400 tracking-wider text-left">Optimized:</span>
              <div className="flex flex-col gap-2 max-h-36 overflow-y-auto no-scrollbar">
                {optimization.optimizedTransactions.map((tx, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs text-slate-700 dark:text-slate-300 font-semibold">
                    <span>{tx.fromUser?.name} &rarr; {tx.toUser?.name}</span>
                    <span className="font-extrabold text-emerald-500">₹{tx.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-1">
            <button
              onClick={handleConfirmOptimize}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-all shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/25 active:scale-[0.98]"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Apply Smart Circle</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (2 cols): Tab Contents */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Tabs header */}
          <div className="flex border-b border-slate-200 dark:border-slate-800/50">
            {['expenses', 'balances', 'settlements'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2.5 text-sm font-semibold capitalize transition-all border-b-2 -mb-[2px] ${
                  activeTab === tab
                    ? 'border-green-500 text-green-500'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* TAB: EXPENSES */}
          {activeTab === 'expenses' && (
            <div className="flex flex-col gap-4">
              {expenses.length === 0 ? (
                <div className="glass-card p-12 text-center flex flex-col items-center justify-center gap-3 border border-slate-200 dark:border-slate-800/60">
                  <DollarSign className="w-10 h-10 text-slate-400" />
                  <h3 className="font-bold text-slate-700 dark:text-slate-300">No Expenses Yet</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">
                    Splits are empty! Click "Add Expense" to record a group bill.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {expenses.map((exp) => (
                    <div
                      key={exp._id}
                      className="glass-card border border-slate-200/80 dark:border-slate-800/60 p-4 flex justify-between items-center gap-4 hover:scale-[1.01] transition-transform"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-green-500/10 dark:bg-green-500/5 text-green-500 flex items-center justify-center font-bold text-xs">
                          {exp.category ? exp.category[0] : 'O'}
                        </div>
                        <div className="flex flex-col text-left">
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                            {exp.description}
                          </span>
                          <span className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            Paid by <span className="font-semibold text-slate-600 dark:text-slate-300">{exp.paidBy?._id === user?._id ? 'You' : exp.paidBy?.name}</span> &bull; {new Date(exp.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end">
                          <span className="text-sm font-black text-slate-800 dark:text-slate-100">
                            ₹{exp.amount}
                          </span>
                          <span className="text-[9px] font-semibold text-slate-400 tracking-wider uppercase">
                            {exp.category}
                          </span>
                        </div>

                        {/* Actions */}
                        {(exp.paidBy?._id === user?._id || group?.createdBy?._id === user?._id) && (
                          <button
                            onClick={() => handleDeleteExpense(exp._id, exp.description)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 dark:hover:bg-rose-950/20"
                            title="Delete Expense"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: BALANCES */}
          {activeTab === 'balances' && (
            <div className="flex flex-col gap-6">
              {/* 1. Your Settlements Section */}
              <div className="glass-card p-5 border border-slate-200 dark:border-slate-800/80 flex flex-col gap-4">
                <div className="border-b border-slate-100 dark:border-slate-800/40 pb-3 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-500" />
                    <span>Your Debts & Receivables</span>
                  </h3>
                  {optimization?.middleUsers?.includes(user?._id) && optimization?.optimizedTransactions?.length > 0 && (
                    <button
                      onClick={handleConfirmOptimize}
                      className="flex items-center gap-1.5 text-xs font-bold text-white bg-green-500 hover:bg-green-600 px-3 py-1.5 rounded-lg shadow-sm shadow-green-500/10"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Smart Circle ({optimization.optimizedTransactions.length})</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  {(() => {
                    // Filter transactions involving current user
                    const myDebts = optimization?.originalTransactions?.filter(
                      tx => tx.fromUser?._id === user?._id
                    ) || [];
                    const myReceivables = optimization?.originalTransactions?.filter(
                      tx => tx.toUser?._id === user?._id
                    ) || [];

                    if (myDebts.length === 0 && myReceivables.length === 0) {
                      return (
                        <div className="text-center py-4 text-slate-500 dark:text-slate-400 text-xs">
                          You are completely settled up in this group! 🎉
                        </div>
                      );
                    }

                    return (
                      <div className="flex flex-col gap-2.5">
                        {/* You Owe List */}
                        {myDebts.map((tx, idx) => (
                          <div key={`debt-${idx}`} className="flex justify-between items-center p-3 rounded-xl bg-rose-500/5 border border-rose-500/10 gap-4">
                            <div className="flex items-center gap-2 text-left">
                              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                                You owe <span className="font-bold text-slate-800 dark:text-slate-200">{tx.toUser?.name}</span>
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-black text-rose-500">₹{tx.amount}</span>
                              <button
                                onClick={() => handleQuickSettle(tx.toUser?._id, tx.amount)}
                                className="px-3 py-1.5 text-[10px] font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-lg shadow-sm transition-all"
                              >
                                Settle Up
                              </button>
                            </div>
                          </div>
                        ))}

                        {/* Receivables List */}
                        {myReceivables.map((tx, idx) => (
                          <div key={`rec-${idx}`} className="flex justify-between items-center p-3 rounded-xl bg-green-500/5 border border-green-500/10 gap-4">
                            <div className="flex items-center gap-2 text-left">
                              <span className="w-2 h-2 rounded-full bg-green-500"></span>
                              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                                <span className="font-bold text-slate-800 dark:text-slate-200">{tx.fromUser?.name}</span> owes you
                              </span>
                            </div>
                            <span className="text-sm font-black text-green-500">₹{tx.amount}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* 2. Group Balance Sheet */}
              <div className="glass-card p-5 border border-slate-200 dark:border-slate-800/80 flex flex-col gap-4">
                <div className="border-b border-slate-100 dark:border-slate-800/40 pb-3">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-left">
                    <Users className="w-5 h-5 text-slate-500" />
                    <span>Peer Balance Sheet</span>
                  </h3>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800/40">
                  {optimization?.netBalances.map((item) => {
                    const isCurrentUser = item.user?._id === user?._id;
                    const balVal = item.balance;
                    
                    return (
                      <div key={item.user?._id} className="py-3.5 flex justify-between items-center gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold uppercase text-xs">
                            {item.user?.avatar ? (
                              <img src={item.user.avatar} alt={item.user.name} className="w-full h-full object-cover" />
                            ) : (
                              item.user?.name ? item.user.name[0] : 'U'
                            )}
                          </div>
                          <div className="flex flex-col text-left">
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                              {item.user?.name} {isCurrentUser && <span className="text-xs text-slate-400 font-normal">(You)</span>}
                            </span>
                            <span className="text-xs text-slate-400">{item.user?.email}</span>
                          </div>
                        </div>

                        <div className="text-right">
                          {balVal > 0.05 ? (
                            <div className="flex flex-col">
                              <span className="text-sm font-black text-green-500">+₹{balVal}</span>
                              <span className="text-[10px] text-green-600 font-medium">gets back</span>
                            </div>
                          ) : balVal < -0.05 ? (
                            <div className="flex flex-col">
                              <span className="text-sm font-black text-rose-500">-₹{Math.abs(balVal)}</span>
                              <span className="text-[10px] text-rose-600 font-medium">owes</span>
                            </div>
                          ) : (
                            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">Settled</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB: SETTLEMENTS */}
          {activeTab === 'settlements' && (
            <div className="flex flex-col gap-4">
              <div className="glass-card p-5 border border-slate-200 dark:border-slate-800/80 flex flex-col gap-4">
                <div className="border-b border-slate-100 dark:border-slate-800/40 pb-3">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-left">
                    <DollarSign className="w-5 h-5 text-green-500" />
                    <span>Group Settlements</span>
                  </h3>
                  <div className="flex flex-col gap-3">
                    {group?.members
                      .filter(m => m._id !== user?._id)
                      .map(m => {
                        // Find relative debt status
                        const oweTx = optimization?.originalTransactions?.find(
                          tx => tx.fromUser?._id === user?._id && tx.toUser?._id === m._id
                        );
                        const owedTx = optimization?.originalTransactions?.find(
                          tx => tx.toUser?._id === user?._id && tx.fromUser?._id === m._id
                        );

                        let balanceText = "Settled";
                        let amountStyle = "text-slate-400 dark:text-slate-500 font-bold";

                        if (oweTx) {
                          balanceText = `You owe ₹${oweTx.amount}`;
                          amountStyle = "text-red-500 font-bold";
                        } else if (owedTx) {
                          balanceText = `Owes you ₹${owedTx.amount}`;
                          amountStyle = "text-green-500 font-bold";
                        }

                        return (
                          <button
                            key={m._id}
                            type="button"
                            onClick={() => {
                              setSettleRecipient(m._id);
                              setSettleAmount("");
                              setShowSettleModal(true);
                            }}
                            className="w-full flex justify-between items-center p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/40 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-all text-left"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold uppercase text-xs">
                                {m.avatar ? (
                                  <img src={m.avatar} alt={m.name} className="w-full h-full object-cover rounded-lg" />
                                ) : (
                                  m.name[0]
                                )}
                              </div>
                              <span className="text-sm font-semibold text-slate-850 dark:text-slate-200">
                                {m.name}
                              </span>
                            </div>
                            <span className={`text-sm ${amountStyle}`}>
                              {balanceText}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              </div>

              {/* Settlement History Card */}
              <div className="glass-card p-5 border border-slate-200 dark:border-slate-800/80 flex flex-col gap-4">
                <div className="border-b border-slate-100 dark:border-slate-800/40 pb-3">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-left">
                    <Clock className="w-5 h-5 text-slate-500" />
                    <span>Settlement History</span>
                  </h3>
                </div>

                <div className="flex flex-col gap-3">
                  {settlements.length === 0 ? (
                    <div className="text-center py-4 text-slate-500 dark:text-slate-400 text-xs">
                      No settlements recorded yet.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {settlements.map((s) => {
                        const canDelete = s.fromUser?._id === user?._id || s.toUser?._id === user?._id || group?.createdBy?._id === user?._id;
                        const isPending = s.status === 'pending';
                        const isReceiver = s.toUser?._id === user?._id;
                        
                        return (
                          <div
                            key={s._id}
                            className="flex justify-between items-center p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/40 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-all text-left"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg ${isPending ? 'bg-amber-500/10 text-amber-500' : 'bg-green-500/10 text-green-500'} flex items-center justify-center font-bold text-xs`}>
                                {s.isOptimized ? <Zap className="w-4 h-4 fill-current" /> : <Landmark className="w-4 h-4" />}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                  <span className="font-bold">{s.fromUser?.name || 'User'}</span> {isPending ? 'owes' : 'paid'} <span className="font-bold">{s.toUser?.name || 'User'}</span>
                                  {isPending && (
                                    <span className="ml-2 px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                      Pending
                                    </span>
                                  )}
                                </span>
                                <span className="text-[10px] text-slate-400 mt-0.5">
                                  {new Date(s.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} &bull; {s.isOptimized ? 'Smart Circle' : 'Manual'}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className={`text-sm font-black font-bold ${
                                isPending
                                  ? (s.fromUser?._id === user?._id ? 'text-red-500' : s.toUser?._id === user?._id ? 'text-green-500' : 'text-amber-500')
                                  : 'text-green-500'
                              }`}>
                                ₹{s.amount}
                              </span>
                              {isPending && isReceiver && (
                                <button
                                  type="button"
                                  onClick={() => handleConfirmSettlement(s._id)}
                                  className="p-1.5 rounded-lg text-amber-500 hover:text-green-500 hover:bg-green-500/10 dark:hover:bg-green-950/20"
                                  title="Confirm Payment Received"
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSettlement(s._id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 dark:hover:bg-rose-950/20"
                                  title="Delete Settlement"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Right Column: Widgets */}
        <div className="flex flex-col gap-6">
          
          {/* Health score widget */}
          {health && (
            <div className="glass-card p-5 border border-slate-200/80 dark:border-slate-800/80 flex flex-col gap-4">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Heart className="w-5 h-5 text-rose-500 fill-current" />
                <span>Group Health</span>
              </h3>

              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-3xl font-black text-slate-800 dark:text-slate-100">
                      {health.score}/100
                    </span>
                    <span className="text-xs text-slate-400 mt-0.5">Health Score Rating</span>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${healthBadgeColor}`}>
                    {health.label}
                  </span>
                </div>

                {/* Health slider */}
                <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      health.score >= 90 ? 'bg-green-500' :
                      health.score >= 70 ? 'bg-sky-500' :
                      health.score >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${health.score}%` }}
                  ></div>
                </div>

                {/* Bullet Reasons */}
                <div className="flex flex-col gap-2 mt-2">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Analysis:</span>
                  <div className="flex flex-col gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    {health.reasons.map((r, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full mt-1.5 flex-shrink-0"></span>
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Group Members List Widget */}
          <div className="glass-card p-5 border border-slate-200/80 dark:border-slate-800/80 flex flex-col gap-4">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <Users className="w-5 h-5 text-slate-500" />
              <span>Group Members</span>
            </h3>

            <div className="flex flex-col gap-3">
              {group?.members.map(m => (
                <div key={m._id} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px]">
                    {m.avatar ? (
                      <img src={m.avatar} alt={m.name} className="w-full h-full object-cover" />
                    ) : (
                      m.name[0]
                    )}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {m.name}
                    </span>
                    {group.createdBy?._id === m._id && (
                      <span className="text-[9px] text-green-600 bg-green-500/10 px-1 py-0.2 rounded self-start font-medium">Creator</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* SMART CIRCLE OPTIMIZATION MODAL */}
      {showOptimizeModal && optimization && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl glass-card border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 md:p-8 rounded-3xl shadow-2xl relative flex flex-col gap-5 max-h-[90vh] overflow-y-auto no-scrollbar animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-green-500" />
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Apply Smart Circle Optimization?</h2>
              </div>
              <button
                onClick={() => setShowOptimizeModal(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 rounded-xl flex items-start gap-2 text-xs leading-relaxed">
              <Zap className="w-4 h-4 flex-shrink-0 mt-0.5 text-green-500" />
              <div>
                <strong>Smart Circle</strong> has simplified group balances using Graph Theory. We reduced the transactions list size by <strong>{optimization.transactionReductionCount}</strong> transfers and settled a total of <strong>₹{optimization.totalMoneySettled}</strong> outstanding value.
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
              {/* Original debts */}
              <div className="flex flex-col gap-3">
                <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">Current Debts:</span>
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto no-scrollbar bg-slate-50 dark:bg-slate-900/30 p-3 rounded-2xl border border-slate-100 dark:border-slate-850">
                  {optimization.originalTransactions.length === 0 ? (
                    <span className="text-xs text-slate-400 text-center py-4">No outstanding balances.</span>
                  ) : (
                    optimization.originalTransactions.map((tx, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">{tx.fromUser?.name} &rarr; {tx.toUser?.name}</span>
                        <span className="font-bold text-slate-700 dark:text-slate-350">₹{tx.amount}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Optimized debts */}
              <div className="flex flex-col gap-3">
                <span className="text-xs uppercase font-bold text-green-500 tracking-wider">New Debts:</span>
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto no-scrollbar bg-green-500/5 dark:bg-green-500/2 p-3 rounded-2xl border border-green-500/10">
                  {optimization.optimizedTransactions.length === 0 ? (
                    <span className="text-xs text-slate-400 text-center py-4">No outstanding balances.</span>
                  ) : (
                    optimization.optimizedTransactions.map((tx, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs text-slate-700 dark:text-slate-300 font-semibold">
                        <span>{tx.fromUser?.name} &rarr; {tx.toUser?.name}</span>
                        <span className="font-extrabold text-green-500">₹{tx.amount}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-900">
              <button
                onClick={() => setShowOptimizeModal(false)}
                className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmOptimize}
                className="px-4 py-2 rounded-xl text-white bg-green-500 hover:bg-green-600 text-xs font-semibold shadow-md shadow-green-500/10"
              >
                Confirm Optimization
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECORD MANUAL PAYMENT MODAL */}
      {showSettleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md glass-card border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 md:p-8 rounded-3xl shadow-2xl relative flex flex-col gap-5 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Record a Payment</h2>
              <button
                onClick={() => {
                  setShowSettleModal(false);
                  setSettleRecipient('');
                  setSettleAmount('');
                }}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSettleSubmit} className="flex flex-col gap-5 text-left">
              {/* Selected Member Details */}
              {(() => {
                const selectedMember = group?.members.find(m => m._id === settleRecipient);
                if (!selectedMember) return null;

                // Find debt relations
                const oweTx = optimization?.originalTransactions?.find(
                  tx => tx.fromUser?._id === user?._id && tx.toUser?._id === settleRecipient
                );
                const owedTx = optimization?.originalTransactions?.find(
                  tx => tx.toUser?._id === user?._id && tx.fromUser?._id === settleRecipient
                );

                const oweAmount = oweTx ? oweTx.amount : 0;
                const owedAmount = owedTx ? owedTx.amount : 0;

                let debtText = "Settled";
                let debtStyle = "text-slate-400 font-extrabold";

                if (oweAmount > 0) {
                  debtText = `You owe ${selectedMember.name} ₹${oweAmount}`;
                  debtStyle = "text-red-500 font-extrabold";
                } else if (owedAmount > 0) {
                  debtText = `${selectedMember.name} owes you ₹${owedAmount}`;
                  debtStyle = "text-green-500 font-extrabold";
                }

                return (
                  <div className="flex flex-col gap-5">
                    {/* Selected Member Header Card */}
                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 rounded-2xl">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold uppercase text-sm">
                        {selectedMember.avatar ? (
                          <img src={selectedMember.avatar} alt={selectedMember.name} className="w-full h-full object-cover rounded-xl" />
                        ) : (
                          selectedMember.name[0]
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          {selectedMember.name}
                        </span>
                        <span className="text-xs text-slate-450 dark:text-slate-400">
                          {selectedMember.email}
                        </span>
                      </div>
                    </div>

                    {/* Current Debt Card */}
                    <div className="flex flex-col gap-1 p-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 rounded-2xl">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-455">Current Balance:</span>
                      <span className={`text-sm ${debtStyle}`}>{debtText}</span>
                    </div>

                    {/* Settlement Options */}
                    <div className="flex flex-col gap-4">
                      {/* 1. Full Settle Up */}
                      {(oweAmount > 0 || owedAmount > 0) ? (
                        <div className="flex flex-col gap-2">
                          <span className="text-xs font-semibold text-slate-500">1. Full Settle Up</span>
                          <button
                            type="button"
                            onClick={() => {
                              const fullAmt = oweAmount > 0 ? oweAmount : owedAmount;
                              setSettleAmount(fullAmt.toString());
                              toast.success(`Pre-filled full settlement amount: ₹${fullAmt}`);
                            }}
                            className="w-full py-2.5 px-4 text-xs font-bold bg-green-500 hover:bg-green-600 text-white rounded-xl shadow-md shadow-green-500/10 transition-all text-center"
                          >
                            Full Settle ₹{oweAmount > 0 ? oweAmount : owedAmount}
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 italic">No outstanding debt. Use custom settlement below to prepay/record custom amounts.</div>
                      )}

                      {/* 2. Custom Settlement */}
                      <div className="flex flex-col gap-2">
                        <span className="text-xs font-semibold text-slate-500">2. Custom Settlement</span>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-slate-655 dark:text-slate-400">Amount (₹):</label>
                          <input
                            type="number"
                            step="0.01"
                            value={settleAmount}
                            onChange={(e) => setSettleAmount(e.target.value)}
                            placeholder="Enter amount"
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/15"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Action Buttons: Record and Cancel */}
              <div className="flex flex-col gap-2.5 mt-2">
                <button
                  type="submit"
                  disabled={isLoggingSettlement || !settleRecipient}
                  className="w-full bg-green-500 hover:bg-green-600 disabled:bg-slate-200 dark:disabled:bg-slate-800/80 disabled:text-slate-400 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-green-500/10 flex items-center justify-center gap-2 transition-all"
                >
                  {isLoggingSettlement ? 'Recording...' : 'Record Payment'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSettleModal(false);
                    setSettleRecipient('');
                    setSettleAmount('');
                  }}
                  className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 text-slate-600 dark:text-slate-300 font-semibold py-2.5 rounded-xl text-center text-xs transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD EXPENSE MODAL */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xl glass-card border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 md:p-8 rounded-3xl shadow-2xl relative flex flex-col gap-5 max-h-[90vh] overflow-y-auto no-scrollbar animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Add an Expense</h2>
              <button
                onClick={() => setShowExpenseModal(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddExpenseSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Description */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Description</label>
                  <input
                    type="text"
                    value={expDescription}
                    onChange={(e) => setExpDescription(e.target.value)}
                    placeholder="e.g. Pizza, Uber cab"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/15"
                    required
                  />
                </div>

                {/* Amount */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/15"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Category */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Category</label>
                  <select
                    value={expCategory}
                    onChange={(e) => setExpCategory(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/15"
                  >
                    {['Food', 'Travel', 'Rent', 'Shopping', 'Entertainment', 'Utilities', 'Healthcare', 'Education', 'Others'].map(c => (
                      <option key={c} value={c} className="text-slate-800 dark:text-slate-200">{c}</option>
                    ))}
                  </select>
                </div>

                {/* Split Type */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Split Method</label>
                  <select
                    value={expSplitType}
                    onChange={(e) => setExpSplitType(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/15"
                  >
                    <option value="equal" className="text-slate-800 dark:text-slate-200">Equally (₹ split)</option>
                    <option value="percentage" className="text-slate-800 dark:text-slate-200">By Percentages (%)</option>
                    <option value="exact" className="text-slate-800 dark:text-slate-200">By Exact Amounts (₹)</option>
                    <option value="shares" className="text-slate-800 dark:text-slate-200">By Shares</option>
                  </select>
                </div>
              </div>

              {/* Split Members List */}
              <div className="flex flex-col gap-2 mt-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Split Among Members:</span>
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto no-scrollbar bg-slate-50 dark:bg-slate-900/30 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/40">
                  {expSplitAmong.map((p) => {
                    const isChecked = p.checked;
                    const calculatedShare = calculatedShares[p.user] || 0;
                    
                    return (
                      <div key={p.user} className="flex justify-between items-center gap-3 text-xs py-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => handleSplitParticipantChange(p.user, 'checked', e.target.checked)}
                            className="w-4 h-4 rounded text-green-500 focus:ring-green-500/10"
                          />
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{p.name}</span>
                        </div>

                        {isChecked && (
                          <div className="flex items-center gap-2">
                            {expSplitType !== 'equal' && (
                              <input
                                type="number"
                                step="any"
                                value={p.share}
                                onChange={(e) => handleSplitParticipantChange(p.user, 'share', e.target.value)}
                                placeholder={expSplitType === 'percentage' ? '%' : expSplitType === 'exact' ? '₹' : 'shares'}
                                className="w-16 px-2 py-1 text-center rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                              />
                            )}
                            <span className="font-extrabold text-slate-700 dark:text-slate-300 min-w-[50px] text-right">
                              ₹{calculatedShare}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={isAddingExpense}
                className="w-full bg-green-500 hover:bg-green-600 disabled:bg-green-500/50 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-green-500/10 flex items-center justify-center gap-2 transition-all mt-2"
              >
                {isAddingExpense ? 'Saving...' : 'Save Expense'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupDetails;
