import { Request, Response } from 'express';
import { coursesService } from './courses.service';
import { CreateCourseInput } from './courses.schemas';

/**
 * HTTP-адаптеры курсов. Middleware validate() уже привёл query-строки
 * к числам и отклонил кривой payload, поэтому хендлеры могут доверять
 * типам входных данных.
 */
export const coursesController = {
  async create(req: Request, res: Response) {
    // `req.user` гарантирован middleware requireAuth выше по цепочке.
    const course = await coursesService.create(req.user!.sub, req.body as CreateCourseInput);
    res.status(201).json(course);
  },

  async list(req: Request, res: Response) {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    res.json(await coursesService.list(page, limit));
  },

  async getById(req: Request, res: Response) {
    const { id } = req.params as { id: string };
    res.json(await coursesService.getById(id));
  },
};
