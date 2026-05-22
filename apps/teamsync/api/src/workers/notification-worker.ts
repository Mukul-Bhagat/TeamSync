/**
 * Notification Worker
 * Processes push, email, and slack notifications from BullMQ queue
 */

import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { ServiceLogger } from '@vistafam/pipevista-core';
import { getSupabase } from '../lib/supabase.js';

const logger = new ServiceLogger('teamsync:notification-worker');
const redisConnection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

interface NotificationJob {
  type: 'push' | 'email' | 'slack';
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export function createNotificationWorker(concurrency = 5): Worker {
  return new Worker<NotificationJob>(
    'teamsync:notifications',
    async (job: Job<NotificationJob>) => {
      const { type, userId, title, body, data } = job.data;
      logger.info(`Processing ${type} notification`, { userId, title });

      const supabase = getSupabase();

      switch (type) {
        case 'push': {
          // Firebase Cloud Messaging placeholder
          const fcmToken = await getFCMToken(userId);
          if (fcmToken) {
            logger.info('Sending push notification', { userId, title });
            // await sendFCM(fcmToken, title, body, data);
          }
          break;
        }

        case 'email': {
          // Resend/SendGrid placeholder
          const { data: user } = await supabase.from('users').select('email').eq('id', userId).single();
          if (user?.email) {
            logger.info('Sending email notification', { email: user.email, title });
            // await sendEmail(user.email, title, body);
          }
          break;
        }

        case 'slack': {
          // Slack webhook placeholder
          logger.info('Sending slack notification', { userId, title });
          // await sendSlackWebhook(title, body);
          break;
        }
      }
    },
    { connection: redisConnection, concurrency }
  );
}

async function getFCMToken(_userId: string): Promise<string | null> {
  // In production, fetch FCM token from user_devices table or Redis
  return null;
}
