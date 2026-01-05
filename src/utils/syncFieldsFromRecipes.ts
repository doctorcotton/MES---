import { extractFieldsFromRecipes } from './fieldExtractor';
import { initialProcesses } from '../data/initialData';
import { PROCESS_TYPE_FIELDS } from '../types/processTypeConfig';
import { db, createFieldConfig, getFieldConfig, updateFieldConfig } from '../../server/src/db';
import { v4 as uuidv4 } from 'uuid';
import { ProcessType } from '../types/recipe';

export function syncFieldsFromRecipes() {
    console.log('Starting field synchronization...');

    // Ensure table exists
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

    // 1. Extract used fields from data
    const extractedFields = extractFieldsFromRecipes(initialProcesses);
    console.log(`Extracted ${extractedFields.length} unique fields from usage.`);

    // 2. Map existing hardcoded config for metadata (labels, options, validation)
    // We treat PROCESS_TYPE_FIELDS as the "Golden Master" for metadata if available

    let syncedCount = 0;
    let newCount = 0;

    extractedFields.forEach(field => {
        const { processType, key, inferredType, unit } = field;

        // Find if we have a hardcoded definition
        const hardcodedConfig = PROCESS_TYPE_FIELDS[processType]?.find(f => f.key === key);

        const fieldId = `${processType}_${key}`; // Deterministic ID for sync

        const existingDBField = db.prepare('SELECT * FROM process_field_configs WHERE process_type = ? AND key = ?').get(processType, key);

        const label = hardcodedConfig?.label || key; // Fallback to key if no label
        const inputType = hardcodedConfig?.inputType || inferredType;
        const options = hardcodedConfig?.options;
        const defaultValue = hardcodedConfig?.defaultValue;
        const isRequired = hardcodedConfig?.required || false;

        // Construct the config object
        const configToSave = {
            id: existingDBField ? (existingDBField as any).id : uuidv4(),
            processType,
            key,
            label,
            inputType,
            unit: hardcodedConfig?.unit || unit,
            options,
            defaultValue,
            validation: { required: isRequired },
            displayCondition: undefined, // Logic for this is complex to extract, leave undefined for now or manually map if needed
            sortOrder: 0, // Could try to infer order from appearance
            isSystem: true,
            enabled: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        if (existingDBField) {
            // Update? Maybe only if missing info?
            // For now, let's update strict fields to ensure sync
            // console.log(`Updating existing field: ${processType}.${key}`);
            // updateFieldConfig(configToSave.id, configToSave);
            syncedCount++;
        } else {
            console.log(`Creating new field: ${processType}.${key}`);
            createFieldConfig(configToSave);
            newCount++;
        }
    });

    // 3. Also sync fields that are defined in PROCESS_TYPE_FIELDS but maybe NOT currently used in initialData
    // (To ensure complete menu of available fields)
    Object.entries(PROCESS_TYPE_FIELDS).forEach(([pType, fields]) => {
        const processType = pType as ProcessType;
        fields.forEach(field => {
            const existingDBField = db.prepare('SELECT * FROM process_field_configs WHERE process_type = ? AND key = ?').get(processType, field.key);
            if (!existingDBField) {
                console.log(`Creating configuration-only field: ${processType}.${field.key}`);
                createFieldConfig({
                    id: uuidv4(),
                    processType,
                    key: field.key,
                    label: field.label,
                    inputType: field.inputType,
                    unit: field.unit,
                    options: field.options,
                    defaultValue: field.defaultValue,
                    validation: { required: field.required },
                    sortOrder: 0,
                    isSystem: true,
                    enabled: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
                newCount++;
            }
        });
    });

    console.log(`Sync complete. Synced: ${syncedCount}, Created: ${newCount}`);
}

// Execute if run directly
import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    syncFieldsFromRecipes();
}
