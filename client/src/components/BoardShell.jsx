import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { INSTITUTION_NAME } from '../lib/constants.js'

const NAV = {
  admin: [
    { to: '/admin', label: 'BOARD', end: true },
    { to: '/admin/subjects', label: 'SUBJECTS' },
    { to: '/admin/teachers', label: 'TEACHERS' },
    { to: '/admin/students', label: 'STUDENTS' },
    { to: '/admin/exams', label: 'EXAMS' },
  ],
  teacher: [
    { to: '/teacher', label: 'MY SUBJECTS', end: true },
    { to: '/teacher/exams', label: 'EXAMS', end: true },
    { to: '/teacher/exams/entry', label: 'MARKS ENTRY' },
    { to: '/teacher/results', label: 'RESULTS' },
  ],
  student: [
    { to: '/student', label: 'MY SUBJECTS', end: true },
    { to: '/student/performance', label: 'PERFORMANCE' },
    { to: '/student/trend', label: 'SCORE TREND' },
  ],
}

/** Wood rail + clipped tag nav + cork wall. Standard navigation in the board's voice. */
export default function BoardShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const nav = NAV[user?.role] ?? []

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b-[6px] border-wood-edge bg-wood px-6 py-4 md:px-10">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <h1 className="font-display text-[26px] font-semibold tracking-[0.06em] text-paper">
            Student Performance Tracker
          </h1>
          <span className="text-[13px] font-medium capitalize text-wood-text">{user?.role}</span>
          <span className="ml-auto text-[13px] text-wood-text">
            {user?.name} · {INSTITUTION_NAME}
          </span>
          <button
            onClick={() => { logout(); navigate('/login') }}
            className="rounded-sm border border-wood-text/70 px-3 py-1 text-[13px] font-medium text-wood-text transition-colors hover:bg-wood-edge/50"
          >
            Logout
          </button>
        </div>
      </header>

      <nav className="flex flex-wrap gap-3.5 px-6 pt-4 md:px-10" aria-label="Board sections">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `tag ${isActive ? 'on' : ''}`}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <main className="flex-1 px-6 py-6 md:px-10 md:py-7">
        <Outlet />
      </main>
    </div>
  )
}
