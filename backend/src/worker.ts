import dotenv from 'dotenv';
dotenv.config();

import { emailWorker } from './queues/email.worker';

console.log('🚀 [Worker Process] BullMQ Email Worker started.');
console.log(`⚙️ Configured Concurrency: ${process.env.WORKER_CONCURRENCY || 5}`);

const handleGracefulShutdown = async (signal: string) => {
  console.log(`\n🛑 Worker received ${signal}. Closing BullMQ worker gracefully...`);
  try {
    await emailWorker.close();
    console.log('✅ BullMQ worker closed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error during worker shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
