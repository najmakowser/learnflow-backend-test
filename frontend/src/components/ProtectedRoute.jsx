import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, path }) {
  const { user, can, getDefaultRoute } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (path && !can(path)) {
    return <Navigate to={getDefaultRoute()} replace state={{ from: location }} />;
  }

  return children;
}
