import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Award, User, Mail, Calendar, Key, ShieldCheck, Upload, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const Profile = () => {
  const { user, updateProfile, changePassword, uploadAvatar } = useAuth();
  
  // Edit Profile Form State
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Change Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Upload Avatar State
  const [isUploading, setIsUploading] = useState(false);

  const handleUpdateProfileSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email) return toast.error('Name and email are required');

    setIsUpdatingProfile(true);
    try {
      const data = await updateProfile(name, email);
      if (data.success) {
        toast.success('Profile updated successfully!');
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      return toast.error('All password fields are required');
    }

    if (newPassword.length < 6) {
      return toast.error('New password must be at least 6 characters');
    }

    if (newPassword !== confirmPassword) {
      return toast.error('New passwords do not match');
    }

    setIsChangingPassword(true);
    try {
      const data = await changePassword(currentPassword, newPassword);
      if (data.success) {
        toast.success('Password updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Size check (2MB limit)
    if (file.size > 2 * 1024 * 1024) {
      return toast.error('File size cannot exceed 2MB');
    }

    setIsUploading(true);
    try {
      const data = await uploadAvatar(file);
      if (data.success) {
        toast.success('Avatar photo updated successfully!');
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Failed to upload image file');
    } finally {
      setIsUploading(false);
    }
  };

  const rel = user?.reliability;

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800/40 pb-5">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100">My Profile Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Customize your credentials and upload profile pictures.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column: Avatar & Reliability Card */}
        <div className="flex flex-col gap-6">
          {/* Avatar frame */}
          <div className="glass-card p-6 border border-slate-200 dark:border-slate-800/80 flex flex-col items-center gap-4 text-center">
            <div className="relative group cursor-pointer w-24 h-24 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-400 font-bold uppercase text-2xl">
              {user?.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                user?.name ? user.name[0] : 'U'
              )}

              {/* Upload Overlay */}
              <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold cursor-pointer transition-opacity">
                {isUploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Upload className="w-5 h-5" />
                )}
                <input
                  type="file"
                  onChange={handleAvatarChange}
                  accept="image/*"
                  className="hidden"
                  disabled={isUploading}
                />
              </label>
            </div>

            <div className="flex flex-col gap-0.5">
              <h3 className="font-bold text-slate-855 dark:text-slate-100">{user?.name}</h3>
              <span className="text-xs text-slate-400">{user?.email}</span>
            </div>

            <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-2">
              <Calendar className="w-3.5 h-3.5" />
              <span>Joined {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</span>
            </span>
          </div>

          {/* Reliability Score Widget */}
          {rel && (
            <div className="glass-card p-5 border border-slate-200 dark:border-slate-800/80 flex flex-col gap-4 text-left">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-green-500" />
                <span>My Payer Reliability</span>
              </h3>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-black text-slate-800 dark:text-slate-100">
                    {rel.score}/100
                  </span>
                  <span className="text-xs font-bold text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                    {rel.label}
                  </span>
                </div>

                <div className="flex flex-col gap-2 mt-2 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span>Completed Settlements:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{rel.completedCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pending Settlements:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{rel.pendingCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Settlement Speed:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{rel.averageSettlementTimeDays} days</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column (2 cols): Form inputs */}
        <div className="md:col-span-2 flex flex-col gap-6">
          {/* Edit Profile */}
          <form onSubmit={handleUpdateProfileSubmit} className="glass-card p-5 md:p-6 border border-slate-200 dark:border-slate-800/80 rounded-3xl flex flex-col gap-4">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800/40 pb-2.5">
              <User className="w-4 h-4 text-slate-400" />
              <span>Update Profile Info</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-green-500"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-green-500"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isUpdatingProfile}
              className="bg-green-500 hover:bg-green-600 disabled:bg-green-500/50 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-2 self-end px-6 shadow-md shadow-green-500/10 mt-2"
            >
              {isUpdatingProfile ? 'Updating...' : 'Save Profile'}
            </button>
          </form>

          {/* Change Password */}
          <form onSubmit={handleChangePasswordSubmit} className="glass-card p-5 md:p-6 border border-slate-200 dark:border-slate-800/80 rounded-3xl flex flex-col gap-4">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800/40 pb-2.5">
              <Key className="w-4 h-4 text-slate-400" />
              <span>Change Password</span>
            </h3>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-green-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-green-500"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:border-green-500"
                    required
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isChangingPassword}
              className="bg-green-500 hover:bg-green-600 disabled:bg-green-500/50 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-2 self-end px-6 shadow-md shadow-green-500/10 mt-2"
            >
              {isChangingPassword ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

export default Profile;
