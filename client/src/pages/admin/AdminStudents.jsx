import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api.js'
import useApi from '../../hooks/useApi.js'
import Notice from '../../components/Notice.jsx'
import Field from '../../components/Field.jsx'
import { LoadingNotice, ErrorNotice, EmptyNotice } from '../../components/NoticeStates.jsx'

const fetchStudents = () => api.get('/api/admin/students').then((r) => r.data.data)
const fetchSubjects = () => api.get('/api/admin/subjects').then((r) => r.data.data)

export default function AdminStudents() {
  const [refresh, setRefresh] = useState(0)
  const students = useApi(fetchStudents, [refresh])
  const subjects = useApi(fetchSubjects, [refresh])
  const [form, setForm] = useState({ name: '', email: '', password: '', batch: '2026', subjects: [] })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  const toggleSubject = (id) =>
    setForm((f) => ({
      ...f,
      subjects: f.subjects.includes(id) ? f.subjects.filter((s) => s !== id) : [...f.subjects, id],
    }))

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError(''); setOk('')
    try {
      const res = await api.post('/api/admin/students', form)
      setOk(`${res.data.data.student.name} enrolled in ${res.data.data.enrolledSubjects} subject(s)`)
      setForm({ name: '', email: '', password: '', batch: form.batch, subjects: [] })
      setRefresh((n) => n + 1)
    } catch (err) {
      setError(err.response?.data?.message || 'Could not register the student')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <div className="xl:col-span-5">
        <Notice pin="blue" tilt={-0.6}>
          <div className="cap mb-4">REGISTER A STUDENT · ENROL IN SUBJECTS</div>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Name" id="s-name">
              <input id="s-name" className="field" required value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Aarav" />
            </Field>
            <Field label="Email" id="s-email">
              <input id="s-email" className="field" type="email" required value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="aarav@student.dev" />
            </Field>
            <Field label="Password" id="s-pass" hint="Minimum 6 characters">
              <input id="s-pass" className="field" type="text" required minLength={6} value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Student@1" />
            </Field>
            <Field label="Batch" id="s-batch" hint="Ranking is computed within the batch">
              <input id="s-batch" className="field" required value={form.batch}
                onChange={(e) => setForm({ ...form, batch: e.target.value })} placeholder="2026" />
            </Field>
            <fieldset>
              <legend className="mb-1.5 text-[13px] font-semibold">Enroll in subjects</legend>
              <div className="space-y-1.5">
                {(subjects.data ?? []).map((s) => (
                  <label key={s._id} className="flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 hover:bg-paper-rule/60">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#26221c]"
                      checked={form.subjects.includes(s._id)}
                      onChange={() => toggleSubject(s._id)}
                    />
                    <span className="text-sm">{s.name} · {s.code}</span>
                  </label>
                ))}
                {!subjects.loading && (subjects.data ?? []).length === 0 && (
                  <p className="text-[13px] text-ink-soft">No subjects yet - create subjects first.</p>
                )}
              </div>
            </fieldset>
            {error && <p className="text-sm font-medium text-pin-red-text">{error}</p>}
            {ok && <p className="text-sm font-medium text-pin-green-text">{ok}</p>}
            <button className="btn" disabled={busy}>{busy ? 'Registering…' : 'Register student'}</button>
          </form>
        </Notice>
      </div>

      <div className="xl:col-span-7">
        {students.loading ? <LoadingNotice label="ENROLLMENT LEDGER" tilt={0.4} />
          : students.error ? <ErrorNotice message={students.error} onRetry={students.reload} />
          : students.data.length === 0 ? <EmptyNotice title="NO STUDENTS" hint="Register students and enroll them in subjects." tilt={0.4} />
          : (
            <Notice pin="green" tilt={0.4} settleKey={students.data.length}>
              <div className="cap mb-4">ENROLLMENT LEDGER · {students.data.length}</div>
              <div className="sheet-scroll">
              <table className="sheet-table">
                <thead><tr><th>STUDENT</th><th>BATCH</th><th>ENROLLED</th></tr></thead>
                <tbody>
                  {students.data.map((s) => (
                    <tr key={s._id}>
                      <td className="font-semibold">{s.name}<span className="block text-xs font-normal text-ink-soft">{s.email}</span></td>
                      <td>{s.batch ?? '-'}</td>
                      <td className="text-left">
                        {s.subjects.length === 0
                          ? <span className="text-ink-soft">none</span>
                          : s.subjects.map((sub, i) => (
                              <span key={i}>{sub.code}{i < s.subjects.length - 1 ? ', ' : ''}</span>
                            ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Link to="/admin/exams" className="tlink mt-4 inline-block border-t border-paper-rule pt-3">
              Exam register →
            </Link>
            </Notice>
          )}
      </div>
    </div>
  )
}
