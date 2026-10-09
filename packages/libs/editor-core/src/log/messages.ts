import { LogMessages } from './types';

/** editor-core 的集中日志消息表：日志 id 到带 $1、$2 … 占位符的英文模板 */
export const messages: LogMessages = Object.freeze({
  'panel.duplicateId': 'Duplicate panel identifier: $1',
  'system.notInitialized': '$1 system is not initialized',
  'resource.hookFailed': 'Resource update hook failed: $1',
  'log.unknownId': 'Unknown log id: $1',
});
