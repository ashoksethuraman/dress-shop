import React, { useEffect, useState } from 'react';
import {
  FiUser, FiMail, FiPhone, FiCalendar, FiMapPin, FiShield, FiAlertCircle,
} from 'react-icons/fi';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../store/hooks';
import { userApi, type UserProfile } from '../services/apiClient';

function FieldRow({
  icon, label, value, placeholder,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
        <span className="text-gray-400 flex-shrink-0">{icon}</span>
        <span className={`text-sm flex-1 ${value ? 'text-gray-800' : 'text-gray-400 italic'}`}>
          {value || placeholder || '—'}
        </span>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const user = useAppSelector((s) => s.user.user);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.isGuest) return;
    setLoading(true);
    userApi
      .getProfile()
      .then((data) => setProfile(data))
      .catch((err) => setError(err?.message ?? 'Failed to load profile.'))
      .finally(() => setLoading(false));
  }, [user]);

  // Guest or unauthenticated — redirect to auth
  if (!user) return <Navigate to="/auth" replace />;
  if (user.isGuest) return <Navigate to="/auth" replace />;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <p className="text-sm text-gray-500">Loading profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <FiAlertCircle size={40} className="text-red-400" />
          <p className="text-gray-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // Derive isAdmin from role — single source of truth
  const isAdmin = profile?.role === 'admin';

  const genderLabel =
    profile?.gender === 'male' ? 'Male' :
    profile?.gender === 'female' ? 'Female' :
    '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand via-white to-brand-bg flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        {/* <div className="flex justify-center mb-2">
          {isAdmin ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-brand-dark bg-brand border border-brand-border rounded-full px-3 py-1">
              <FiShield size={12} /> Admin
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-semibold text-gray-500 bg-gray-100 border border-gray-200 rounded-full px-3 py-1">
              <FiUser size={12} /> User
            </span>
          )}
        </div> */}

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 flex flex-col gap-5">
          <FieldRow
            icon={<FiUser size={16} />}
            label="Username"
            value={profile?.username ?? profile?.name ?? ''}
            placeholder="Not set"
          />
          <FieldRow
            icon={<FiMail size={16} />}
            label="Email"
            value={profile?.email ?? ''}
            placeholder="Not set"
          />
          <div className="grid grid-cols-2 gap-4">
            <FieldRow
              icon={<FiCalendar size={16} />}
              label="Age"
              value={profile?.age != null ? String(profile.age) : ''}
              placeholder="Not set"
            />
            <FieldRow
              icon={<FiUser size={16} />}
              label="Gender"
              value={genderLabel}
              placeholder="Not set"
            />
          </div>
          <FieldRow
            icon={<FiPhone size={16} />}
            label="Mobile Number"
            value={profile?.mobileNumber ?? ''}
            placeholder="Not set"
          />
          <FieldRow
            icon={<FiMapPin size={16} />}
            label="Address"
            value={profile?.address ?? ''}
            placeholder="Not set"
          />
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-400 mt-5">
          To update your information, please contact support.
        </p>
      </div>
    </div>
  );
}
