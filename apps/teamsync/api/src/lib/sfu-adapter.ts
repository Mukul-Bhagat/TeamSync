/**
 * External SFU Adapter Interface
 * Placeholder for LiveKit, Daily, Twilio, or custom SFU integration
 */

import { ServiceLogger } from '@vistafam/pipevista-core';

const logger = new ServiceLogger('teamsync:sfu-adapter');

export interface SFURoom {
  id: string;
  name: string;
  maxParticipants: number;
  token: string;
  wsUrl: string;
}

export interface SFUConfig {
  provider: 'livekit' | 'daily' | 'twilio' | 'custom';
  apiKey: string;
  apiSecret: string;
  url: string;
}

function getConfig(): SFUConfig {
  return {
    provider: (process.env.SFU_PROVIDER as any) ?? 'livekit',
    apiKey: process.env.SFU_API_KEY ?? '',
    apiSecret: process.env.SFU_API_SECRET ?? '',
    url: process.env.SFU_URL ?? '',
  };
}

export async function createRoom(roomName: string, maxParticipants = 50): Promise<SFURoom> {
  const config = getConfig();
  logger.info(`Creating SFU room via ${config.provider}`, { roomName, maxParticipants });

  // Placeholder: in production, call LiveKit/Daily/Twilio API
  // Example for LiveKit:
  // const { AccessToken } = await import('livekit-server-sdk');
  // const token = new AccessToken(config.apiKey, config.apiSecret, { identity: 'server' });
  // token.addGrant({ roomCreate: true, roomAdmin: true });

  return {
    id: `room-${Date.now()}`,
    name: roomName,
    maxParticipants,
    token: 'placeholder-token',
    wsUrl: config.url,
  };
}

export async function generateParticipantToken(roomId: string, userId: string, userName: string): Promise<string> {
  const config = getConfig();
  logger.info(`Generating participant token`, { roomId, userId, provider: config.provider });

  // Placeholder: in production, generate JWT token for the specific SFU provider
  return `token-${roomId}-${userId}-${Date.now()}`;
}

export async function deleteRoom(roomId: string): Promise<void> {
  const config = getConfig();
  logger.info(`Deleting SFU room`, { roomId, provider: config.provider });

  // Placeholder: call SFU API to invalidate room
}

export async function getRoomParticipants(roomId: string): Promise<{ userId: string; joinedAt: string }[]> {
  logger.debug(`Getting room participants`, { roomId });
  return [];
}
