import { esClient, EMAIL_INDEX_NAME } from '../config/elasticsearch';

export interface EmailSearchDoc {
  id: string;
  emailId: string;
  userId: string;
  campaignId: string;
  campaignName: string;
  senderId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string;
  sentAt?: string | null;
  errorMessage?: string | null;
  etherealPreviewUrl?: string | null;
  createdAt: string;
}

export interface SearchQueryParams {
  query?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export class SearchService {
  /**
   * Indexes a newly created email document into Elasticsearch.
   */
  static async indexEmail(doc: EmailSearchDoc): Promise<void> {
    try {
      await esClient.index({
        index: EMAIL_INDEX_NAME,
        id: doc.emailId,
        document: doc,
        refresh: 'wait_for',
      });
    } catch (error: any) {
      console.warn(`⚠️ [Elasticsearch Index Warning] Could not index ${doc.emailId}:`, error.message);
    }
  }

  /**
   * Updates an existing email document's status in Elasticsearch.
   */
  static async updateEmailStatus(
    emailId: string,
    updates: {
      status: string;
      sentAt?: Date | null;
      errorMessage?: string | null;
      etherealPreviewUrl?: string | null;
    }
  ): Promise<void> {
    try {
      await esClient.update({
        index: EMAIL_INDEX_NAME,
        id: emailId,
        doc: {
          status: updates.status,
          sentAt: updates.sentAt ? updates.sentAt.toISOString() : null,
          errorMessage: updates.errorMessage || null,
          etherealPreviewUrl: updates.etherealPreviewUrl || null,
        },
      });
    } catch (error: any) {
      console.warn(`⚠️ [Elasticsearch Update Warning] Could not update ${emailId}:`, error.message);
    }
  }

  /**
   * Searches emails by query, recipient, subject, campaign, sender, status, and date range.
   */
  static async searchEmails(userId: string, params: SearchQueryParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(params.limit) || 10));
    const from = (page - 1) * limit;

    const mustConditions: any[] = [{ term: { userId } }];

    // Full-text search across subject, body, recipientEmail, senderEmail, campaignName
    if (params.query && params.query.trim()) {
      mustConditions.push({
        multi_match: {
          query: params.query.trim(),
          fields: [
            'subject^3',
            'recipientEmail^2',
            'senderEmail',
            'campaignName',
            'body',
          ],
          fuzziness: 'AUTO',
        },
      });
    }

    if (params.status && params.status.trim()) {
      mustConditions.push({
        term: { status: params.status.trim().toLowerCase() },
      });
    }

    if (params.startDate || params.endDate) {
      const rangeFilter: any = {};
      if (params.startDate) rangeFilter.gte = params.startDate;
      if (params.endDate) rangeFilter.lte = params.endDate;
      mustConditions.push({
        range: { scheduledAt: rangeFilter },
      });
    }

    try {
      const result = await esClient.search({
        index: EMAIL_INDEX_NAME,
        from,
        size: limit,
        query: {
          bool: {
            must: mustConditions,
          },
        },
        sort: [{ scheduledAt: { order: 'desc' } }],
      });

      const totalHits =
        typeof result.hits.total === 'number'
          ? result.hits.total
          : result.hits.total?.value || 0;

      const emails = result.hits.hits.map((hit) => hit._source);

      return {
        source: 'elasticsearch',
        emails,
        pagination: {
          total: totalHits,
          page,
          limit,
          totalPages: Math.ceil(totalHits / limit),
        },
      };
    } catch (error: any) {
      console.error('❌ Elasticsearch search failed:', error.message);
      throw error;
    }
  }
}
