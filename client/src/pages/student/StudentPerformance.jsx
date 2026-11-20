import api from '../../lib/api.js'
import useApi from '../../hooks/useApi.js'
import Notice from '../../components/Notice.jsx'
import StatNotice from '../../components/StatNotice.jsx'
import GradeBadge from '../../components/GradeBadge.jsx'
import { LoadingNotice, ErrorNotice, EmptyNotice } from '../../components/NoticeStates.jsx'

const fetchPerformance = () => api.get('/api/student/performance').then((r) => r.data.data)

export default function StudentPerformance() {
  const perf = useApi(fetchPerformance, [])
  const d = perf.data

  const breakdown = d ? Object.entries(d.gradeBreakdown) : []

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-12">
      {perf.loading
        ? Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="xl:col-span-4"><LoadingNotice tilt={i % 2 ? 0.5 : -0.6} /></div>
          ))
        : perf.error
          ? <div className="xl:col-span-5"><ErrorNotice message={perf.error} onRetry={perf.reload} /></div>
          : d && (
            <>
              <div className="xl:col-span-4">
                <StatNotice
                  pin={d.cumulativePercentage === null ? 'blue' : d.cumulativePercentage < 40 ? 'red' : 'green'}
                  tilt={-0.6}
                  settleKey={`cum-${d.cumulativePercentage}`}
                  label="CUMULATIVE · ALL SUBJECTS"
                  value={d.cumulativePercentage === null ? '-' : d.cumulativePercentage.toFixed(2)}
                  unit={d.cumulativePercentage === null ? '' : '%'}
                  sub={d.totalMax ? `${d.totalScore} / ${d.totalMax} marks across every exam` : 'No marks recorded yet'}
                >
                  <div className="mt-3 flex items-center gap-2 border-t border-paper-rule pt-3">
                    <span className="text-[13px] text-ink-soft">Overall grade</span>
                    <span className="ml-auto flex items-center gap-2">
                      <GradeBadge grade={d.overallGrade} size="lg" />
                      <span className="text-[13px] text-ink-soft">pass mark 40%</span>
                    </span>
                  </div>
                </StatNotice>
              </div>

              <div className="xl:col-span-4">
                <StatNotice
                  pin="gold"
                  tilt={0.5}
                  settleKey={`rank-${d.rank}-${d.cohortSize}`}
                  label="RANK · WITHIN BATCH"
                  value={d.rank ?? '-'}
                  sub={d.rank ? `of ${d.cohortSize} marked student${d.cohortSize === 1 ? '' : 's'} in batch ${d.batch ?? '-'}` : 'Unranked until marks exist'}
                >
                  <p className="mt-3 border-t border-paper-rule pt-3 text-[13px] leading-relaxed text-ink-soft">
                    Computed server-side over every student's cumulative percentage in your batch.
                  </p>
                </StatNotice>
              </div>

              <div className="xl:col-span-4">
                <Notice pin="blue" tilt={-0.4} settleKey={breakdown.map(([, n]) => n).join()}>
                  <div className="cap mb-4">GRADE BREAKDOWN · EVERY EXAM ENTRY</div>
                  {d.totalMax === 0 || breakdown.every(([, n]) => n === 0)
                    ? <p className="text-sm text-ink-soft">No exam entries yet.</p>
                    : (
                      <ul className="space-y-2.5">
                        {breakdown.map(([grade, count]) => (
                          <li key={grade} className="flex items-center gap-3">
                            <GradeBadge grade={grade} />
                            <div className="h-2.5 flex-1 overflow-hidden rounded-sm bg-paper-rule">
                              <div
                                className={`h-full rounded-sm ${grade === 'F' ? 'bg-pin-red' : grade === 'A' || grade === 'B' ? 'bg-pin-green' : 'bg-pin-gold'}`}
                                style={{ width: `${(count / Math.max(1, ...breakdown.map(([, n]) => n))) * 100}%` }}
                              />
                            </div>
                            <span className="num w-6 text-right text-sm font-semibold">{count}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                </Notice>
              </div>

              {d.perSubject.length > 0 && (
                <div className="xl:col-span-12">
                  <Notice pin="green" tilt={0.3} settleKey={d.perSubject.map((p) => p.percentage).join()}>
                    <div className="cap mb-4">PER-SUBJECT STANDINGS</div>
                    <div className="sheet-scroll">
              <table className="sheet-table">
                      <thead><tr><th>SUBJECT</th><th>EXAMS</th><th>SCORED</th><th>AVAILABLE</th><th>%</th><th>GRADE</th></tr></thead>
                      <tbody>
                        {d.perSubject.map((p) => (
                          <tr key={p.subject._id}>
                            <td className="font-semibold">{p.subject.name} · {p.subject.code}</td>
                            <td>{p.examCount}</td>
                            <td>{p.totalScore}</td>
                            <td>{p.totalMax}</td>
                            <td className="font-bold">{p.percentage === null ? '-' : `${p.percentage.toFixed(2)}%`}</td>
                            <td className="text-left"><GradeBadge grade={p.grade} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
            </div>
                  </Notice>
                </div>
              )}
            </>
          )}
    </div>
  )
}
