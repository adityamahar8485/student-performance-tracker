import { useState } from 'react'
import api from '../../lib/api.js'
import useApi from '../../hooks/useApi.js'
import Notice from '../../components/Notice.jsx'
import Field from '../../components/Field.jsx'
import { LoadingNotice, ErrorNotice, EmptyNotice } from '../../components/NoticeStates.jsx'

const fetchSubjects = () => api.get('/api/teacher/subjects').then((r) => r.data.data)
const fetchExams = () => api.get('/api/teacher/exams').then((r) => r.data.data)
const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

export default function TeacherExams() {
  const [refresh, setRefresh] = useState(0)
  const subjects = useApi(fetchSubjects, [refresh])
  const exams = useApi(fetchExams, [refresh])
  const [form, setForm] = useState({ subject: '', name: '', date: '', maxMarks: 50 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [requesting, setRequesting] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError(''); setOk('')
    try {
      await api.post('/api/teacher/exams', form)
      setOk(`${form.name} pinned - enter marks next`)
      setForm({ subject: '', name: '', date: '', maxMarks: 50 })
      setRefresh((n) => n + 1)
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create the exam')
    } finally {
      setBusy(false)
    }
  }

  const requestLock = async (exam) => {
    setRequesting(exam._id); setError('')
    try {
      await api.patch(`/api/teacher/exams/${exam._id}/request-lock`)
      setOk(`Lock requested for ${exam.name} - the admin will finalise it`)
      setRefresh((n) => n + 1)
    } catch (err) {
      setError(err.response?.data?.message || 'Could not request the lock')
    } finally {
      setRequesting(null)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <div className="xl:col-span-5">
        <Notice pin="blue" tilt={-0.6}>
          <div className="cap mb-4">SET A NEW EXAM · YOUR SUBJECTS ONLY</div>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Subject" id="e-subject">
              <select id="e-subject" className="field" required value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}>
                <option value="">Choose a subject…</option>
                {(subjects.data ?? []).map((s) => (
                  <option key={s._id} value={s._id}>{s.name} · {s.code}</option>
                ))}
              </select>
            </Field>
            <Field label="Exam name" id="e-name">
              <input id="e-name" className="field" required value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Midterm" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Date" id="e-date">
                <input id="e-date" className="field" type="date" required value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </Field>
              <Field label="Max marks" id="e-max">
                <input id="e-max" className="field num" type="number" min="1" required value={form.maxMarks}
                  onChange={(e) => setForm({ ...form, maxMarks: Number(e.target.value) })} />
              </Field>
            </div>
            {error && <p className="text-sm font-medium text-pin-red-text">{error}</p>}
            {ok && <p className="text-sm font-medium text-pin-green-text">{ok}</p>}
            <button className="btn" disabled={busy || subjects.loading}>{busy ? 'Pinning…' : 'Create exam'}</button>
          </form>
        </Notice>
      </div>

      <div className="xl:col-span-7">
        {exams.loading ? <LoadingNotice label="MY EXAMS" tilt={0.4} />
          : exams.error ? <ErrorNotice message={exams.error} onRetry={exams.reload} />
          : exams.data.length === 0 ? <EmptyNotice title="NO EXAMS YET" hint="Create an exam, then enter marks for your enrolled students." tilt={0.4} />
          : (
            <Notice pin="gold" tilt={0.4} settleKey={exams.data.map((e) => `${e._id}${e.isLocked}${e.lockRequested}`).join()}>
              <div className="cap mb-4">MY EXAMS · {exams.data.length}</div>
              <table className="sheet-table">
                <thead><tr><th>EXAM</th><th>DATE</th><th>MAX</th><th>STATUS</th><th>LOCK</th></tr></thead>
                <tbody>
                  {exams.data.map((e) => (
                    <tr key={e._id}>
                      <td className="font-semibold">{e.name}<span className="block text-xs font-normal text-ink-soft">{e.subject?.code}</span></td>
                      <td>{fmtDate(e.date)}</td>
                      <td>{e.maxMarks}</td>
                      <td className="text-left">
                        {e.isLocked
                          ? <span className="font-semibold text-pin-red-text">LOCKED - no edits</span>
                          : e.lockRequested
                            ? <span className="font-semibold text-pin-gold-text">Lock requested</span>
                            : <span className="text-ink-soft">open</span>}
                      </td>
                      <td className="text-left">
                        {e.isLocked ? <span className="text-ink-soft">final</span>
                          : e.lockRequested ? <span className="text-ink-soft">awaiting admin</span>
                          : <button className="btn btn-ghost !px-3 !py-1 text-xs" disabled={requesting === e._id} onClick={() => requestLock(e)}>
                              {requesting === e._id ? '…' : 'Request lock'}
                            </button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Notice>
          )}
      </div>
    </div>
  )
}
