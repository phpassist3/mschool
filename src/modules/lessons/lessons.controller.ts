import { Request, Response } from 'express';
import { lessonsService } from './lessons.service';
import { CreateLessonInput } from './lessons.schemas';

/**
 * HTTP-адаптеры уроков. `courseId` берётся из URL; родительский роутер
 * монтирует нас под /api/courses/:courseId/lessons.
 */
export const lessonsController = {
  async create(req: Request, res: Response) {
    const { courseId } = req.params as { courseId: string };
    const lesson = await lessonsService.create(
      courseId,
      req.user!.sub,
      req.body as CreateLessonInput,
    );
    res.status(201).json(lesson);
  },

  async list(req: Request, res: Response) {
    const { courseId } = req.params as { courseId: string };
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    res.json(await lessonsService.listByCourse(courseId, page, limit));
  },

  async delete(req: Request, res: Response) {
    const { courseId, id } = req.params as { courseId: string; id: string };
    await lessonsService.delete(courseId, id, req.user!.sub);
    res.status(204).end();
  },
};
