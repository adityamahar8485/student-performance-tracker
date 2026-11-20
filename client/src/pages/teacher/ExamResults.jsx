import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../../lib/api.js'
import useApi from '../../hooks/useApi.js'
import Notice from '../../components/Notice.jsx'
import GradeBadge, { PassFail } from '../../components/GradeBadge.jsx'
import { LoadingNotice, ErrorNotice, EmptyNotice } from '../../components/NoticeStates.jsx'

const fetchExams = () => api.get('/api/teacher/exams').then((r) => r.data.data)
const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export default function ExamResults() {
  const [searchParams, setSearchParams] = useSearchParams()
  const examId = searchParams.get('exam') ?? ''
  const exams = useApi(fetchExams, [])

  const fetchResults = useMemo(
    () => () => examId
      ? api.get(`/api/teacher/exams/${examId}/results`).then((r) => r.data.data)
      : Promise.resolve(null),
    [examId]
  )
  const results = useApi(fetchResults, [examId])

  const [sort, setSort] = useState({ key: 'score', dir: 'desc' })
  const toggleSort = (key) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }))

  const rows = [...(results.data?.results ?? [])].sort((a, b) => {
    const dir = sort.dir === 'desc' ? -1 : 1
    const av = sort.key === 'name' ? a.student.name : (a.score ?? -1)
    const bv = sort.key === 'name' ? b.student.name : (b.score ?? -1)
    if (typeof av === 'string') return av.localeCompare(bv) * dir
    return (av - bv) * dir
  })

  const exam = exams.data?.find((e) => e._id === examId)
  const marked = (results.data?.results ?? []).filter((r) => r.score !== null && r.score !== undefined)
  const avg = marked.length
    ? (marked.reduce((s, r) => s + r.percentage, 0) / marked.length).toFixed(2)
    : null

  const SortTh = ({ k, children }) => (
    <th>
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-ink"
        aria-label={`Sort by ${children}`}>
        {children}
        <span aria-hidden="true">{sort.key === k ? (sort.dir === 'desc' ? '▾' : '▴') : '·'}</span>
      </button>
    </th>
  )

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <div className="xl:col-span-4">
        <Notice pin="blue" tilt={-0.6}>
          <div className="cap mb-4">CHOOSE AN EXAM</div>
          {exams.loading && <p className="text-sm text-ink-soft">Loading exams…</p>}
          <ul className="space-y-2">
            {(exams.data ?? []).map((e) => (
              <li key={e._id}>
                <button
                  onClick={() => setSearchParams({ exam: e._id })}
                  className={`w-full rounded-sm border px-3 py-2.5 text-left text-sm transition-colors ${
                    examId === e._id ? 'border-ink bg-ink text-paper' : 'border-paper-edge bg-paper hover:bg-paper-rule/60'
                  }`}
                >
                  <span className="font-semibold">{e.name}</span> · {e.subject?.code}
                  <span className="num block text-xs opacity-75">
                    {fmtDate(e.date)} · max {e.maxMarks}
                    {e.isLocked ? ' · LOCKED' : ''}
                  </span>
                </button>
              </li>
            ))}
            {!exams.loading && (exams.data ?? []).length === 0 && (
              <p className="text-sm text-ink-soft">No exams yet - create one from the EXAMS tab.</p>
            )}
          </ul>
        </Notice>
      </div>

      <div className="xl:col-span-8">
        {!examId
          ? <EmptyNotice title="NO EXAM SELECTED" hint="Pick an exam to see its full marks table." tilt={0.4} />
          : results.error ? <ErrorNotice message={results.error} onRetry={results.reload} />
          : results.loading || !results.data ? <LoadingNotice label="RESULTS SHEET" tilt={0.4} />
          : (
            <Notice pin={results.data.exam.isLocked ? 'red' : 'green'} tilt={0.4} settleKey={examId}>
              <div className="cap mb-1">RESULTS · {results.data.exam.name} · {fmtDate(results.data.exam.date)}</div>
              <p className="num mb-4 text-[13px] text-ink-soft">
                {marked.length} marked · {avg !== null ? `mean of entries ${avg}%` : 'no marks yet'}
                {results.data.exam.isLocked ? ' · locked, final' : ''}
              </p>
              <div className="sheet-scroll">
              <table className="sheet-table">
                <thead>
                  <tr>
                    <SortTh k="name">STUDENT</SortTh>
                    <th>SCORE</th>
                    <th>%</th>
                    <th>GRADE</th>
                    <th>RESULT</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.student._id}>
                      <td className="font-semibold">{r.student.name}
                        <span className="block text-xs font-normal text-ink-soft">{r.student.email}</span></td>
                      <td className="font-bold">{r.score ?? '-'}<span className="font-normal text-ink-soft"> / {results.data.exam.maxMarks}</span></td>
                      <td>{r.percentage !== null && r.percentage !== undefined ? r.percentage.toFixed(2) : '-'}</td>
                      <td className="text-left"><GradeBadge grade={r.grade} /></td>
                      <td className="text-left"><PassFail isPass={r.score === null || r.score === undefined ? null : r.isPass} /></td>
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
