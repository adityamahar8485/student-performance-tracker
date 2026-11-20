import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts'
import api from '../../lib/api.js'
import useApi from '../../hooks/useApi.js'
import Notice from '../../components/Notice.jsx'
import StatNotice from '../../components/StatNotice.jsx'
import { LoadingNotice, ErrorNotice, EmptyNotice } from '../../components/NoticeStates.jsx'

const axisTick = { fontFamily: 'Oswald', fontSize: 11, fill: '#6d6152', letterSpacing: '0.12em' }
const tooltipStyle = {
  fontFamily: 'Inter', fontSize: 13, borderRadius: 4,
  border: '1px solid #e8dfcc', background: '#fdfcf8', color: '#26221c',
}

const fetchAnalytics = () => api.get('/api/admin/analytics').then((r) => r.data.data)
const fetchExams = () => api.get('/api/admin/exams').then((r) => r.data.data)

export default function AdminBoard() {
  const [refresh, setRefresh] = useState(0)
  const analytics = useApi(fetchAnalytics, [refresh])
  const exams = useApi(fetchExams, [refresh])
  const [locking, setLocking] = useState(null)
  const [actionError, setActionError] = useState('')

  const bump = () => setRefresh((n) => n + 1)

  const approveLock = async (exam) => {
    setLocking(exam._id)
    setActionError('')
    try {
      await api.patch(`/api/admin/exams/${exam._id}/lock`, { isLocked: true })
      bump()
    } catch (err) {
      setActionError(err.response?.data?.message || 'Could not lock the exam')
    } finally {
      setLocking(null)
    }
  }

  const d = analytics.data
  const pending = (exams.data ?? []).filter((e) => e.lockRequested && !e.isLocked)
  const needsAttention = d?.lowestAvgSubject

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-12">
      {/* Subject averages - one stat notice each, live after every action */}
      {analytics.loading
        ? Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="xl:col-span-4"><LoadingNotice tilt={i ? 0.5 : -0.6} /></div>
          ))
        : analytics.error
          ? <div className="xl:col-span-5"><ErrorNotice message={analytics.error} onRetry={analytics.reload} /></div>
          : (d?.avgPerSubject.length
              ? d.avgPerSubject.map((row, i) => (
                  <div key={row.subject.id} className="xl:col-span-4">
                    <StatNotice
                      pin={needsAttention && row.subject.id === needsAttention.subject.id ? 'red' : 'green'}
                      tilt={i % 2 ? 0.5 : -0.6}
                      settleKey={`${row.subject.code}-${row.avgPercentage}`}
                      label={`SUBJECT AVERAGE · ${row.subject.code}`}
                      value={row.avgPercentage.toFixed(2)}
                      unit="%"
                      sub={`${row.totalScore} / ${row.totalMax} marks · ${row.entries} entries`}
                      danger={needsAttention && row.subject.id === needsAttention.subject.id}
                    >
                      {needsAttention && row.subject.id === needsAttention.subject.id && (
                        <span className="mb-3 inline-block bg-pin-red px-2.5 py-1 font-display text-[11px] font-semibold tracking-[0.16em] text-paper">
                          NEEDS ATTENTION
                        </span>
                      )}
                      <Link to="/admin/exams" className="tlink mt-3 inline-block border-t border-paper-rule pt-3">
                        Exam register →
                      </Link>
                    </StatNotice>
                  </div>
                ))
              : <div className="xl:col-span-4"><EmptyNotice title="NO MARKS PINNED" hint="Averages appear once teachers record marks." tilt={-0.6} /></div>
            )}

      {/* Pending lock requests - the admin's action notices */}
      {exams.error ? null : pending.length > 0 && pending.map((exam, i) => (
        <div key={exam._id} className="xl:col-span-4">
          <Notice pin="blue" tilt={i % 2 ? 0.4 : -0.4} settleKey={`pending-${exam._id}`}>
            <div className="cap mb-3">LOCK REQUESTED</div>
            <div className="text-[20px] font-bold">{exam.name} · {exam.subject?.name}</div>
            <p className="mt-1 text-[13px] text-ink-soft">
              Requested by {exam.createdBy?.name ?? 'the teacher'} · {exam.subject?.code}
            </p>
            <div className="mt-4 flex gap-2.5">
              <button className="btn" disabled={locking === exam._id} onClick={() => approveLock(exam)}>
                {locking === exam._id ? 'Locking…' : 'Approve lock'}
              </button>
              <Link className="btn btn-ghost" to="/admin/exams">Review all</Link>
            </div>
            {actionError && <p className="mt-2 text-[13px] font-medium text-pin-red-text">{actionError}</p>}
          </Notice>
        </div>
      ))}

      {/* Top performers */}
      {d && (
        <div className="xl:col-span-5">
          <Notice pin="gold" tilt={0.4} settleKey={d.topPerformers.map((t) => t.cumulativePercentage).join()}>
            <div className="cap mb-3">TOP PERFORMERS · CUMULATIVE</div>
            {d.topPerformers.length === 0 && <p className="text-sm text-ink-soft">No marks recorded yet.</p>}
            {d.topPerformers.map((t, i) => (
              <div key={t.student.id} className="flex items-baseline gap-3.5 border-b border-paper-rule py-2.5 last:border-0">
                <span className="font-display text-[15px] text-ink-soft">{i + 1}.</span>
                <span><b>{t.student.name}</b> <span className="text-ink-soft">· {t.student.email}</span></span>
                <span className="num ml-auto text-lg font-bold">{t.cumulativePercentage.toFixed(2)}%</span>
              </div>
            ))}
            <Link to="/admin/students" className="tlink mt-3 inline-block border-t border-paper-rule pt-3">
              All students →
            </Link>
          </Notice>
        </div>
      )}

      {/* Pinned trend sheet - institution mean per exam (contract: FIRST VIEWPORT) */}
      {d && d.examTrend?.length > 0 && (
        <div className="xl:col-span-7">
          <Notice pin="green" tilt={-0.3} settleKey={d.examTrend.map((t) => t.meanPercentage).join()}>
            <div className="cap mb-1">TREND SHEET · INSTITUTION MEAN PER EXAM</div>
            <p className="mb-4 text-[13px] text-ink-soft">Σscore / Σmax per exam, chronological · pass mark 40%</p>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={d.examTrend.map((t) => ({
                    name: t.name,
                    date: new Date(t.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
                    meanPercentage: t.meanPercentage,
                  }))}
                  margin={{ top: 12, right: 16, left: -8, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="4 4" stroke="#eee6d4" vertical={false} />
                  <XAxis dataKey="name" tick={axisTick} axisLine={{ stroke: '#e8dfcc' }} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={axisTick} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v) => [`${v}%`, 'Mean']}
                    labelFormatter={(label, payload) =>
                      payload?.[0] ? `${label} · ${payload[0].payload.date}` : label}
                  />
                  <ReferenceLine
                    y={40}
                    stroke="#b3452e"
                    strokeDasharray="6 3"
                    label={{ value: 'PASS 40%', position: 'insideBottomRight', fontFamily: 'Oswald', fontSize: 10, fill: '#9c3823', letterSpacing: '0.14em' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="meanPercentage"
                    stroke="#26221c"
                    strokeWidth={3}
                    dot={{ r: 6, fill: '#3e7a4e', stroke: '#fdfcf8', strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Notice>
        </div>
      )}

      {/* Pass / fail counts */}
      {d && d.passFailPerSubject.length > 0 && (
        <div className="xl:col-span-12">
          <Notice pin="green" tilt={-0.3} settleKey={d.passFailPerSubject.map((p) => p.passCount + p.failCount).join()}>
            <div className="cap mb-4">PASS / FAIL ENTRIES PER SUBJECT · PASS = 40% OF EXAM MAX</div>
          <div className="sheet-scroll">
            <table className="sheet-table">
              <thead>
                <tr><th>SUBJECT</th><th>ENTRIES</th><th>PASSING</th><th>FAILING</th></tr>
              </thead>
              <tbody>
                {d.passFailPerSubject.map((row) => (
                  <tr key={row.subject.id}>
                    <td className="font-semibold">{row.subject.name} · {row.subject.code}</td>
                    <td>{row.totalEntries}</td>
                    <td className="font-semibold text-pin-green-text">{row.passCount}</td>
                    <td className={row.failCount > 0 ? 'font-bold text-pin-red-text' : 'text-ink-soft'}>{row.failCount}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Institution total</td>
                  <td>{d.totals.marks}</td>
                  <td>{d.passFailPerSubject.reduce((s, r) => s + r.passCount, 0)}</td>
                  <td>{d.passFailPerSubject.reduce((s, r) => s + r.failCount, 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-3 text-[13px] text-ink-soft">
            Entries are individual exam marks (one student × one exam), not students — a student can pass one exam and fail another.
          </p>
          </Notice>
        </div>
      )}


    </div>
  )
}
