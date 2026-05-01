import { Router } from "express";
import type { Response } from "express";
import { z } from "zod";
import { query, queryOne } from "./db.js";
import {
  comparePassword,
  hashPassword,
  requireAuth,
  signToken,
  type AuthedRequest,
} from "./auth.js";
import { recordAudit } from "./audit.js";

export const router = Router();

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(1),
  organizationName: z.string().min(1),
});

router.post("/auth/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Ongeldige invoer", issues: parsed.error.issues });
  }
  const { email, password, fullName, organizationName } = parsed.data;
  const lower = email.toLowerCase();

  const existing = await queryOne(`SELECT id FROM accounts WHERE email = $1`, [lower]);
  if (existing) {
    return res.status(409).json({ error: "Dit e-mailadres is al geregistreerd." });
  }

  const passwordHash = await hashPassword(password);

  const account = await queryOne<{ id: string; created_at: string }>(
    `INSERT INTO accounts (email, password_hash, full_name, organization_name)
     VALUES ($1, $2, $3, $4)
     RETURNING id, created_at`,
    [lower, passwordHash, fullName, organizationName],
  );
  if (!account) return res.status(500).json({ error: "Kon account niet aanmaken" });

  const member = await queryOne<{ id: string }>(
    `INSERT INTO members (account_id, name, role) VALUES ($1, $2, 'admin') RETURNING id`,
    [account.id, fullName],
  );

  await query(
    `INSERT INTO notification_settings (account_id) VALUES ($1)
     ON CONFLICT (account_id) DO NOTHING`,
    [account.id],
  );

  await recordAudit({
    accountId: account.id,
    actorId: member?.id ?? null,
    actorName: fullName,
    action: "created",
    entityType: "member",
    entityName: fullName,
    details: "Initiële admin",
  });

  const token = signToken({ accountId: account.id });
  res.json({
    token,
    account: {
      id: account.id,
      email: lower,
      fullName,
      organizationName,
      createdAt: account.created_at,
    },
  });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Ongeldige invoer" });
  }
  const lower = parsed.data.email.toLowerCase();

  const acc = await queryOne<{
    id: string;
    email: string;
    password_hash: string;
    full_name: string;
    organization_name: string;
    created_at: string;
  }>(`SELECT * FROM accounts WHERE email = $1`, [lower]);

  if (!acc || !(await comparePassword(parsed.data.password, acc.password_hash))) {
    return res.status(401).json({ error: "Verkeerd e-mailadres of wachtwoord." });
  }

  const token = signToken({ accountId: acc.id });
  res.json({
    token,
    account: {
      id: acc.id,
      email: acc.email,
      fullName: acc.full_name,
      organizationName: acc.organization_name,
      createdAt: acc.created_at,
    },
  });
});

router.get("/auth/me", requireAuth, async (req: AuthedRequest, res: Response) => {
  const acc = await queryOne<{
    id: string;
    email: string;
    full_name: string;
    organization_name: string;
    created_at: string;
  }>(`SELECT id, email, full_name, organization_name, created_at FROM accounts WHERE id = $1`, [
    req.accountId,
  ]);
  if (!acc) return res.status(404).json({ error: "Niet gevonden" });
  res.json({
    id: acc.id,
    email: acc.email,
    fullName: acc.full_name,
    organizationName: acc.organization_name,
    createdAt: acc.created_at,
  });
});

// Members
router.get("/members", requireAuth, async (req: AuthedRequest, res: Response) => {
  const rows = await query(
    `SELECT id, name, role, created_at FROM members WHERE account_id = $1 ORDER BY created_at ASC`,
    [req.accountId],
  );
  res.json(rows);
});

const memberSchema = z.object({
  name: z.string().min(1),
  role: z.enum(["admin", "pot_owner"]),
});

router.post("/members", requireAuth, async (req: AuthedRequest, res: Response) => {
  const parsed = memberSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Ongeldige invoer" });
  const row = await queryOne(
    `INSERT INTO members (account_id, name, role) VALUES ($1, $2, $3)
     RETURNING id, name, role, created_at`,
    [req.accountId, parsed.data.name, parsed.data.role],
  );
  await recordAudit({
    accountId: req.accountId!,
    actorId: null,
    actorName: "—",
    action: "created",
    entityType: "member",
    entityName: parsed.data.name,
    details: `Rol: ${parsed.data.role}`,
  });
  res.status(201).json(row);
});

// Pots
router.get("/pots", requireAuth, async (req: AuthedRequest, res: Response) => {
  const rows = await query(
    `SELECT id, name, owner_id, target_amount, created_at FROM pots WHERE account_id = $1 ORDER BY created_at DESC`,
    [req.accountId],
  );
  res.json(rows);
});

const potSchema = z.object({
  name: z.string().min(1),
  ownerId: z.string().uuid(),
  targetAmount: z.number().positive().optional(),
});

router.post("/pots", requireAuth, async (req: AuthedRequest, res: Response) => {
  const parsed = potSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Ongeldige invoer" });

  const owner = await queryOne(`SELECT id, name FROM members WHERE id = $1 AND account_id = $2`, [
    parsed.data.ownerId,
    req.accountId,
  ]);
  if (!owner) return res.status(400).json({ error: "Onbekende verantwoordelijke" });

  const row = await queryOne(
    `INSERT INTO pots (account_id, name, owner_id, target_amount)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, owner_id, target_amount, created_at`,
    [req.accountId, parsed.data.name, parsed.data.ownerId, parsed.data.targetAmount ?? null],
  );
  await recordAudit({
    accountId: req.accountId!,
    actorId: null,
    actorName: "—",
    action: "created",
    entityType: "pot",
    entityName: parsed.data.name,
    details: `Verantwoordelijke: ${(owner as { name: string }).name}`,
  });
  res.status(201).json(row);
});

// Transactions
router.get("/transactions", requireAuth, async (req: AuthedRequest, res: Response) => {
  const rows = await query(
    `SELECT id, pot_id, direction, amount, occurred_on, counterparty, memo, created_at
     FROM transactions WHERE account_id = $1 ORDER BY occurred_on DESC, created_at DESC`,
    [req.accountId],
  );
  res.json(rows);
});

const txSchema = z.object({
  potId: z.string().uuid(),
  direction: z.enum(["in", "out"]),
  amount: z.number().positive(),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  counterparty: z.string().min(1),
  memo: z.string().optional(),
});

router.post("/transactions", requireAuth, async (req: AuthedRequest, res: Response) => {
  const parsed = txSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Ongeldige invoer" });

  const pot = await queryOne(`SELECT id, name FROM pots WHERE id = $1 AND account_id = $2`, [
    parsed.data.potId,
    req.accountId,
  ]);
  if (!pot) return res.status(400).json({ error: "Onbekend potje" });

  const row = await queryOne(
    `INSERT INTO transactions (account_id, pot_id, direction, amount, occurred_on, counterparty, memo)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, pot_id, direction, amount, occurred_on, counterparty, memo, created_at`,
    [
      req.accountId,
      parsed.data.potId,
      parsed.data.direction,
      parsed.data.amount,
      parsed.data.occurredOn,
      parsed.data.counterparty,
      parsed.data.memo ?? null,
    ],
  );
  const sign = parsed.data.direction === "in" ? "+" : "−";
  await recordAudit({
    accountId: req.accountId!,
    actorId: null,
    actorName: "—",
    action: "created",
    entityType: "transaction",
    entityName: (pot as { name: string }).name,
    details: `${sign}€${parsed.data.amount.toFixed(2)} · ${parsed.data.counterparty}`,
  });
  res.status(201).json(row);
});

// Audit
router.get("/audit", requireAuth, async (req: AuthedRequest, res: Response) => {
  const rows = await query(
    `SELECT id, actor_id, actor_name, action, entity_type, entity_name, details, created_at
     FROM audit_log WHERE account_id = $1
     ORDER BY created_at DESC LIMIT 500`,
    [req.accountId],
  );
  res.json(rows);
});

// Notification settings
router.get("/settings/notifications", requireAuth, async (req: AuthedRequest, res: Response) => {
  const row = await queryOne(
    `SELECT email_on_transaction, email_on_pot_created, email_on_member_added, digest_frequency
     FROM notification_settings WHERE account_id = $1`,
    [req.accountId],
  );
  res.json(
    row ?? {
      email_on_transaction: true,
      email_on_pot_created: false,
      email_on_member_added: true,
      digest_frequency: "never",
    },
  );
});

const notifSchema = z.object({
  emailOnTransaction: z.boolean().optional(),
  emailOnPotCreated: z.boolean().optional(),
  emailOnMemberAdded: z.boolean().optional(),
  digestFrequency: z.enum(["never", "daily", "weekly"]).optional(),
});

router.patch("/settings/notifications", requireAuth, async (req: AuthedRequest, res: Response) => {
  const parsed = notifSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Ongeldige invoer" });

  const fields: string[] = [];
  const values: unknown[] = [req.accountId];
  let i = 2;
  if (parsed.data.emailOnTransaction !== undefined) {
    fields.push(`email_on_transaction = $${i++}`);
    values.push(parsed.data.emailOnTransaction);
  }
  if (parsed.data.emailOnPotCreated !== undefined) {
    fields.push(`email_on_pot_created = $${i++}`);
    values.push(parsed.data.emailOnPotCreated);
  }
  if (parsed.data.emailOnMemberAdded !== undefined) {
    fields.push(`email_on_member_added = $${i++}`);
    values.push(parsed.data.emailOnMemberAdded);
  }
  if (parsed.data.digestFrequency !== undefined) {
    fields.push(`digest_frequency = $${i++}`);
    values.push(parsed.data.digestFrequency);
  }

  await query(
    `INSERT INTO notification_settings (account_id) VALUES ($1)
     ON CONFLICT (account_id) DO NOTHING`,
    [req.accountId],
  );

  if (fields.length > 0) {
    fields.push(`updated_at = now()`);
    await query(
      `UPDATE notification_settings SET ${fields.join(", ")} WHERE account_id = $1`,
      values,
    );
  }

  await recordAudit({
    accountId: req.accountId!,
    actorId: null,
    actorName: "—",
    action: "updated",
    entityType: "settings",
    entityName: "Notificaties",
  });

  res.json({ ok: true });
});

router.get("/health", async (_req, res) => {
  try {
    await query(`SELECT 1`);
    res.json({ ok: true, db: "up" });
  } catch (err) {
    res.status(503).json({ ok: false, db: "down", error: String(err) });
  }
});
