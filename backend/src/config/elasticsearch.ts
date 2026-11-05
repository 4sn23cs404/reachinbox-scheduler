import { Client } from '@elastic/elasticsearch';

const esNode = process.env.ELASTICSEARCH_NODE || 'http://localhost:9200';
const esUsername = process.env.ELASTICSEARCH_USERNAME;
const esPassword = process.env.ELASTICSEARCH_PASSWORD;

export const esClient = new Client({
  node: esNode,
  auth: esUsername && esPassword ? { username: esUsername, password: esPassword } : undefined,
});

export const EMAIL_INDEX_NAME = 'reachinbox-emails';

/**
 * Initializes the Elasticsearch index with appropriate mappings if it does not exist.
 */
export async function initElasticsearchIndex(): Promise<void> {
  try {
    const exists = await esClient.indices.exists({ index: EMAIL_INDEX_NAME });

    if (!exists) {
      console.log(`📦 Creating Elasticsearch index "${EMAIL_INDEX_NAME}"...`);
      await esClient.indices.create({
        index: EMAIL_INDEX_NAME,
        mappings: {
          properties: {
            id: { type: 'keyword' },
            emailId: { type: 'keyword' },
            userId: { type: 'keyword' },
            campaignId: { type: 'keyword' },
            campaignName: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            senderId: { type: 'keyword' },
            senderEmail: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            recipientEmail: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            subject: { type: 'text', analyzer: 'standard' },
            body: { type: 'text', analyzer: 'standard' },
            status: { type: 'keyword' },
            scheduledAt: { type: 'date' },
            sentAt: { type: 'date' },
            errorMessage: { type: 'text' },
            etherealPreviewUrl: { type: 'keyword' },
            createdAt: { type: 'date' },
          },
        },
      });
      console.log(`✅ Elasticsearch index "${EMAIL_INDEX_NAME}" initialized successfully.`);
    } else {
      console.log(`✅ Elasticsearch index "${EMAIL_INDEX_NAME}" is ready.`);
    }
  } catch (error: any) {
    console.error('⚠️ [Elasticsearch Init Warning]:', error.message);
  }
}

export default esClient;
