import { Link } from 'react-router-dom'
import api from '../../lib/api.js'
import useApi from '../../hooks/useApi.js'
import StatNotice from '../../components/StatNotice.jsx'
import GradeBadge from '../../components/GradeBadge.jsx'
import { LoadingNotice, ErrorNotice, EmptyNotice } from '../../components/NoticeStates.jsx'

const fetchSubjects = () => api.get('/api/student/subjects').then((r) => r.data.data)

export default function StudentSubjects() {
  const subjects = useApi(fetchSubjects, [])

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-12">
      {subjects.loading
        ? Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="xl:col-span-4"><LoadingNotice tilt={i ? 0.5 : -0.6} /></div>
          ))
        : subjects.error
          ? <div className="xl:col-span-5"><ErrorNotice message={subjects.error} onRetry={subjects.reload} /></div>
          : subjects.data.length === 0
            ? <div className="xl:col-span-6"><EmptyNotice title="NOT ENROLLED YET" hint="The admin enrolls you in subjects - once marked, your cards appear here." tilt={-0.6} /></div>
            : subjects.data.map((row, i) => (
                <div key={row.subject._id} className="xl:col-span-4">
                  <StatNotice
                    pin={row.percentage === null ? 'blue' : row.percentage < 40 ? 'red' : 'green'}
                    tilt={i % 2 ? 0.5 : -0.6}
                    settleKey={`${row.subject.code}-${row.percentage}`}
                    label={`MY SUBJECT · ${row.subject.code}`}
                    value={row.percentage === null ? '-' : row.percentage.toFixed(2)}
                    unit={row.percentage === null ? '' : '%'}
                    sub={`${row.totalScore} / ${row.totalMax} scored · ${row.examCount} exam${row.examCount === 1 ? '' : 's'}`}
                  >
                    <div className="mt-3 flex items-center gap-3 border-t border-paper-rule pt-3">
                      <span className="text-[13px] text-ink-soft">Subject grade</span>
                      <span className="ml-auto flex items-center gap-2">
                        <GradeBadge grade={row.grade} size="lg" />
                        <span className="font-display text-[12px] tracking-[0.14em] text-ink-soft">
                          {row.subject.name.toUpperCase()}
                        </span>
                      </span>
                    </div>
                    <Link
                      to={`/student/trend?subject=${row.subject._id}`}
                      className="tlink mt-3 inline-block border-t border-paper-rule pt-3"
                    >
                      Score trend for {row.subject.code} →
                    </Link>
                  </StatNotice>
                </div>
              ))}
    </div>
  )
}
