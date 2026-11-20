import { useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts'
import api from '../../lib/api.js'
import useApi from '../../hooks/useApi.js'
import Notice from '../../components/Notice.jsx'
import { LoadingNotice, ErrorNotice, EmptyNotice } from '../../components/NoticeStates.jsx'

const fetchSubjects = () => api.get('/api/student/subjects').then((r) => r.data.data)

const axisTick = { fontFamily: 'Oswald', fontSize: 11, fill: '#6d6152', letterSpacing: '0.12em' }
const tooltipStyle = {
  fontFamily: 'Inter', fontSize: 13, borderRadius: 4,
  border: '1px solid #e8dfcc', background: '#fdfcf8', color: '#26221c',
}

export default function StudentTrend() {
  const subjects = useApi(fetchSubjects, [])
  const [subjectId, setSubjectId] = useState('')
  const [refresh, setRefresh] = useState(0)

  const chosen = subjectId || (subjects.data ?? [])[0]?._id || ''
  const fetchTrend = () => chosen
    ? api.get(`/api/student/subjects/${chosen}/trend`).then((r) => r.data.data)
    : Promise.resolve(null)
  const trend = useApi(fetchTrend, [chosen, refresh])

  const data = (trend.data?.trend ?? []).map((t) => ({
    name: t.name,
    date: new Date(t.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    percentage: t.percentage,
    score: t.score,
    maxMarks: t.maxMarks,
  }))

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <div className="xl:col-span-4">
        <Notice pin="blue" tilt={-0.6}>
          <div className="cap mb-4">PICK A SUBJECT TO PLOT</div>
          {subjects.loading && <p className="text-sm text-ink-soft">Loading subjects…</p>}
          {!subjects.loading && (subjects.data ?? []).length === 0 && (
            <p className="text-sm text-ink-soft">You are not enrolled in any subject yet.</p>
          )}
          <ul className="space-y-2">
            {(subjects.data ?? []).map((row) => (
              <li key={row.subject._id}>
                <button
                  onClick={() => { setSubjectId(row.subject._id); setRefresh((n) => n + 1) }}
                  className={`w-full rounded-sm border px-3 py-2.5 text-left text-sm transition-colors ${
                    chosen === row.subject._id ? 'border-ink bg-ink text-paper' : 'border-paper-edge bg-paper hover:bg-paper-rule/60'
                  }`}
                >
                  <span className="font-semibold">{row.subject.name}</span> · {row.subject.code}
                  <span className="num block text-xs opacity-75">
                    {row.examCount} exam{row.examCount === 1 ? '' : 's'}
                    {row.percentage !== null ? ` · current ${row.percentage.toFixed(1)}%` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Notice>
      </div>

      <div className="xl:col-span-8">
        {!chosen
          ? <EmptyNotice title="NO SUBJECT SELECTED" hint="Choose a subject to see your score trend." tilt={0.4} />
          : trend.error ? <ErrorNotice message={trend.error} onRetry={trend.reload} />
          : trend.loading || !trend.data ? <LoadingNotice label="TREND SHEET" tilt={0.4} />
          : (
            <Notice pin="green" tilt={0.4} settleKey={`${chosen}-${data.map((p) => p.percentage).join()}`}>
              <div className="cap mb-1">SCORE TREND · {trend.data.subject.name.toUpperCase()} · {trend.data.subject.code}</div>
              <p className="mb-4 text-[13px] text-ink-soft">Percentage per exam, chronological · pass mark 40%</p>
              {data.length === 0
                ? <p className="py-10 text-center text-sm text-ink-soft">No marks in this subject yet - your line starts with the first exam.</p>
                : (
                  <div className="h-[320px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={data} margin={{ top: 12, right: 16, left: -8, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="4 4" stroke="#eee6d4" vertical={false} />
                        <XAxis dataKey="name" tick={axisTick} axisLine={{ stroke: '#e8dfcc' }} tickLine={false} />
                        <YAxis
                          domain={[0, 100]}
                          tick={axisTick}
                          axisLine={false}
                          tickLine={false}
                          unit="%"
                        />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          formatter={(value, key) => [
                            key === 'percentage' ? `${value}%` : value,
                            key === 'percentage' ? 'Score' : key,
                          ]}
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
                          dataKey="percentage"
                          stroke="#26221c"
                          strokeWidth={3}
                          dot={{ r: 6, fill: '#3e7a4e', stroke: '#fdfcf8', strokeWidth: 2 }}
                          activeDot={{ r: 8, fill: '#26221c' }}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              <div className="sheet-scroll">
                <table className="sheet-table mt-2">
                <thead><tr><th>EXAM</th><th>DATE</th><th>SCORE</th><th>MAX</th><th>%</th></tr></thead>
                <tbody>
                  {data.map((t, i) => (
                    <tr key={i}>
                      <td className="font-semibold">{t.name}</td>
                      <td>{t.date}</td>
                      <td>{t.score}</td>
                      <td>{t.maxMarks}</td>
                      <td className="font-bold">{t.percentage.toFixed(2)}%</td>
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
