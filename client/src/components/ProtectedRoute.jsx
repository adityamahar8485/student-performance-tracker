import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

// Role-gated route layout - client mirror of the server's protect/authorize chain
export default function ProtectedRoute({ roles }) {
  const { user } = useAuth()

  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={`/${user.role}`} replace />
  }
  return <Outlet />
}
