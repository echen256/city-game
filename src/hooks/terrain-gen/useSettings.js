import { useCallback } from 'react';
import { useTerrain } from '../../context/terrain-gen/TerrainContext.jsx';
import { TERRAIN_SETTINGS_SCHEMA } from '../../config/terrain-gen/SettingsSchema.js';

export const useSettings = () => {
  const { settings, updateSetting } = useTerrain();

  const getSettingValue = useCallback((category, key) => {
    return settings[category]?.[key] ?? TERRAIN_SETTINGS_SCHEMA[category]?.[key]?.default;
  }, [settings]);

  const setSettingValue = useCallback((category, key, value) => {
    const schema = TERRAIN_SETTINGS_SCHEMA[category]?.[key];
    if (schema) {
      // Validate value against schema
      const validatedValue = validateValue(value, schema);
      updateSetting(category, key, validatedValue);
    }
  }, [updateSetting]);

  const getSettingSchema = useCallback((category, key) => {
    return TERRAIN_SETTINGS_SCHEMA[category]?.[key];
  }, []);

  return {
    getSettingValue,
    setSettingValue,
    getSettingSchema
  };
};

function validateValue(value, schema) {
  switch (schema.type) {
    case 'number':
      const num = parseFloat(value);
      if (isNaN(num)) return schema.default;
      if (schema.min !== undefined && num < schema.min) return schema.min;
      if (schema.max !== undefined && num > schema.max) return schema.max;
      return num;
    case 'boolean':
      return Boolean(value);
    case 'select':
      return schema.options.includes(value) ? value : schema.default;
    default:
      return value;
  }
}