-- H13: Agregar columna country a operations para persistir el país de la operación
ALTER TABLE operations
  ADD COLUMN IF NOT EXISTS country VARCHAR(2);
