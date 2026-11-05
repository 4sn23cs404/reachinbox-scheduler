import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { RecoveryService } from './services/recovery.service';
import redisClient from './config/redis';
import prisma from './config/database';
import { emailQueue } from './queues/email.queue';

import { initElasticsearchIndex } from './config/elasticsearch';

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, async () => {
  console.log(`🚀 [API Server] Running on http://localhost:${PORT}`);
  console.log(`🏥 Health Check available at http://localhost:${PORT}/health`);
  console.log(`📊 Bull Board Dashboard available at http://localhost:${PORT}/admin/queues`);

  // Initialize Elasticsearch index
  await initElasticsearchIndex();

  // Run startup reconciliation for restart persistence
  try {
    await RecoveryService.reconcileScheduledEmails();
  } catch (err: any) {
    console.error('⚠️ [Startup Reconciliation Warning]:', err.message);
  }
});

// Comprehensive Graceful Shutdown
const handleGracefulShutdown = async (signal: string) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

  server.close(async () => {
    console.log('✅ HTTP server closed.');
    try {
      await emailQueue.close();
      console.log('✅ BullMQ email queue closed.');
      await redisClient.quit();
      console.log('✅ Redis connection closed.');
      await prisma.$disconnect();
      console.log('✅ PostgreSQL connection closed.');
    } catch (e: any) {
      console.error('Error during teardown:', e.message);
    }
    process.exit(0);
  });
};

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
