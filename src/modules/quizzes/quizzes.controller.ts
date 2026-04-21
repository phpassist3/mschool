import { Request, Response } from 'express';
import { quizzesService } from './quizzes.service';
import { UpsertQuizInput } from './quizzes.schemas';

/**
 * HTTP-адаптеры тестов. Монтируются на
 * /api/lessons/:lessonId/quiz — поэтому `lessonId` всегда в params.
 */
export const quizzesController = {
  async get(req: Request, res: Response) {
    const { lessonId } = req.params as { lessonId: string };
    res.json(await quizzesService.getPublic(lessonId));
  },

  async upsert(req: Request, res: Response) {
    const { lessonId } = req.params as { lessonId: string };
    const quiz = await quizzesService.upsert(
      lessonId,
      req.user!.sub,
      req.body as UpsertQuizInput,
    );
    res.json(quiz);
  },

  async delete(req: Request, res: Response) {
    const { lessonId } = req.params as { lessonId: string };
    await quizzesService.delete(lessonId, req.user!.sub);
    res.status(204).end();
  },

  async attempt(req: Request, res: Response) {
    const { lessonId } = req.params as { lessonId: string };
    const { answers } = req.body as { answers: number[] };
    res.json(await quizzesService.attempt(lessonId, answers));
  },
};
