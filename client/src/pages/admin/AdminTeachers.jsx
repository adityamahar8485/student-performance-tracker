import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api.js'
import useApi from '../../hooks/useApi.js'
import Notice from '../../components/Notice.jsx'
import Field from '../../components/Field.jsx'
import { LoadingNotice, ErrorNotice, EmptyNotice } from '../../components/NoticeStates.jsx'

const fetchTeachers = () => api.get('/api/admin/teachers').then((r) => r.data.data)
const fetchSubjects = () => api.get('/api/admin/subjects').then((r) => r.data.data)

export default function AdminTeachers() {
  const [refresh, setRefresh] = useState(0)
  const teachers = useApi(fetchTeachers, [refresh])
  const subjects = useApi(fetchSubjects, [refresh])
  const [form, setForm] = useState({ name: '', email: '', password: '', subject: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  const unassigned = (subjects.data ?? []).filter((s) => !s.teacher)
  const assignable = (subjects.data ?? [])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError(''); setOk('')
    try {
      await api.post('/api/admin/teachers', form)
      setOk(`${form.name} registered and assigned`)
      setForm({ name: '', email: '', password: '', subject: '' })
      setRefresh((n) => n + 1)
    } catch (err) {
      setError(err.response?.data?.message || 'Could not register the teacher')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <div className="xl:col-span-5">
        <Notice pin="blue" tilt={-0.6}>
          <div className="cap mb-4">REGISTER A TEACHER · ASSIGN A SUBJECT</div>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Name" id="t-name">
              <input id="t-name" className="field" required value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Riya Sharma" />
            </Field>
            <Field label="Email" id="t-email">
              <input id="t-email" className="field" type="email" required value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="riya@school.dev" />
            </Field>
            <Field label="Password" id="t-pass" hint="Minimum 6 characters - share it with the teacher">
              <input id="t-pass" className="field" type="text" required minLength={6} value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Teacher@1" />
            </Field>
            <Field label="Subject" id="t-subject"
              hint={unassigned.length > 0 ? `${unassigned.length} subject(s) currently unassigned` : undefined}>
              <select id="t-subject" className="field" required value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}>
                <option value="">Choose a subject…</option>
                {assignable.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} · {s.code}{s.teacher ? ` (held by ${s.teacher.name})` : ''}
                  </option>
                ))}
              </select>
            </Field>
            {error && <p className="text-sm font-medium text-pin-red-text">{error}</p>}
            {ok && <p className="text-sm font-medium text-pin-green-text">{ok}</p>}
            <button className="btn" disabled={busy || subjects.loading}>{busy ? 'Registering…' : 'Register teacher'}</button>
          </form>
        </Notice>
      </div>

      <div className="xl:col-span-7">
        {teachers.loading ? <LoadingNotice label="STAFF RECORDS" tilt={0.4} />
          : teachers.error ? <ErrorNotice message={teachers.error} onRetry={teachers.reload} />
          : teachers.data.length === 0 ? <EmptyNotice title="NO TEACHERS" hint="Register the first teacher to staff a subject." tilt={0.4} />
          : (
            <Notice pin="gold" tilt={0.4} settleKey={teachers.data.length}>
              <div className="cap mb-4">STAFF RECORDS · {teachers.data.length}</div>
              <div className="sheet-scroll">
              <table className="sheet-table">
                <thead><tr><th>TEACHER</th><th>SUBJECTS HELD</th><th>RECORD</th></tr></thead>
                <tbody>
                  {teachers.data.map((t) => (
                    <tr key={t._id}>
                      <td className="font-semibold">{t.name}<span className="block text-xs font-normal text-ink-soft">{t.email}</span></td>
                      <td className="text-left">
                        {t.subjects.length === 0
                          ? <span className="text-ink-soft">none yet</span>
                          : t.subjects.map((s) => (
                              <span key={s.id} className="mr-2 inline-block border border-paper-edge bg-paper-rule px-2 py-0.5 text-xs font-semibold">
                                {s.code}
                              </span>
                            ))}
                      </td>
                      <td className="text-left"><Link className="tlink" to={`/admin/teachers/${t._id}`}>View →</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Link to="/admin/students" className="tlink mt-4 inline-block border-t border-paper-rule pt-3">
              Enroll students →
            </Link>
            </Notice>
          )}
      </div>
    </div>
  )
}
