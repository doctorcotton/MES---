import Database from 'better-sqlite3';
import { RecipeData } from './types';
import { initialProcesses, initialEdges } from '../../src/data/initialData';
import { syncDefaultFields } from './migrations/syncDefaultFields';

const db = new Database('database.sqlite');

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

  // 创建字段配置表（支持全局唯一 key）
  db.exec(`
    CREATE TABLE IF NOT EXISTS process_field_configs (
      id TEXT PRIMARY KEY,
      process_type TEXT NOT NULL,
      key TEXT NOT NULL,
      label TEXT NOT NULL,
      input_type TEXT NOT NULL,
      unit TEXT,
      options TEXT, -- JSON 字符串
      default_value TEXT, -- JSON 字符串
      validation TEXT, -- JSON 字符串
      display_condition TEXT, -- JSON 字符串
      sort_order INTEGER DEFAULT 0,
      is_system INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT,
      item_config TEXT, -- 数组项的 JSON 字符串
      item_fields TEXT, -- 数组对象项的 JSON 字符串
      fields TEXT, -- 对象字段的 JSON 字符串
      min_items INTEGER,
      max_items INTEGER,
      UNIQUE(key)
    );
    CREATE INDEX IF NOT EXISTS idx_process_type ON process_field_configs(process_type);
    CREATE INDEX IF NOT EXISTS idx_enabled ON process_field_configs(enabled);
    CREATE INDEX IF NOT EXISTS idx_key ON process_field_configs(key);
  `);

  // 迁移现有表
  try { db.exec('ALTER TABLE process_field_configs ADD COLUMN item_config TEXT'); } catch (e) { }
  try { db.exec('ALTER TABLE process_field_configs ADD COLUMN item_fields TEXT'); } catch (e) { }
  try { db.exec('ALTER TABLE process_field_configs ADD COLUMN fields TEXT'); } catch (e) { }
  try { db.exec('ALTER TABLE process_field_configs ADD COLUMN min_items INTEGER'); } catch (e) { }
  try { db.exec('ALTER TABLE process_field_configs ADD COLUMN max_items INTEGER'); } catch (e) { }

  // 迁移字段 key 到全局唯一
  migrateFieldKeysToGlobalUnique();

  // 同步默认字段
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

/**
 * 迁移字段 key 到全局唯一
 * 规则：保留第一个出现的 key 不变，其余改为 "{processType}_{key}"
 */
function migrateFieldKeysToGlobalUnique() {
  try {
    // 检查表结构是否已经是 UNIQUE(key)
    const tableInfo = db.prepare(`
      SELECT sql FROM sqlite_master 
      WHERE type='table' AND name='process_field_configs'
    `).get() as { sql: string } | undefined;
    
    if (tableInfo && tableInfo.sql.includes('UNIQUE(key)') && !tableInfo.sql.includes('UNIQUE(process_type, key)')) {
      console.log('字段 key 已迁移到全局唯一，跳过迁移');
      return;
    }

    console.log('===== 开始迁移字段 key 到全局唯一 =====');
    
    // 获取所有字段配置
    const allFields = db.prepare(`
      SELECT id, process_type, key 
      FROM process_field_configs 
      ORDER BY process_type, id
    `).all() as Array<{ id: string; process_type: string; key: string }>;

    if (allFields.length === 0) {
      console.log('没有字段配置，跳过迁移');
      return;
    }

    // 按 key 分组，找出重复的
    const keyGroups = new Map<string, Array<{ id: string; process_type: string; key: string }>>();
    allFields.forEach(field => {
      if (!keyGroups.has(field.key)) {
        keyGroups.set(field.key, []);
      }
      keyGroups.get(field.key)!.push(field);
    });

    // 找出需要重命名的字段（重复的 key）
    const renameMap = new Map<string, string>(); // fieldId -> newKey

    keyGroups.forEach((fields, key) => {
      if (fields.length > 1) {
        // 保留第一个出现的（按 process_type 排序，dissolution 优先）
        const order = ['dissolution', 'compounding', 'filtration', 'transfer', 'flavorAddition', 'extraction', 'other'];
        const sorted = fields.sort((a, b) => {
          const aIdx = order.indexOf(a.process_type);
          const bIdx = order.indexOf(b.process_type);
          if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
          if (aIdx !== -1) return -1;
          if (bIdx !== -1) return 1;
          return a.process_type.localeCompare(b.process_type);
        });
        
        // 其余的需要重命名
        sorted.slice(1).forEach(field => {
          const newKey = `${field.process_type}_${key}`;
          renameMap.set(field.id, newKey);
          console.log(`  迁移: ${field.process_type}.${key} -> ${newKey}`);
        });
      }
    });

    if (renameMap.size === 0) {
      console.log('没有重复的 key，无需迁移');
      // 但表结构可能还是旧的，需要重建
      rebuildTableWithUniqueKey();
      return;
    }

    // 执行重命名（需要重建表）
    console.log(`需要重命名 ${renameMap.size} 个字段`);
    rebuildTableWithUniqueKey(renameMap);

    console.log('===== 字段 key 迁移完成 =====');
    console.log(`重命名了 ${renameMap.size} 个字段`);
    console.log('========================\n');
  } catch (error: any) {
    console.error('字段 key 迁移失败:', error);
    // 不抛出错误，允许继续运行
  }
}

/**
 * 重建表结构，使用 UNIQUE(key) 约束
 */
function rebuildTableWithUniqueKey(renameMap?: Map<string, string>) {
  // 创建临时表（新结构）
  db.exec(`
    CREATE TABLE IF NOT EXISTS process_field_configs_new (
      id TEXT PRIMARY KEY,
      process_type TEXT NOT NULL,
      key TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      input_type TEXT NOT NULL,
      unit TEXT,
      options TEXT,
      default_value TEXT,
      validation TEXT,
      display_condition TEXT,
      sort_order INTEGER DEFAULT 0,
      is_system INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT,
      item_config TEXT,
      item_fields TEXT,
      fields TEXT,
      min_items INTEGER,
      max_items INTEGER
    )
  `);

  // 复制数据并重命名（如果需要）
  const selectOld = db.prepare(`
    SELECT * FROM process_field_configs
  `);
  const insertNew = db.prepare(`
    INSERT INTO process_field_configs_new (
      id, process_type, key, label, input_type, unit, options,
      default_value, validation, display_condition, sort_order,
      is_system, enabled, created_at, updated_at,
      item_config, item_fields, fields, min_items, max_items
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const oldRows = selectOld.all() as any[];
  oldRows.forEach(row => {
    const newKey = renameMap?.get(row.id) || row.key;
    insertNew.run(
      row.id,
      row.process_type,
      newKey,
      row.label,
      row.input_type,
      row.unit,
      row.options,
      row.default_value,
      row.validation,
      row.display_condition,
      row.sort_order,
      row.is_system,
      row.enabled,
      row.created_at,
      row.updated_at,
      row.item_config,
      row.item_fields,
      row.fields,
      row.min_items,
      row.max_items
    );
  });

  // 删除旧表，重命名新表
  db.exec('DROP TABLE process_field_configs');
  db.exec('ALTER TABLE process_field_configs_new RENAME TO process_field_configs');
  
  // 重建索引
  db.exec('CREATE INDEX IF NOT EXISTS idx_process_type ON process_field_configs(process_type)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_enabled ON process_field_configs(enabled)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_key ON process_field_configs(key)');
}

export { db };

// 字段配置操作
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
  itemConfig?: any;
  itemFields?: any;
  fields?: any;
  minItems?: number;
  maxItems?: number;
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
    updatedAt: row.updated_at,
    itemConfig: row.item_config ? JSON.parse(row.item_config) : undefined,
    itemFields: row.item_fields ? JSON.parse(row.item_fields) : undefined,
    fields: row.fields ? JSON.parse(row.fields) : undefined,
    minItems: row.min_items,
    maxItems: row.max_items
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
            is_system, enabled, created_at, updated_at,
            item_config, item_fields, fields, min_items, max_items
        ) VALUES (
            @id, @processType, @key, @label, @inputType, @unit, @options, 
            @defaultValue, @validation, @displayCondition, @sortOrder, 
            @isSystem, @enabled, @createdAt, @updatedAt,
            @itemConfig, @itemFields, @fields, @minItems, @maxItems
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
    updatedAt: config.updatedAt || new Date().toISOString(),
    itemConfig: config.itemConfig ? JSON.stringify(config.itemConfig) : null,
    itemFields: config.itemFields ? JSON.stringify(config.itemFields) : null,
    fields: config.fields ? JSON.stringify(config.fields) : null,
    minItems: config.minItems || null,
    maxItems: config.maxItems || null
  });
  return result.changes > 0;
}

export function updateFieldConfig(id: string, config: Partial<FieldConfig>): boolean {
  const sets: string[] = [];
  const params: any = { id };
  const validKeys = [
    'processType', 'key', 'label', 'inputType', 'unit', 'options',
    'defaultValue', 'validation', 'displayCondition', 'sortOrder',
    'enabled', 'updatedAt',
    'itemConfig', 'itemFields', 'fields', 'minItems', 'maxItems'
  ]; // isSystem 通常不能更新，created_at 不应更改

  // 将 camelCase 映射到 snake_case 用于数据库
  const dbKeyMap: Record<string, string> = {
    processType: 'process_type',
    inputType: 'input_type',
    defaultValue: 'default_value',
    displayCondition: 'display_condition',
    sortOrder: 'sort_order',
    updatedAt: 'updated_at',
    itemConfig: 'item_config',
    itemFields: 'item_fields',
    fields: 'fields',
    minItems: 'min_items',
    maxItems: 'max_items'
  };

  Object.keys(config).forEach(key => {
    if (validKeys.includes(key)) {
      let value = (config as any)[key];

      // 跳过 undefined 值，避免 SQLite 参数绑定错误
      if (value === undefined) return;

      const dbKey = dbKeyMap[key] || key;
      sets.push(`${dbKey} = @${key}`);

      // 处理 boolean 字段：转换为 0/1
      if (key === 'enabled') {
        value = value ? 1 : 0;
      }
      // 处理 JSON 序列化：正确处理 null 和 undefined
      else if (['options', 'defaultValue', 'validation', 'displayCondition', 'itemConfig', 'itemFields', 'fields'].includes(key)) {
        value = (value !== null && value !== undefined) ? JSON.stringify(value) : null;
      }

      params[key] = value;
    }
  });

  if (sets.length === 0) return false;

  const result = db.prepare(`UPDATE process_field_configs SET ${sets.join(', ')} WHERE id = @id`).run(params);
  return result.changes > 0;
}

export function deleteFieldConfig(id: string): boolean {
  // 检查是否为系统字段
  const current = getFieldConfig(id);
  if (current?.isSystem) return false;

  const result = db.prepare('DELETE FROM process_field_configs WHERE id = ?').run(id);
  return result.changes > 0;
}

