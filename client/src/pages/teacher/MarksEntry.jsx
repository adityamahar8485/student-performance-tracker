import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../../lib/api.js'
import useApi from '../../hooks/useApi.js'
import Notice from '../../components/Notice.jsx'
import GradeBadge, { PassFail } from '../../components/GradeBadge.jsx'
import { LoadingNotice, ErrorNotice, EmptyNotice } from '../../components/NoticeStates.jsx'

const fetchExams = () => api.get('/api/teacher/exams').then((r) => r.data.data)
const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

export default function MarksEntry() {
  const [searchParams, setSearchParams] = useSearchParams()
  const examId = searchParams.get('exam') ?? ''
  const [refresh, setRefresh] = useState(0)
  const exams = useApi(fetchExams, [refresh])

  const fetchResults = useMemo(
    () => () => examId
      ? api.get(`/api/teacher/exams/${examId}/results`).then((r) => r.data.data)
      : Promise.resolve(null),
    [examId]
  )
  const results = useApi(fetchResults, [examId, refresh])

  const [scores, setScores] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  const exam = exams.data?.find((e) => e._id === examId)
  const locked = results.data?.exam?.isLocked
  const rows = results.data?.results ?? []

  const setScore = (studentId, value) =>
    setScores((s) => ({ ...s, [studentId]: value }))

  const save = async () => {
    setBusy(true); setError(''); setOk('')
    // Blank rows stay blank - never coerced to 0
    const marks = rows
      .map((r) => {
        const raw = scores[r.student._id] ?? r.score ?? ''
        const score = String(raw).trim() === '' ? null : Number(raw)
        return { student: r.student._id, score }
      })
      .filter((m) => m.score !== null && Number.isFinite(m.score) && m.score >= 0)
    try {
      const res = await api.post(`/api/teacher/exams/${examId}/marks`, { marks })
      setOk(`Pinned ${res.data.data.processed} marks (${res.data.data.created} new, ${res.data.data.updated} corrected)`)
      setScores({})
      setRefresh((n) => n + 1)
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save marks')
    } finally {
      setBusy(false)
    }
  }

  const openExams = (exams.data ?? []).filter((e) => !e.isLocked)

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <div className="xl:col-span-4">
        <Notice pin="blue" tilt={-0.6}>
          <div className="cap mb-4">CHOOSE AN EXAM TO MARK</div>
          {exams.loading && <p className="text-sm text-ink-soft">Loading exams…</p>}
          {!exams.loading && openExams.length === 0 && (
            <p className="text-sm text-ink-soft">No open exams - every exam is locked or none exist yet.</p>
          )}
          <ul className="space-y-2">
            {openExams.map((e) => (
              <li key={e._id}>
                <button
                  onClick={() => { setSearchParams({ exam: e._id }); setScores({}); setOk(''); setError('') }}
                  className={`w-full rounded-sm border px-3 py-2.5 text-left text-sm transition-colors ${
                    examId === e._id
                      ? 'border-ink bg-ink text-paper'
                      : 'border-paper-edge bg-paper hover:bg-paper-rule/60'
                  }`}
                >
                  <span className="font-semibold">{e.name}</span> · {e.subject?.code}
                  <span className="num block text-xs opacity-75">
                    {fmtDate(e.date)} · max {e.maxMarks}
                    {e.lockRequested ? ' · lock requested' : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {locked && (
            <p className="mt-4 border-t border-paper-rule pt-3 text-[13px] font-semibold text-pin-red-text">
              This exam is locked - ask the admin to unlock before editing.
            </p>
          )}
        </Notice>
      </div>

      <div className="xl:col-span-8">
        {!examId
          ? <EmptyNotice title="NO EXAM SELECTED" hint="Pick an exam on the left; every enrolled student appears in its marks sheet." tilt={0.4} />
          : results.error ? <ErrorNotice message={results.error} onRetry={results.reload} />
          : results.loading || !results.data ? <LoadingNotice label="MARKS SHEET" tilt={0.4} />
          : (
            <Notice pin={locked ? 'red' : 'green'} tilt={0.4}
              settleKey={`${examId}-${rows.map((r) => r.score).join()}`}>
              <div className="cap mb-1">MARKS SHEET · {results.data.exam.name} · {results.data.exam.subject?.code}</div>
              <p className="num mb-4 text-[13px] text-ink-soft">
                Max {results.data.exam.maxMarks} per entry · pass at 40% · {locked ? 'LOCKED - read only' : 'editable'}
              </p>
              {rows.length === 0
                ? <p className="text-sm text-ink-soft">No students are enrolled in this subject yet.</p>
                : (
                  <>
                    <div className="sheet-scroll">
              <table className="sheet-table">
                      <thead><tr><th>STUDENT</th><th>SCORE</th><th>%</th><th>GRADE</th><th>RESULT</th></tr></thead>
                      <tbody>
                        {rows.map((r) => {
                          // Live preview: an edited-but-unsaved score shows its
                          // would-be percentage in gold; saved values stay server-computed
                          const raw = scores[r.student._id]
                          const edited = raw !== undefined && String(raw).trim() !== '' &&
                            Number.isFinite(Number(raw)) && Number(raw) !== r.score
                          const previewPct = edited
                            ? (Number(raw) / results.data.exam.maxMarks) * 100
                            : null
                          return (
                          <tr key={r.student._id}>
                            <td className="font-semibold">{r.student.name}
                              <span className="block text-xs font-normal text-ink-soft">{r.student.email}</span></td>
                            <td className="text-left">
                              <input
                                type="number"
                                min="0"
                                max={results.data.exam.maxMarks}
                                disabled={locked}
                                value={scores[r.student._id] ?? r.score ?? ''}
                                onChange={(e) => setScore(r.student._id, e.target.value)}
                                aria-label={`Score for ${r.student.name}`}
                                className="field num !w-24 !py-1.5 text-right"
                              />
                            </td>
                            <td>
                              {previewPct !== null ? (
                                <span className="font-semibold text-pin-gold-text" title="Unsaved preview — calculated on save">
                                  {previewPct.toFixed(2)} ·
                                </span>
                              ) : (
                                r.percentage !== null && r.percentage !== undefined ? r.percentage.toFixed(2) : '-'
                              )}
                            </td>
                            <td className="text-left"><GradeBadge grade={r.grade} /></td>
                            <td className="text-left"><PassFail isPass={r.score === null || r.score === undefined ? null : r.isPass} /></td>
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
            </div>
                    {!locked && (
                      <div className="mt-4 flex items-center gap-3">
                        <button className="btn" onClick={save} disabled={busy}>
                          {busy ? 'Pinning…' : 'Save all marks'}
                        </button>
                        <span className="text-[13px] text-ink-soft">Saving upserts - existing entries are corrected, new ones added. Blank fields are skipped, not cleared. Gold percentages are unsaved previews; grades finalize on save.</span>
                      </div>
                    )}
                  </>
                )}
              {error && <p className="mt-3 text-sm font-medium text-pin-red-text">{error}</p>}
              {ok && (
                <p className="mt-3 flex flex-wrap items-center gap-2 text-sm font-medium text-pin-green-text">
                  {ok}
                  <Link className="tlink" to={`/teacher/results?exam=${examId}`}>View results →</Link>
                </p>
              )}
            </Notice>
          )}
      </div>
    </div>
  )
}
