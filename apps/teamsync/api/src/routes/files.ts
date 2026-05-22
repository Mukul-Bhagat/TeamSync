/**
 * File Routes
 * Presigned upload URLs and attachment metadata
 */

import type { FastifyInstance } from 'fastify';
import { getSupabase } from '../lib/supabase.js';

const MINIO_URL = process.env.MINIO_URL ?? 'http://localhost:9000';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY ?? '';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY ?? '';

export async function fileRoutes(app: FastifyInstance) {
  // ── Generate presigned upload URL ──────────────────────
  app.post('/v1/files/upload-url', async (req, reply) => {
    const body = req.body as {
      fileName: string;
      fileType: string;
      fileSize: number;
      uploaderId: string;
    };

    // Validate file size (100MB max)
    if (body.fileSize > 100 * 1024 * 1024) {
      reply.status(413).send({ error: 'File too large. Max 100MB.' });
      return;
    }

    // Validate file type
    const allowedTypes = [
      'image/', 'video/', 'audio/', 'application/pdf',
      'text/', 'application/vnd.openxmlformats',
      'application/msword', 'application/vnd.ms-excel',
    ];
    const isAllowed = allowedTypes.some((t) => body.fileType.startsWith(t));
    if (!isAllowed) {
      reply.status(415).send({ error: 'File type not allowed' });
      return;
    }

    const storagePath = `uploads/${Date.now()}-${body.fileName}`;

    // In production, generate actual presigned URL from MinIO/S3
    // For now, return a placeholder URL structure
    const uploadUrl = `${MINIO_URL}/teamsync-attachments/${storagePath}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...`;

    reply.send({
      uploadUrl,
      storagePath,
      publicUrl: `${MINIO_URL}/teamsync-attachments/${storagePath}`,
      expiresIn: 900, // 15 minutes
    });
  });

  // ── Register attachment after upload ───────────────────
  app.post('/v1/messages/:id/attachments', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as {
      fileName: string;
      fileType: string;
      fileSize: number;
      storagePath: string;
      publicUrl?: string;
      uploaderId: string;
    };
    const supabase = getSupabase();

    const { data, error } = await supabase.from('file_attachments').insert({
      message_id: id,
      uploader_id: body.uploaderId,
      file_name: body.fileName,
      file_type: body.fileType,
      file_size: body.fileSize,
      storage_path: body.storagePath,
      public_url: body.publicUrl,
    }).select().single();

    if (error) { reply.status(500).send({ error: error.message }); return; }
    reply.status(201).send({ attachment: data });
  });

  // ── List message attachments ───────────────────────────
  app.get('/v1/messages/:id/attachments', async (req) => {
    const { id } = req.params as { id: string };
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('file_attachments')
      .select('*')
      .eq('message_id', id);

    if (error) return { attachments: [], error: error.message };
    return { attachments: data ?? [] };
  });
}
