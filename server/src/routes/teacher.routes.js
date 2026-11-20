import { Router } from 'express';
import {
  mySubjects,
  createExam,
  myExams,
  enterMarks,
  editMark,
  examResults,
  requestLock,
} from '../controllers/teacher.controller.js';

const router = Router();

// Teacher's assigned subjects
router.get('/subjects', mySubjects);

// Exams
router.post('/exams', createExam);
router.get('/exams', myExams);
router.post('/exams/:id/marks', enterMarks);
router.get('/exams/:id/results', examResults);
router.patch('/exams/:id/request-lock', requestLock);

// Marks
router.patch('/marks/:id', editMark);

export default router;
