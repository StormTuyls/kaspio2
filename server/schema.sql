CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  organization_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'pot_owner')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_members_account ON members(account_id);

CREATE TABLE pots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  target_amount NUMERIC(12, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pots_account ON pots(account_id);
CREATE INDEX idx_pots_owner ON pots(owner_id);

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  pot_id UUID NOT NULL REFERENCES pots(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  occurred_on DATE NOT NULL,
  counterparty TEXT NOT NULL,
  memo TEXT,
  created_by UUID REFERENCES members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_account_pot ON transactions(account_id, pot_id);
CREATE INDEX idx_transactions_occurred_on ON transactions(occurred_on DESC);

CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES members(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('pot', 'member', 'transaction', 'settings')),
  entity_name TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_account_created ON audit_log(account_id, created_at DESC);

CREATE TABLE notification_settings (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  email_on_transaction BOOLEAN NOT NULL DEFAULT TRUE,
  email_on_pot_created BOOLEAN NOT NULL DEFAULT FALSE,
  email_on_member_added BOOLEAN NOT NULL DEFAULT TRUE,
  digest_frequency TEXT NOT NULL DEFAULT 'never' CHECK (digest_frequency IN ('never', 'daily', 'weekly')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
