import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api.js'
import useApi from '../../hooks/useApi.js'
import Notice from '../../components/Notice.jsx'
import SubjectCode from '../../components/SubjectCode.jsx'
import { LoadingNotice, ErrorNotice, EmptyNotice } from '../../components/NoticeStates.jsx'

const fetchExams = () => api.get('/api/admin/exams').then((r) => r.data.data)
const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

function StatusCell({ exam }) {
  if (exam.isLocked)
    return <span className="font-semibold text-pin-red-text">LOCKED {exam.lockedAt && `· ${fmtDate(exam.lockedAt)}`}</span>
  if (exam.lockRequested)
    return <span className="font-semibold text-pin-gold-text">LOCK REQUESTED</span>
  return <span className="text-ink-soft">open</span>
}

export default function AdminExams() {
  const [refresh, setRefresh] = useState(0)
  const list = useApi(fetchExams, [refresh])
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')

  const setLock = async (exam, isLocked) => {
    setBusy(exam._id); setError('')
    try {
      await api.patch(`/api/admin/exams/${exam._id}/lock`, { isLocked })
      setRefresh((n) => n + 1)
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update the exam')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <div className="xl:col-span-12">
        {list.loading ? <LoadingNotice label="EXAM LOCK REGISTER" tilt={-0.4} />
          : list.error ? <ErrorNotice message={list.error} onRetry={list.reload} />
          : list.data.length === 0 ? <EmptyNotice title="NO EXAMS" hint="Teachers create exams from their subjects; they appear here for locking." tilt={-0.4} />
          : (
            <Notice pin="red" tilt={-0.4} settleKey={list.data.map((e) => `${e._id}${e.isLocked}${e.lockRequested}`).join()}>
              <div className="cap mb-4">EXAM LOCK REGISTER · ONLY THE ADMIN LOCKS</div>
              <div className="sheet-scroll">
              <table className="sheet-table">
                <thead><tr><th>EXAM</th><th>SUBJECT</th><th>TEACHER</th><th>DATE</th><th>MAX</th><th>STATUS</th><th>ACTION</th></tr></thead>
                <tbody>
                  {list.data.map((e) => (
                    <tr key={e._id}>
                      <td className="font-semibold">{e.name}</td>
                      <td className="text-left">{e.subject?.name}<SubjectCode code={e.subject?.code} /></td>
                      <td className="text-left">{e.subject?.teacher?.name ?? '-'}</td>
                      <td>{fmtDate(e.date)}</td>
                      <td>{e.maxMarks}</td>
                      <td className="text-left"><StatusCell exam={e} /></td>
                      <td className="text-left">
                        {e.isLocked
                          ? <button className="btn btn-ghost !px-3 !py-1 text-xs" disabled={busy === e._id} onClick={() => setLock(e, false)}>Unlock</button>
                          : <button className="btn !px-3 !py-1 text-xs" disabled={busy === e._id} onClick={() => setLock(e, true)}>
                              {busy === e._id ? '…' : e.lockRequested ? 'Approve lock' : 'Lock'}
                            </button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Link to="/admin" className="tlink mt-4 inline-block border-t border-paper-rule pt-3">
              Board analytics →
            </Link>
              {error && <p className="mt-3 text-sm font-medium text-pin-red-text">{error}</p>}
              <p className="mt-3 text-[13px] text-ink-soft">Locked exams reject every marks write - teachers see entry and editing disabled.</p>
            </Notice>
          )}
      </div>
    </div>
  )
}
