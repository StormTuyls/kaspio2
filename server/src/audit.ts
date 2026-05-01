import { query } from "./db.js";

type AuditAction = "created" | "updated" | "deleted";
type AuditEntityType = "pot" | "member" | "transaction" | "settings";

export async function recordAudit(input: {
  accountId: string;
  actorId: string | null;
  actorName: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityName: string;
  details?: string | null;
}) {
  await query(
    `INSERT INTO audit_log (account_id, actor_id, actor_name, action, entity_type, entity_name, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      input.accountId,
      input.actorId,
      input.actorName,
      input.action,
      input.entityType,
      input.entityName,
      input.details ?? null,
    ],
  );
}
