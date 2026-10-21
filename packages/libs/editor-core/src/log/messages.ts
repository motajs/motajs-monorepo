import { LogMessages } from './types';

/** editor-core 的集中日志消息表：日志 id 到带 $1、$2 … 占位符的英文模板 */
export const messages: LogMessages = Object.freeze({
  'panel.duplicateId': 'Duplicate panel identifier: $1',
  'panel.notRegistered': 'Panel not registered: $1',
  'panel.callbackFailed': 'Panel callback failed: $1',
  'core.duplicateInitialize': 'EditorCore is already initialized',
  'core.initializeAfterDispose': 'EditorCore cannot be initialized after dispose',
  'system.notInitialized': '$1 system is not initialized',
  'resource.hookFailed': 'Resource update hook failed: $1',
  'log.unknownId': 'Unknown log id: $1',
  'shell.duplicatePanelType': 'Duplicate panel type identifier: $1',
  'shell.panelTypeNotRegistered': 'Panel type not registered: $1',
  'shell.invalidPanelType': 'Invalid panel type registration: $1',
  'shell.instanceCreateFailed': 'Panel instance creation failed: $1',
  'shell.tabNotFound': 'Tab not found: $1',
  'shell.duplicateMenuItem': 'Duplicate menu item identifier: $1',
  'shell.callbackFailed': 'Panel callback failed: $1',
  'shell.beforeCloseFailed': 'Panel close hook failed: $1',
});
