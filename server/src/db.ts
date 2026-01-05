import Database from 'better-sqlite3';
import { RecipeData } from './types';
import { initialProcesses, initialEdges } from '../../src/data/initialData';
import { syncDefaultFields } from './migrations/syncDefaultFields';

const db = new Database('recipe.db');

// 初始化数据库
export function initDatabase() {
  // 删除旧表（如果存在）
  db.exec(`DROP TABLE IF EXISTS recipes`);

  // 创建新配方表
  db.exec(`
    CREATE TABLE recipes (
      id TEXT PRIMARY KEY,
      metadata TEXT NOT NULL,
      processes TEXT NOT NULL,
      edges TEXT NOT NULL,
      version INTEGER DEFAULT 1,
      updated_at TEXT NOT NULL,
      updated_by TEXT
    )
  `);

  // Create field config table
  db.exec(`
    CREATE TABLE IF NOT EXISTS process_field_configs (
      id TEXT PRIMARY KEY,
      process_type TEXT NOT NULL,
      key TEXT NOT NULL,
      label TEXT NOT NULL,
      input_type TEXT NOT NULL,
      unit TEXT,
      options TEXT, -- JSON string
      default_value TEXT, -- JSON string
      validation TEXT, -- JSON string
      display_condition TEXT, -- JSON string
      sort_order INTEGER DEFAULT 0,
      is_system INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT,
      UNIQUE(process_type, key)
    );
    CREATE INDEX IF NOT EXISTS idx_process_type ON process_field_configs(process_type);
    CREATE INDEX IF NOT EXISTS idx_enabled ON process_field_configs(enabled);
  `);

  // Sync default fields
  try {
    syncDefaultFields();
  } catch (error) {
    console.error('Failed to sync default fields:', error);
  }

  // 创建默认配方（如果不存在）
  const existing = db.prepare('SELECT id FROM recipes WHERE id = ?').get('default');
  if (!existing) {
    const defaultRecipe: RecipeData = {
      id: 'default',
      metadata: {
        name: '饮料生产工艺配方',
        version: '1.0.0',
        updatedAt: new Date().toISOString(),
      },
      processes: initialProcesses,
      edges: initialEdges,
      version: 1,
      updatedBy: null,
    };

    db.prepare(`
      INSERT INTO recipes (id, metadata, processes, edges, version, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      defaultRecipe.id,
      JSON.stringify(defaultRecipe.metadata),
      JSON.stringify(defaultRecipe.processes),
      JSON.stringify(defaultRecipe.edges),
      defaultRecipe.version,
      defaultRecipe.metadata.updatedAt,
      defaultRecipe.updatedBy
    );
  }
}

export function getRecipe(recipeId: string = 'default'): RecipeData | null {
  const row = db.prepare('SELECT * FROM recipes WHERE id = ?').get(recipeId) as any;
  if (!row) return null;

  return {
    id: row.id,
    metadata: JSON.parse(row.metadata),
    processes: JSON.parse(row.processes),
    edges: JSON.parse(row.edges),
    version: row.version,
    updatedBy: row.updated_by,
  };
}

export function updateRecipe(recipeId: string, data: Omit<RecipeData, 'id'>, userId: string): boolean {
  const existing = getRecipe(recipeId);
  if (!existing) return false;

  // 乐观锁检查
  if (data.version !== existing.version) {
    return false; // 版本冲突
  }

  const newVersion = existing.version + 1;
  const updatedAt = new Date().toISOString();

  const result = db.prepare(`
    UPDATE recipes 
    SET metadata = ?, processes = ?, edges = ?, version = ?, updated_at = ?, updated_by = ?
    WHERE id = ? AND version = ?
  `).run(
    JSON.stringify(data.metadata),
    JSON.stringify(data.processes),
    JSON.stringify(data.edges),
    newVersion,
    updatedAt,
    userId,
    recipeId,
    existing.version
  );

  return result.changes > 0;
}

export { db };

// Field Config Operations
export interface FieldConfig {
  id: string;
  processType: string;
  key: string;
  label: string;
  inputType: string;
  unit?: string;
  options?: any;
  defaultValue?: any;
  validation?: any;
  displayCondition?: any;
  sortOrder: number;
  isSystem: boolean;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

function mapRowToFieldConfig(row: any): FieldConfig {
  return {
    id: row.id,
    processType: row.process_type,
    key: row.key,
    label: row.label,
    inputType: row.input_type,
    unit: row.unit,
    options: row.options ? JSON.parse(row.options) : undefined,
    defaultValue: row.default_value ? JSON.parse(row.default_value) : undefined,
    validation: row.validation ? JSON.parse(row.validation) : undefined,
    displayCondition: row.display_condition ? JSON.parse(row.display_condition) : undefined,
    sortOrder: row.sort_order,
    isSystem: !!row.is_system,
    enabled: !!row.enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function getFieldConfigs(processType?: string): FieldConfig[] {
  let query = 'SELECT * FROM process_field_configs';
  const params: any[] = [];

  if (processType) {
    query += ' WHERE process_type = ?';
    params.push(processType);
  }

  query += ' ORDER BY process_type, sort_order';

  const rows = db.prepare(query).all(...params);
  return rows.map(mapRowToFieldConfig);
}

export function getFieldConfig(id: string): FieldConfig | null {
  const row = db.prepare('SELECT * FROM process_field_configs WHERE id = ?').get(id);
  return row ? mapRowToFieldConfig(row) : null;
}

export function createFieldConfig(config: FieldConfig): boolean {
  const result = db.prepare(`
        INSERT INTO process_field_configs (
            id, process_type, key, label, input_type, unit, options, 
            default_value, validation, display_condition, sort_order, 
            is_system, enabled, created_at, updated_at
        ) VALUES (
            @id, @processType, @key, @label, @inputType, @unit, @options, 
            @defaultValue, @validation, @displayCondition, @sortOrder, 
            @isSystem, @enabled, @createdAt, @updatedAt
        )
    `).run({
    id: config.id,
    processType: config.processType,
    key: config.key,
    label: config.label,
    inputType: config.inputType,
    unit: config.unit || null,
    options: config.options ? JSON.stringify(config.options) : null,
    defaultValue: config.defaultValue !== undefined ? JSON.stringify(config.defaultValue) : null,
    validation: config.validation ? JSON.stringify(config.validation) : null,
    displayCondition: config.displayCondition ? JSON.stringify(config.displayCondition) : null,
    sortOrder: config.sortOrder || 0,
    isSystem: config.isSystem ? 1 : 0,
    enabled: config.enabled ? 1 : 0,
    createdAt: config.createdAt || new Date().toISOString(),
    updatedAt: config.updatedAt || new Date().toISOString()
  });
  return result.changes > 0;
}

export function updateFieldConfig(id: string, config: Partial<FieldConfig>): boolean {
  const sets: string[] = [];
  const params: any = { id };
  const validKeys = [
    'processType', 'key', 'label', 'inputType', 'unit', 'options',
    'defaultValue', 'validation', 'displayCondition', 'sortOrder',
    'enabled', 'updatedAt'
  ]; // isSystem cannot be updated normally, created_at shouldn't change

  // Map camelCase to snake_case for DB
  const dbKeyMap: Record<string, string> = {
    processType: 'process_type',
    inputType: 'input_type',
    defaultValue: 'default_value',
    displayCondition: 'display_condition',
    sortOrder: 'sort_order',
    updatedAt: 'updated_at'
  };

  Object.keys(config).forEach(key => {
    if (validKeys.includes(key)) {
      const dbKey = dbKeyMap[key] || key;
      sets.push(`${dbKey} = @${key}`);

      // Handle JSON serialization
      let value = (config as any)[key];
      if (['options', 'defaultValue', 'validation', 'displayCondition'].includes(key)) {
        value = value !== undefined ? JSON.stringify(value) : null;
      }
      params[key] = value;
    }
  });

  if (sets.length === 0) return false;

  const result = db.prepare(`UPDATE process_field_configs SET ${sets.join(', ')} WHERE id = @id`).run(params);
  return result.changes > 0;
}

export function deleteFieldConfig(id: string): boolean {
  // Check if system field
  const current = getFieldConfig(id);
  if (current?.isSystem) return false;

  const result = db.prepare('DELETE FROM process_field_configs WHERE id = ?').run(id);
  return result.changes > 0;
}

