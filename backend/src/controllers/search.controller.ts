import { Request, Response } from 'express';
import { SearchService } from '../services/search.service';

export class SearchController {
  /**
   * GET /api/search/emails or GET /api/emails/search
   * Real-time full-text search backed by Elasticsearch
   */
  static async searchEmails(req: Request, res: Response): Promise<void> {
    try {
      const { q, query, status, startDate, endDate, page, limit } = req.query;

      const result = await SearchService.searchEmails(req.user!.id, {
        query: (q || query) as string,
        status: status as string,
        startDate: startDate as string,
        endDate: endDate as string,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 10,
      });

      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ error: 'SearchError', message: error.message });
    }
  }
}
