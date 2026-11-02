-- VARA · Beta to Stable — persistencia para Escritura, Workflows y Alertas
-- lf-001, lf-003, lf-015

-- ── document_ai_summaries ────────────────────────────────────────────────────
-- Guarda el análisis IA de cada documento. Un solo registro por documento
-- (upsert por document_id). Se elimina en cascada si se borra el documento.

CREATE TABLE IF NOT EXISTS document_ai_summaries (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id  uuid        NOT NULL REFERENCES operation_documents(id) ON DELETE CASCADE,
  summary      jsonb       NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id)
);

ALTER TABLE document_ai_summaries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "document_ai_summaries_owner"
    ON document_ai_summaries
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS document_ai_summaries_document_id_idx
  ON document_ai_summaries (document_id);

-- ── workflow_rule_overrides ──────────────────────────────────────────────────
-- Guarda el estado activado/desactivado de cada regla del Workflow Engine
-- por usuario. Solo se inserta cuando el usuario cambia el default.

CREATE TABLE IF NOT EXISTS workflow_rule_overrides (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_id    text        NOT NULL,
  enabled    boolean     NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, rule_id)
);

ALTER TABLE workflow_rule_overrides ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "workflow_rule_overrides_owner"
    ON workflow_rule_overrides
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS workflow_rule_overrides_user_id_idx
  ON workflow_rule_overrides (user_id);
