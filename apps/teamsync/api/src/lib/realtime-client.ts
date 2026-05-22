/**
 * PipeVista Realtime HTTP Client
 * Delegates websocket broadcast and presence to PipeVista Realtime service
 */

import axios from 'axios';
import { ServiceLogger } from '@vistafam/pipevista-core';

const logger = new ServiceLogger('teamsync:realtime-client');
const REALTIME_URL = process.env.REALTIME_URL ?? 'http://localhost:4105';

const client = axios.create({
  baseURL: REALTIME_URL,
  timeout: 5000,
  headers: { 'Content-Type': 'application/json' },
});

export interface BroadcastPayload {
  tenantId: string;
  channelId?: string;
  userIds?: string[];
  eventName: string;
  payload: unknown;
}

export interface PresencePayload {
  tenantId: string;
  userId: string;
  status: 'online' | 'away' | 'dnd' | 'offline';
  platform?: string;
}

export async function broadcastEvent(data: BroadcastPayload): Promise<void> {
  try {
    await client.post('/v1/realtime/notify', data);
    logger.debug(`Broadcasted ${data.eventName}`, { tenantId: data.tenantId, channelId: data.channelId });
  } catch (err) {
    logger.error('Failed to broadcast event', { error: (err as Error).message, eventName: data.eventName });
    throw err;
  }
}

export async function updatePresence(data: PresencePayload): Promise<void> {
  try {
    await client.post('/v1/realtime/presence', data);
    logger.debug(`Updated presence`, { userId: data.userId, status: data.status });
  } catch (err) {
    logger.error('Failed to update presence', { error: (err as Error).message, userId: data.userId });
    throw err;
  }
}

export async function getPresence(tenantId: string): Promise<unknown[]> {
  try {
    const res = await client.get(`/v1/realtime/presence/${tenantId}`);
    return (res.data as { onlineUsers: unknown[] }).onlineUsers ?? [];
  } catch (err) {
    logger.error('Failed to get presence', { error: (err as Error).message, tenantId });
    return [];
  }
}
