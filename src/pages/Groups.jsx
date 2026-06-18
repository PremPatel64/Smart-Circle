import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Plus, Users, Search, Trash2, ArrowRight, ShieldCheck, Heart, Info, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const Groups = () => {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchGroups = async () => {
    try {
      const { data } = await api.get('/groups');
      if (data.success) {
        setGroups(data.data);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  // Search users for group creation
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (memberSearch.trim().length > 1) {
        try {
          const { data } = await api.get(`/auth/users?search=${memberSearch}`);
          if (data.success) {
            setSearchResults(data.data);
          }
        } catch (error) {
          console.error(error);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [memberSearch]);

  const handleSelectMember = (u) => {
    if (!selectedMembers.some(m => m._id === u._id)) {
      setSelectedMembers([...selectedMembers, u]);
    }
    setMemberSearch('');
    setSearchResults([]);
  };

  const handleRemoveSelected = (id) => {
    setSelectedMembers(selectedMembers.filter(m => m._id !== id));
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName) return toast.error('Group name is required');

    setIsSubmitting(true);
    try {
      const memberIds = selectedMembers.map(m => m._id);
      const { data } = await api.post('/groups', {
        groupName,
        description,
        members: memberIds
      });

      if (data.success) {
        toast.success(`Group "${groupName}" created successfully!`);
        setShowCreateModal(false);
        setGroupName('');
        setDescription('');
        setSelectedMembers([]);
        fetchGroups();
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Failed to create group');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGroup = async (e, groupId, name) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!window.confirm(`Are you sure you want to delete group "${name}"? This deletes all associated expenses.`)) {
      return;
    }

    try {
      const { data } = await api.delete(`/groups/${groupId}`);
      if (data.success) {
        toast.success(`Group "${name}" deleted.`);
        fetchGroups();
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Failed to delete group');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const filteredGroups = groups.filter(g =>
    g.groupName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getHealthColor = (score) => {
    if (score >= 90) return 'text-green-500 bg-green-500/10 border-green-500/20';
    if (score >= 70) return 'text-sky-500 bg-sky-500/10 border-sky-500/20';
    if (score >= 50) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100">My Expense Groups</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Create or join groups to split house bills, travel costs, or office lunches.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-green-500 hover:bg-green-600 rounded-xl transition-all shadow-md shadow-green-500/10"
        >
          <Plus className="w-4 h-4" />
          <span>New Group</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
          <Search className="w-4 h-4" />
        </span>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter groups by name..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition-all shadow-sm"
        />
      </div>

      {/* Groups Grid */}
      {filteredGroups.length === 0 ? (
        <div className="glass-card p-12 text-center flex flex-col items-center justify-center gap-4 border border-slate-200 dark:border-slate-800/80">
          <Users className="w-12 h-12 text-slate-400" />
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">No Groups Found</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
            {searchTerm ? 'No groups match your search filter.' : 'Get started by creating a group for your apartment, trip, or lunches!'}
          </p>
          {!searchTerm && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-green-500 text-white font-semibold rounded-lg text-sm"
            >
              Create Group
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGroups.map((group) => (
            <Link
              key={group._id}
              to={`/groups/${group._id}`}
              className="glass-card border border-slate-200/80 dark:border-slate-800/80 p-5 flex flex-col justify-between gap-5 hover:scale-[1.02] active:scale-[0.98] transition-all group cursor-pointer"
            >
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 group-hover:text-green-500 transition-colors">
                    {group.groupName}
                  </h3>
                  {group.createdBy?._id === user?._id && (
                    <button
                      onClick={(e) => handleDeleteGroup(e, group._id, group.groupName)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 dark:hover:bg-rose-950/20"
                      title="Delete Group"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 h-8">
                  {group.description || 'No description provided.'}
                </p>
              </div>

              {/* Group stats indicators */}
              <div className="flex flex-wrap gap-2 items-center text-xs">
                <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <Users className="w-3.5 h-3.5" />
                  <span>{group.members?.length || 0} Members</span>
                </span>
                <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <Info className="w-3.5 h-3.5" />
                  <span>{group.expensesCount || 0} Expenses</span>
                </span>
                <span className={`flex items-center gap-1 px-2 py-1 rounded-lg border ${getHealthColor(group.healthScore)}`}>
                  <Heart className="w-3.5 h-3.5 fill-current" />
                  <span>Health: {group.healthScore}% ({group.healthLabel})</span>
                </span>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800/40">
                <span className="text-[10px] text-slate-400">Created {new Date(group.createdAt).toLocaleDateString()}</span>
                <span className="text-xs text-green-500 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  <span>View Details</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* CREATE GROUP MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg glass-card border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 md:p-8 rounded-3xl shadow-2xl relative flex flex-col gap-5 max-h-[90vh] overflow-y-auto no-scrollbar animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Create New Group</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="flex flex-col gap-4">
              {/* Group Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Group Name</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Goa Trip, Flat Expenses"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/15"
                  required
                />
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Description (Optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short description of splits..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/15 h-20 resize-none"
                />
              </div>

              {/* Add Members section */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Add Members</label>
                
                {/* Selected Members Chips */}
                {selectedMembers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800/40">
                    {selectedMembers.map(m => (
                      <span key={m._id} className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg bg-green-500/10 dark:bg-green-500/5 text-green-600 dark:text-green-400 text-xs font-semibold border border-green-500/20">
                        <span>{m.name}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSelected(m._id)}
                          className="p-0.5 rounded-full hover:bg-green-500 hover:text-white"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Member Search input */}
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search users by name or email..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/15"
                  />

                  {/* Search results dropdown */}
                  {searchResults.length > 0 && (
                    <div className="absolute left-0 right-0 mt-1.5 rounded-xl glass border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden z-25 max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/40">
                      {searchResults.map(u => (
                        <button
                          key={u._id}
                          type="button"
                          onClick={() => handleSelectMember(u)}
                          className="w-full text-left p-3 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors flex items-center justify-between text-xs"
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{u.name}</span>
                            <span className="text-slate-400">{u.email}</span>
                          </div>
                          <Plus className="w-4 h-4 text-green-500" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-green-500 hover:bg-green-600 disabled:bg-green-500/50 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-green-500/10 flex items-center justify-center gap-2 transition-all mt-4"
              >
                {isSubmitting ? 'Creating...' : 'Create Group'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Groups;
