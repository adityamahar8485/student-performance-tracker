import api from '../../lib/api.js'
import useApi from '../../hooks/useApi.js'
import Notice from '../../components/Notice.jsx'
import StatNotice from '../../components/StatNotice.jsx'
import { LoadingNotice, ErrorNotice, EmptyNotice } from '../../components/NoticeStates.jsx'

const fetchSubjects = () => api.get('/api/teacher/subjects').then((r) => r.data.data)
const fetchExams = () => api.get('/api/teacher/exams').then((r) => r.data.data)
const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

export default function TeacherSubjects() {
  const subjects = useApi(fetchSubjects, [])
  const exams = useApi(fetchExams, [])

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-12">
      {subjects.loading
        ? Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="xl:col-span-4"><LoadingNotice tilt={i ? 0.5 : -0.6} /></div>
          ))
        : subjects.error
          ? <div className="xl:col-span-5"><ErrorNotice message={subjects.error} onRetry={subjects.reload} /></div>
          : subjects.data.length === 0
            ? <div className="xl:col-span-6"><EmptyNotice title="NO SUBJECTS ASSIGNED" hint="The admin assigns subjects when registering you - ask them to pin one." tilt={-0.6} /></div>
            : subjects.data.map((s, i) => {
                const examsFor = (exams.data ?? []).filter((e) => e.subject?._id === s._id)
                return (
                  <div key={s._id} className="xl:col-span-4">
                    <StatNotice
                      pin="green" tilt={i % 2 ? 0.5 : -0.6}
                      settleKey={`${s.code}-${examsFor.length}`}
                      label={`MY SUBJECT · ${s.code}`}
                      value={s.studentCount}
                      unit={s.studentCount === 1 ? ' student' : ' students'}
                      sub={`${s.name} · ${examsFor.length} exam${examsFor.length === 1 ? '' : 's'} set`}
                    >
                      {examsFor.length > 0 && (
                        <ul className="mt-3 space-y-1.5 border-t border-paper-rule pt-3">
                          {examsFor.slice(0, 3).map((e) => (
                            <li key={e._id} className="num flex justify-between text-[13px]">
                              <span>{e.name} · {fmtDate(e.date)}</span>
                              <span className={e.isLocked ? 'font-semibold text-pin-red-text' : e.lockRequested ? 'font-semibold text-pin-gold-text' : 'text-ink-soft'}>
                                {e.isLocked ? 'LOCKED' : e.lockRequested ? 'LOCK REQ.' : 'open'}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </StatNotice>
                  </div>
                )
              })}
    </div>
  )
}
