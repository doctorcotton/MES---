import Database from 'better-sqlite3';
import { RecipeData } from './types';
import { initialNodes, initialEdges } from '../../src/data/initialData';

const db = new Database('recipe.db');

// 初始化数据库
export function initDatabase() {
  // 创建配方表
  db.exec(`
    CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY,
      metadata TEXT NOT NULL,
      nodes TEXT NOT NULL,
      edges TEXT NOT NULL,
      version INTEGER DEFAULT 1,
      updated_at TEXT NOT NULL,
      updated_by TEXT
    )
  `);

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
      nodes: initialNodes,
      edges: initialEdges,
      version: 1,
      updatedBy: null,
    };

    db.prepare(`
      INSERT INTO recipes (id, metadata, nodes, edges, version, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      defaultRecipe.id,
      JSON.stringify(defaultRecipe.metadata),
      JSON.stringify(defaultRecipe.nodes),
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
    nodes: JSON.parse(row.nodes),
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
    SET metadata = ?, nodes = ?, edges = ?, version = ?, updated_at = ?, updated_by = ?
    WHERE id = ? AND version = ?
  `).run(
    JSON.stringify(data.metadata),
    JSON.stringify(data.nodes),
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
