-- H20: Agregar property_id a property_photos para separar fotos por propiedad
ALTER TABLE property_photos
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_property_photos_property_id ON property_photos(property_id);
