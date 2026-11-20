import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import BoardShell from './components/BoardShell.jsx'
import Login from './pages/Login.jsx'

import AdminBoard from './pages/admin/AdminBoard.jsx'
import AdminSubjects from './pages/admin/AdminSubjects.jsx'
import AdminTeachers from './pages/admin/AdminTeachers.jsx'
import AdminStudents from './pages/admin/AdminStudents.jsx'
import AdminExams from './pages/admin/AdminExams.jsx'

import TeacherSubjects from './pages/teacher/TeacherSubjects.jsx'
import TeacherExams from './pages/teacher/TeacherExams.jsx'
import MarksEntry from './pages/teacher/MarksEntry.jsx'
import ExamResults from './pages/teacher/ExamResults.jsx'

import StudentSubjects from './pages/student/StudentSubjects.jsx'
import StudentPerformance from './pages/student/StudentPerformance.jsx'
import StudentTrend from './pages/student/StudentTrend.jsx'
import StudentProfile from './pages/shared/StudentProfile.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Navigate to="/login" replace />} />

      <Route element={<ProtectedRoute roles={['admin']} />}>
        <Route path="/admin" element={<BoardShell />}>
          <Route index element={<AdminBoard />} />
          <Route path="subjects" element={<AdminSubjects />} />
          <Route path="teachers" element={<AdminTeachers />} />
          <Route path="students" element={<AdminStudents />} />
          <Route path="students/:id" element={<StudentProfile role="admin" />} />
          <Route path="exams" element={<AdminExams />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['teacher']} />}>
        <Route path="/teacher" element={<BoardShell />}>
          <Route index element={<TeacherSubjects />} />
          <Route path="exams" element={<TeacherExams />} />
          <Route path="exams/entry" element={<MarksEntry />} />
          <Route path="results" element={<ExamResults />} />
          <Route path="students/:id" element={<StudentProfile role="teacher" />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute roles={['student']} />}>
        <Route path="/student" element={<BoardShell />}>
          <Route index element={<StudentSubjects />} />
          <Route path="performance" element={<StudentPerformance />} />
          <Route path="trend" element={<StudentTrend />} />
        </Route>
      </Route>
    </Routes>
  )
}
