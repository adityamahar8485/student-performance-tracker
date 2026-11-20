import { useParams, Link } from 'react-router-dom'
import api from '../../lib/api.js'
import useApi from '../../hooks/useApi.js'
import Notice from '../../components/Notice.jsx'
import StatNotice from '../../components/StatNotice.jsx'
import { LoadingNotice, ErrorNotice, EmptyNotice } from '../../components/NoticeStates.jsx'

const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/** Admin view of one teacher: record, per-subject performance, full exam register. */
export default function TeacherProfile() {
  const { id } = useParams()
  const profile = useApi(
    () => api.get(`/api/admin/teachers/${id}/profile`).then((r) => r.data.data),
    [id]
  )

  if (profile.loading) return <div className="xl:col-span-6"><LoadingNotice label="TEACHER RECORD" tilt={-0.5} /></div>
  if (profile.error) return <div className="xl:col-span-6"><ErrorNotice message={profile.error} onRetry={profile.reload} /></div>

  const d = profile.data
  const markedSubjects = d.subjects.filter((s) => s.entries > 0)
  const avgValues = markedSubjects.map((s) => s.avgPercentage)
  const meanAvg = avgValues.length
    ? Math.round((avgValues.reduce((a, b) => a + b, 0) / avgValues.length) * 100) / 100
    : null
  const totalPass = d.subjects.reduce((a, s) => a + s.passCount, 0)
  const totalFail = d.subjects.reduce((a, s) => a + s.failCount, 0)

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-12">
      {/* Record card */}
      <div className="xl:col-span-4">
        <Notice pin="blue" tilt={-0.6}>
          <div className="cap mb-3">TEACHER RECORD</div>
          <div className="text-[22px] font-bold leading-tight">{d.teacher.name}</div>
          <p className="mt-1 text-[13px] text-ink-soft">{d.teacher.email}</p>
          <p className="num mt-1 text-[13px] text-ink-soft">
            {d.totals.subjects} subject{d.totals.subjects === 1 ? '' : 's'} · {d.totals.exams} exam{d.totals.exams === 1 ? '' : 's'} set
          </p>
          {!d.teacher.isActive && (
            <span className="mt-3 inline-block bg-pin-red px-2.5 py-1 font-display text-[11px] font-semibold tracking-[0.16em] text-paper">
              DEACTIVATED
            </span>
          )}
          <Link to="/admin/teachers" className="tlink mt-3 inline-block border-t border-paper-rule pt-3">
            ← All teachers
          </Link>
        </Notice>
      </div>

      <div className="xl:col-span-4">
        <StatNotice
          pin={meanAvg === null ? 'blue' : 'green'}
          tilt={0.5}
          settleKey={`avg-${meanAvg}`}
          label="MEAN SUBJECT AVERAGE"
          value={meanAvg === null ? '—' : meanAvg.toFixed(2)}
          unit={meanAvg === null ? '' : '%'}
          sub={markedSubjects.length
            ? `across ${markedSubjects.length} marked subject${markedSubjects.length === 1 ? '' : 's'}`
            : 'No marks recorded in their subjects yet'}
        />
      </div>

      <div className="xl:col-span-4">
        <StatNotice
          pin={totalFail > 0 ? 'gold' : 'green'}
          tilt={-0.4}
          settleKey={`pf-${totalPass}-${totalFail}`}
          label="PASS / FAIL ENTRIES · THEIR SUBJECTS"
          value={totalFail > 0 ? `${totalPass} / ${totalFail}` : String(totalPass)}
          sub={`${totalPass} passing · ${totalFail} failing of ${d.totals.marks} exam entries · pass at 40% of exam max`}
        />
      </div>

      {/* Per-subject performance */}
      {d.subjects.map((s, i) => (
        <div key={s.subject.id} className="xl:col-span-4">
          <StatNotice
            pin={s.entries === 0 ? 'blue' : s.avgPercentage < 40 ? 'red' : 'green'}
            tilt={i % 2 ? 0.5 : -0.6}
            settleKey={`${s.subject.code}-${s.avgPercentage}`}
            label={`SUBJECT · ${s.subject.code}`}
            value={s.avgPercentage === null ? '—' : s.avgPercentage.toFixed(2)}
            unit={s.avgPercentage === null ? '' : '%'}
            sub={`${s.subject.name} · ${s.studentCount} students · ${s.examCount} exams`}
          >
            <div className="num mt-3 flex justify-between border-t border-paper-rule pt-3 text-[13px]">
              <span className="text-ink-soft">Pass / fail entries</span>
              <span>
                <span className="font-semibold text-pin-green-text">{s.passCount}</span>
                {' / '}
                <span className={s.failCount > 0 ? 'font-bold text-pin-red-text' : 'text-ink-soft'}>{s.failCount}</span>
              </span>
            </div>
          </StatNotice>
        </div>
      ))}

      {/* Exam register */}
      <div className="xl:col-span-12">
        {d.exams.length === 0 ? (
          <EmptyNotice title="NO EXAMS SET" hint="This teacher has not created any exams yet." tilt={0.4} />
        ) : (
          <Notice pin="gold" tilt={0.4} settleKey={d.exams.map((e) => `${e.id}${e.isLocked}${e.marksEntered}`).join()}>
            <div className="cap mb-4">EXAM REGISTER · {d.exams.length} EXAMS</div>
            <div className="sheet-scroll">
              <table className="sheet-table">
                <thead><tr><th>EXAM</th><th>SUBJECT</th><th>DATE</th><th>MAX</th><th>MARKS ENTERED</th><th>STATUS</th></tr></thead>
                <tbody>
                  {d.exams.map((e) => (
                    <tr key={e.id}>
                      <td className="font-semibold">{e.name}</td>
                      <td className="text-left">{e.subject ? `${e.subject.name} · ${e.subject.code}` : '—'}</td>
                      <td>{fmtDate(e.date)}</td>
                      <td>{e.maxMarks}</td>
                      <td className="font-bold">{e.marksEntered}</td>
                      <td className="text-left">
                        {e.isLocked
                          ? <span className="font-semibold text-pin-red-text">LOCKED</span>
                          : e.lockRequested
                            ? <span className="font-semibold text-pin-gold-text">LOCK REQUESTED</span>
                            : <span className="text-ink-soft">open{e.marksEntered === 0 ? ' · unmarked' : ''}</span>}
                      </td>
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
