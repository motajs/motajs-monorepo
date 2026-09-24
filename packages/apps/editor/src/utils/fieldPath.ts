// SHIM(phase4)
/**
 * 字段路径工具（转发 shim，D-10）——真实实现已下沉至 `@motajs/editor-core` 的 `lib/edit/fieldPath.ts`。
 * 本文件转发 core 根入口的全部九个名字；Phase 11 删除本文件与其余 shim。
 */
export {
  deleteByFieldPath,
  buildFieldPath,
  fieldToDataAttr,
  getByFieldPath,
  getParentField,
  getParentFieldPath,
  getShortField,
  parseFieldPath,
  setByFieldPath,
} from '@motajs/editor-core';
