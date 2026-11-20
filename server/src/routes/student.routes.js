import { Router } from 'express';
import { mySubjects, performance, subjectTrend } from '../controllers/student.controller.js';

const router = Router();

router.get('/subjects', mySubjects);
router.get('/performance', performance);
router.get('/subjects/:id/trend', subjectTrend);

export default router;
