import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { userApi } from '../services/apiClient';
import { authService } from '../services/authService';
import { logout } from '../store/userSlice';

type Props = { children: React.ReactElement };

export default function AdminRoute({ children }: Props) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.user.user);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionValid, setSessionValid] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!user || !user.isAdmin) {
      setCheckingSession(false);
      setSessionValid(false);
      return;
    }

    setCheckingSession(true);
    userApi.getProfile()
      .then((profile) => {
        if (cancelled) return;
        const isAdmin = profile.role === 'admin' || profile.isAdmin === true;
        setSessionValid(isAdmin);
      })
      .catch(() => {
        if (cancelled) return;
        // Session cookie is missing/expired/invalid — clear stale local auth state.
        authService.signOut();
        dispatch(logout());
        setSessionValid(false);
      })
      .finally(() => {
        if (!cancelled) setCheckingSession(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dispatch, user]);

  if (!user) return <Navigate to="/auth" replace />;
  if (!user.isAdmin) return <Navigate to="/" replace />;
  if (checkingSession) return null;
  if (!sessionValid) return <Navigate to="/auth" replace />;
  return children;
}
