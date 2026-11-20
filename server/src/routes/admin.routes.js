import { Router } from 'express';
import {
  createSubject,
  listSubjects,
  createTeacher,
  listTeachers,
  createStudent,
  listStudents,
  listExams,
  lockExam,
  analytics,
} from '../controllers/admin.controller.js';

const router = Router();

// Subjects
router.post('/subjects', createSubject);
router.get('/subjects', listSubjects);

// Teachers (registration + assignment)
router.post('/teachers', createTeacher);
router.get('/teachers', listTeachers);

// Students (registration + enrollment)
router.post('/students', createStudent);
router.get('/students', listStudents);

// Exams + lock flow
router.get('/exams', listExams);
router.patch('/exams/:id/lock', lockExam);

// Institution-wide analytics (aggregation pipelines)
router.get('/analytics', analytics);

export default router;
