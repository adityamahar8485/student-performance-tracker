import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts'
import api from '../../lib/api.js'
import useApi from '../../hooks/useApi.js'
import Notice from '../../components/Notice.jsx'
import StatNotice from '../../components/StatNotice.jsx'
import GradeBadge from '../../components/GradeBadge.jsx'
import { LoadingNotice, ErrorNotice } from '../../components/NoticeStates.jsx'

const axisTick = { fontFamily: 'Oswald', fontSize: 11, fill: '#6d6152', letterSpacing: '0.12em' }
const tooltipStyle = {
  fontFamily: 'Inter', fontSize: 13, borderRadius: 4,
  border: '1px solid #e8dfcc', background: '#fdfcf8', color: '#26221c',
}
const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

/**
 * Shared student-profile view — admin reaches it for any student
 * (/admin/students/:id), teacher only for students in their own subjects
 * (/teacher/students/:id; the API enforces the ownership rule).
 */
export default function StudentProfile({ role }) {
  const { id } = useParams()
  const profile = useApi(
    () => api.get(`/api/${role}/students/${id}/performance`).then((r) => r.data.data),
    [id, role]
  )
  const [subjectId, setSubjectId] = useState('')

  if (profile.loading) return <div className="xl:col-span-6"><LoadingNotice label="STUDENT RECORD" tilt={-0.5} /></div>
  if (profile.error) return <div className="xl:col-span-6"><ErrorNotice message={profile.error} onRetry={profile.reload} /></div>

  const d = profile.data
  const backTo = role === 'admin' ? { to: '/admin/students', label: 'All students' } : { to: '/teacher/results', label: 'Results' }

  const chosen = d.perSubject.find((p) => p.subject._id === subjectId) ?? d.perSubject.find((p) => p.exams.length > 0) ?? d.perSubject[0]
  const chartData = (chosen?.exams ?? []).map((e) => ({
    name: e.name,
    date: fmtDate(e.date),
    percentage: e.percentage,
  }))

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-12">
      {/* Record card */}
      <div className="xl:col-span-4">
        <Notice pin="blue" tilt={-0.6}>
          <div className="cap mb-3">STUDENT RECORD</div>
          <div className="text-[22px] font-bold leading-tight">{d.student.name}</div>
          <p className="mt-1 text-[13px] text-ink-soft">{d.student.email}</p>
          <p className="num mt-1 text-[13px] text-ink-soft">
            Batch {d.student.batch ?? '—'} · {d.totalScore ?? 0} / {d.totalMax ?? 0} marks
          </p>
          <div className="mt-3 flex items-center gap-3 border-t border-paper-rule pt-3">
            <span className="text-[13px] text-ink-soft">Overall grade</span>
            <span className="ml-auto"><GradeBadge grade={d.overallGrade} size="lg" /></span>
          </div>
          <Link to={backTo.to} className="tlink mt-3 inline-block border-t border-paper-rule pt-3">
            ← {backTo.label}
          </Link>
        </Notice>
      </div>

      <div className="xl:col-span-4">
        <StatNotice
          pin={d.cumulativePercentage === null ? 'blue' : d.cumulativePercentage < 40 ? 'red' : 'green'}
          tilt={0.5}
          settleKey={`cum-${d.cumulativePercentage}`}
          label="CUMULATIVE · ALL SUBJECTS"
          value={d.cumulativePercentage === null ? '—' : d.cumulativePercentage.toFixed(2)}
          unit={d.cumulativePercentage === null ? '' : '%'}
          sub={d.totalMax ? `${d.totalScore} / ${d.totalMax} marks across every exam` : 'No marks recorded yet'}
        />
      </div>

      <div className="xl:col-span-4">
        <StatNotice
          pin="gold"
          tilt={-0.4}
          settleKey={`rank-${d.rank}-${d.cohortSize}`}
          label="RANK · WITHIN BATCH"
          value={d.rank ?? '—'}
          sub={d.rank ? `of ${d.cohortSize} marked students in batch ${d.student.batch ?? '—'}` : 'Unranked until marks exist'}
        />
      </div>

      {/* Trend chart for a chosen subject */}
      {chartData.length > 0 && (
        <div className="xl:col-span-12">
          <Notice pin="green" tilt={0.3} settleKey={`${chosen.subject._id}-${chartData.map((p) => p.percentage).join()}`}>
            <div className="cap mb-1">TREND SHEET · {chosen.subject.name.toUpperCase()} · {chosen.subject.code}</div>
            <p className="mb-3 text-[13px] text-ink-soft">Percentage per exam, chronological · pass mark 40%</p>
            <div className="mb-3 flex flex-wrap gap-2">
              {d.perSubject.filter((p) => p.exams.length > 0).map((p) => (
                <button
                  key={p.subject._id}
                  onClick={() => setSubjectId(p.subject._id)}
                  className={`rounded-sm border px-3 py-1.5 text-left text-xs transition-colors ${
                    chosen.subject._id === p.subject._id ? 'border-ink bg-ink text-paper' : 'border-paper-edge bg-paper hover:bg-paper-rule/60'
                  }`}
                >
                  <span className="font-semibold">{p.subject.code}</span>
                  <span className="num ml-2 opacity-75">{p.percentage?.toFixed(1)}%</span>
                </button>
              ))}
            </div>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#eee6d4" vertical={false} />
                  <XAxis dataKey="name" tick={axisTick} axisLine={{ stroke: '#e8dfcc' }} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={axisTick} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, 'Score']}
                    labelFormatter={(label, payload) => payload?.[0] ? `${label} · ${payload[0].payload.date}` : label} />
                  <ReferenceLine y={40} stroke="#b3452e" strokeDasharray="6 3"
                    label={{ value: 'PASS 40%', position: 'insideBottomRight', fontFamily: 'Oswald', fontSize: 10, fill: '#9c3823', letterSpacing: '0.14em' }} />
                  <Line type="monotone" dataKey="percentage" stroke="#26221c" strokeWidth={3}
                    dot={{ r: 6, fill: '#3e7a4e', stroke: '#fdfcf8', strokeWidth: 2 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Notice>
        </div>
      )}

      {/* Per-subject marks */}
      {d.perSubject.map((p, i) => (
        <div key={p.subject._id} className="xl:col-span-6">
          <Notice pin={p.percentage === null ? 'blue' : p.percentage < 40 ? 'red' : 'green'} tilt={i % 2 ? 0.4 : -0.4}>
            <div className="mb-1 flex items-center gap-3">
              <div className="cap">{p.subject.code} · {p.subject.name.toUpperCase()}</div>
              <span className="ml-auto flex items-center gap-2">
                <span className="num font-bold">{p.percentage === null ? '—' : `${p.percentage.toFixed(2)}%`}</span>
                <GradeBadge grade={p.grade} />
              </span>
            </div>
            <p className="num mb-3 text-[13px] text-ink-soft">
              {p.totalScore} / {p.totalMax} scored · {p.examCount} exam{p.examCount === 1 ? '' : 's'}
            </p>
            {p.exams.length === 0 ? (
              <p className="text-sm text-ink-soft">No marks in this subject yet.</p>
            ) : (
              <div className="sheet-scroll">
                <table className="sheet-table">
                  <thead><tr><th>EXAM</th><th>DATE</th><th>SCORE</th><th>%</th><th>GRADE</th><th>RESULT</th></tr></thead>
                  <tbody>
                    {p.exams.map((e, k) => (
                      <tr key={k}>
                        <td className="font-semibold">{e.name}{e.isLocked && <span className="ml-2 text-xs font-semibold text-pin-red-text">LOCKED</span>}</td>
                        <td>{fmtDate(e.date)}</td>
                        <td className="font-bold">{e.score}<span className="font-normal text-ink-soft"> / {e.maxMarks}</span></td>
                        <td>{e.percentage.toFixed(2)}</td>
                        <td className="text-left"><GradeBadge grade={e.grade} /></td>
                        <td className={`text-left font-semibold ${e.isPass ? 'text-pin-green-text' : 'text-pin-red-text'}`}>
                          {e.isPass ? 'PASS' : 'FAIL'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr><td>Subject total</td><td></td><td>{p.totalScore} / {p.totalMax}</td><td>{p.percentage?.toFixed(2)}</td><td className="text-left"><GradeBadge grade={p.grade} /></td><td></td></tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Notice>
        </div>
      ))}
    </div>
  )
}
