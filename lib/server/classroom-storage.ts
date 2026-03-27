import { promises as fs } from 'fs';
import path from 'path';
import type { NextRequest } from 'next/server';
import type { Scene, Stage } from '@/lib/types/stage';

export const CLASSROOMS_DIR = path.join(process.cwd(), 'data', 'classrooms');
export const CLASSROOM_JOBS_DIR = path.join(process.cwd(), 'data', 'classroom-jobs');

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export async function ensureClassroomsDir() {
  await ensureDir(CLASSROOMS_DIR);
}

export async function ensureClassroomJobsDir() {
  await ensureDir(CLASSROOM_JOBS_DIR);
}

export async function writeJsonFileAtomic(filePath: string, data: unknown) {
  const dir = path.dirname(filePath);
  await ensureDir(dir);

  const tempFilePath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const content = JSON.stringify(data, null, 2);
  await fs.writeFile(tempFilePath, content, 'utf-8');
  await fs.rename(tempFilePath, filePath);
}

export function buildRequestOrigin(req: NextRequest): string {
  return req.headers.get('x-forwarded-host')
    ? `${req.headers.get('x-forwarded-proto') || 'http'}://${req.headers.get('x-forwarded-host')}`
    : req.nextUrl.origin;
}

export interface PersistedClassroomData {
  id: string;
  ownerUserId: string;
  ownerEmail: string;
  stage: Stage;
  scenes: Scene[];
  createdAt: string;
  updatedAt: string;
}

export interface PersistedClassroomSummary {
  id: string;
  ownerUserId: string;
  ownerEmail: string;
  name: string;
  description?: string;
  sceneCount: number;
  createdAt: number;
  updatedAt: number;
}

export function isValidClassroomId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

export async function readClassroom(id: string): Promise<PersistedClassroomData | null> {
  const filePath = path.join(CLASSROOMS_DIR, `${id}.json`);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as PersistedClassroomData;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function persistClassroom(
  data: {
    id: string;
    ownerUserId: string;
    ownerEmail: string;
    stage: Stage;
    scenes: Scene[];
  },
  baseUrl: string,
): Promise<PersistedClassroomData & { url: string }> {
  const now = new Date().toISOString();
  const existing = await readClassroom(data.id);
  const classroomData: PersistedClassroomData = {
    id: data.id,
    ownerUserId: data.ownerUserId,
    ownerEmail: data.ownerEmail,
    stage: data.stage,
    scenes: data.scenes,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  await ensureClassroomsDir();
  const filePath = path.join(CLASSROOMS_DIR, `${data.id}.json`);
  await writeJsonFileAtomic(filePath, classroomData);

  return {
    ...classroomData,
    url: `${baseUrl}/classroom/${data.id}`,
  };
}

export async function listClassroomsByOwner(
  ownerUserId: string,
): Promise<PersistedClassroomSummary[]> {
  await ensureClassroomsDir();

  const entries = await fs.readdir(CLASSROOMS_DIR, { withFileTypes: true });
  const classrooms: Array<PersistedClassroomSummary | null> = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map(async (entry) => {
        const content = await fs.readFile(path.join(CLASSROOMS_DIR, entry.name), 'utf-8');
        const classroom = JSON.parse(content) as PersistedClassroomData;
        if (classroom.ownerUserId !== ownerUserId) {
          return null;
        }

        const summary: PersistedClassroomSummary = {
          id: classroom.id,
          ownerUserId: classroom.ownerUserId,
          ownerEmail: classroom.ownerEmail,
          name: classroom.stage.name || 'Untitled Stage',
          description: classroom.stage.description,
          sceneCount: classroom.scenes.length,
          createdAt: new Date(classroom.createdAt).getTime(),
          updatedAt: new Date(classroom.updatedAt || classroom.createdAt).getTime(),
        };

        return summary;
      }),
  );

  return classrooms
    .filter((classroom): classroom is PersistedClassroomSummary => classroom !== null)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteClassroom(id: string): Promise<boolean> {
  const filePath = path.join(CLASSROOMS_DIR, `${id}.json`);
  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}
