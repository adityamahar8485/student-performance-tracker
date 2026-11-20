import { useState } from 'react'
import api from '../../lib/api.js'
import useApi from '../../hooks/useApi.js'
import Notice from '../../components/Notice.jsx'
import Field from '../../components/Field.jsx'
import { LoadingNotice, ErrorNotice, EmptyNotice } from '../../components/NoticeStates.jsx'

const fetchSubjects = () => api.get('/api/admin/subjects').then((r) => r.data.data)

export default function AdminSubjects() {
  const [refresh, setRefresh] = useState(0)
  const list = useApi(fetchSubjects, [refresh])
  const [form, setForm] = useState({ name: '', code: '', totalMarks: 100 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError(''); setOk('')
    try {
      await api.post('/api/admin/subjects', form)
      setOk(`${form.code} pinned to the board`)
      setForm({ name: '', code: '', totalMarks: 100 })
      setRefresh((n) => n + 1)
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create the subject')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <div className="xl:col-span-5">
        <Notice pin="blue" tilt={-0.6}>
          <div className="cap mb-4">PIN A NEW SUBJECT</div>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Subject name" id="sub-name">
              <input id="sub-name" className="field" required value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mathematics" />
            </Field>
            <Field label="Code" id="sub-code" hint="Unique, e.g. MATH101">
              <input id="sub-code" className="field" required value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="MATH101" />
            </Field>
            <Field label="Total marks" id="sub-marks">
              <input id="sub-marks" className="field num" type="number" min="1" required value={form.totalMarks}
                onChange={(e) => setForm({ ...form, totalMarks: Number(e.target.value) })} />
            </Field>
            {error && <p className="text-sm font-medium text-pin-red-text">{error}</p>}
            {ok && <p className="text-sm font-medium text-pin-green-text">{ok}</p>}
            <button className="btn" disabled={busy}>{busy ? 'Pinning…' : 'Create subject'}</button>
          </form>
        </Notice>
      </div>

      <div className="xl:col-span-7">
        {list.loading ? <LoadingNotice label="SUBJECT LEDGER" tilt={0.4} />
          : list.error ? <ErrorNotice message={list.error} onRetry={list.reload} />
          : list.data.length === 0 ? <EmptyNotice title="NO SUBJECTS" hint="Create the first subject to start the term." tilt={0.4} />
          : (
            <Notice pin="green" tilt={0.4} settleKey={list.data.length}>
              <div className="cap mb-4">SUBJECT LEDGER · {list.data.length}</div>
              <div className="sheet-scroll">
              <table className="sheet-table">
                <thead><tr><th>SUBJECT</th><th>TOTAL MARKS</th><th>TEACHER</th><th>ENROLLED</th></tr></thead>
                <tbody>
                  {list.data.map((s) => (
                    <tr key={s._id}>
                      <td className="font-semibold">{s.name} · {s.code}</td>
                      <td>{s.totalMarks}</td>
                      <td className="text-left">{s.teacher ? s.teacher.name : <span className="text-ink-soft">unassigned</span>}</td>
                      <td>{s.studentCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </Notice>
          )}
      </div>
    </div>
  )
}
