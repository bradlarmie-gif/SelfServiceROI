import { type User, type InsertUser, type ShortLink, shortLinks } from "@shared/schema";
import { randomUUID, randomBytes } from "crypto";
import { eq, gt, or, isNull, and } from "drizzle-orm";
import { db } from "./db";

const CODE_LENGTH = 8;
const ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const LINK_TTL_DAYS = 30;
const MAX_RETRIES = 5;

function generateAlphanumericCode(length: number): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => ALPHANUMERIC[b % ALPHANUMERIC.length]).join("");
}

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Error &&
    "code" in err &&
    (err as Error & { code: string }).code === "23505"
  );
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createShortLink(paramKey: string, payload: string): Promise<{ code: string }>;
  getShortLink(code: string): Promise<{ paramKey: string; payload: string } | null>;
}

export class DatabaseStorage implements IStorage {
  private users: Map<string, User>;

  constructor() {
    this.users = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createShortLink(paramKey: string, payload: string): Promise<{ code: string }> {
    const expiresAt = new Date(Date.now() + LINK_TTL_DAYS * 24 * 60 * 60 * 1000);
    let lastErr: unknown;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const code = generateAlphanumericCode(CODE_LENGTH);
      try {
        await db.insert(shortLinks).values({ code, paramKey, payload, expiresAt });
        return { code };
      } catch (err: unknown) {
        if (isUniqueViolation(err)) {
          lastErr = err;
          continue;
        }
        throw err;
      }
    }
    throw lastErr ?? new Error("Failed to generate unique short link code");
  }

  async getShortLink(code: string): Promise<{ paramKey: string; payload: string } | null> {
    const [row] = await db
      .select({ paramKey: shortLinks.paramKey, payload: shortLinks.payload })
      .from(shortLinks)
      .where(
        and(
          eq(shortLinks.code, code),
          or(isNull(shortLinks.expiresAt), gt(shortLinks.expiresAt, new Date()))
        )
      )
      .limit(1);
    return row ?? null;
  }
}

export const storage = new DatabaseStorage();
