-- H13: Índice para filtrar operaciones por país (útil para multioperación AR/MX)
CREATE INDEX IF NOT EXISTS idx_operations_country ON operations(country);
