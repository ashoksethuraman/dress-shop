import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../store/hooks';

type Props = { children: React.ReactElement };

export default function AdminRoute({ children }: Props) {
  const user = useAppSelector((s) => s.user.user);
  if (!user) return <Navigate to="/auth" replace />;
  if (!user.isAdmin) return <Navigate to="/" replace />;
  return children;
}
