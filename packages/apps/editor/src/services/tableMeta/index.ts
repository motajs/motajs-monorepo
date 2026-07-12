/**
 * TableMeta Service 模块导出
 */

// ==================== 底层服务 ====================
export {
  tableMetaService,
  loadTableMetaFile,
  saveTableMetaFile,
  META_FILE_CONFIG,
  VALID_META_FILE_KEYS,
  type MetaFileKey,
  type MetaFileConfig,
} from './tableMetaService';

// ==================== DataHandler ====================
export { TableMetaDataHandler } from './TableMetaDataHandler';
