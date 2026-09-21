import { useCallback, useEffect, useMemo, type FC, type ReactNode } from 'react';
import { SelectFloorModalActionProvider, useSelectFloorModal } from './SelectFloor';
import { CheckboxSetModalActionProvider, useCheckboxSetModal } from './CheckboxSet';
import { usePreviewUIModal } from './PreviewUI';
import { useSearchFlagsModal } from './SearchFlags';
import { useStatusBarPreviewModal } from './StatusBarPreview';
import { SelectMaterialModalActionProvider, useSelectMaterialModal } from './SelectMaterial';
import { SelectPointModalActionProvider, useSelectPointModal } from './SelectPoint';
import { setPointPickerCapability } from '@/blockly/fields/FieldPoint/openPointPicker';
import { BlocklyCapabilitiesProvider } from '@/Workbench/EventsEditor/BlocklyCapabilitiesContext';
import { useCodeEditor, useCodeEditorPreviewRegistration } from '@/Workbench/CodeEditor/CodeEditorContext';
import type { MaterialKind } from '@/blockly/registry';
import { notifyError, notifySuccess } from '@/utils/notify';
import { projectData } from '@/project/data/projectData';

interface ModalsProviderProps {
  children?: ReactNode;
}

export const ModalsProvider: FC<ModalsProviderProps> = ({ children }) => {
  const [openSelectFloor, selectFloorHolder] = useSelectFloorModal();
  const [openCheckboxSet, checkboxSetHolder] = useCheckboxSetModal();
  const [openPreviewUI, previewUIHolder] = usePreviewUIModal();
  const [openSearchFlags, searchFlagsHolder] = useSearchFlagsModal();
  const [openStatusBarPreview, statusBarPreviewHolder] = useStatusBarPreviewModal();
  const [openSelectMaterial, selectMaterialHolder] = useSelectMaterialModal();
  const [openSelectPoint, selectPointHolder] = useSelectPointModal();
  const codeEditor = useCodeEditor();
  const registerCodeEditorPreview = useCodeEditorPreviewRegistration();

  useEffect(
    () =>
      registerCodeEditorPreview(async (mode, value) => {
        if (mode === 'statusBar') await openStatusBarPreview({ code: value });
      }),
    [openStatusBarPreview, registerCodeEditorPreview],
  );

  const materialDirectory = useCallback((kind: MaterialKind): string => {
    if (kind === 'image' || kind === 'hero') return 'project/images/';
    if (kind === 'animate') return 'project/animates/';
    if (kind === 'bgm') return 'project/bgms/';
    if (kind === 'sound') return 'project/sounds/';
    if (kind === 'tileset') return 'project/tilesets/';
    return 'project/autotiles/';
  }, []);

  const blocklyCapabilities = useMemo(
    () => ({
      editText: (request: { contextId: string; value: string; lint?: boolean }) =>
        new Promise<string | null>((resolve) => {
          codeEditor.open({
            contextId: request.contextId,
            initialValue: request.value,
            lint: request.lint,
            onConfirm: (value) => resolve(value),
            onCancel: () => resolve(null),
          });
        }),
      selectPoint: openSelectPoint,
      selectMaterial: (request: {
        title: string;
        value?: string[];
        kind: MaterialKind;
        multiple?: boolean;
        transform?: 'strip-animate-extension';
        aliasPolicy?: 'preserve' | 'prefer-alias' | 'physical-name';
      }) => {
        const tower = projectData.tower().content();
        const nameMap = tower.status === 'loaded' ? ((tower.value.main.nameMap ?? {}) as Record<string, string>) : {};
        const initialValue = request.value?.map((name) => nameMap[name] ?? name);
        return openSelectMaterial({
          title: request.title,
          value: initialValue,
          directory: materialDirectory(request.kind),
          source:
            request.kind === 'image' || request.kind === 'hero'
              ? { kind: 'project-images', includeLogical: true }
              : request.kind === 'animate'
                ? { kind: 'animations' }
                : { kind: 'directory', path: materialDirectory(request.kind) },
          multiple: request.multiple ?? false,
          transform:
            request.transform === 'strip-animate-extension' ? (name: string) => name.replace(/\.animate$/i, '') : null,
        }).then((result) => {
          if (!result || request.aliasPolicy === 'physical-name') return result;
          return result.map((name) => {
            if (request.aliasPolicy === 'preserve') {
              const current = request.value?.find((value) => nameMap[value] === name);
              if (current) return current;
            }
            if (request.aliasPolicy === 'prefer-alias') {
              return Object.entries(nameMap).find(([, physical]) => physical === name)?.[0] ?? name;
            }
            return name;
          });
        });
      },
      preview: async (result: import('@/blockly/interactions/previewModel').BlocklyPreviewResult) => {
        const list = result.staticPreview;
        const event = result.runtimeRequest?.event;
        const runtimeList =
          list.length > 0
            ? list
            : typeof event === 'string' || (event != null && typeof event === 'object')
              ? [event as import('./shared/types').UIData]
              : [];
        if (runtimeList.length) await openPreviewUI({ list, runtimeList });
        else result.diagnostics.forEach((item) => notifyError(item.message));
      },
      searchFlags: async () => {
        await openSearchFlags({});
      },
      confirm: async (message: string) => window.confirm(message),
      report: (message: string, level: 'error' | 'warning' | 'info' = 'info') => {
        if (level === 'error') notifyError(message);
        else notifySuccess(message);
      },
    }),
    [codeEditor, materialDirectory, openPreviewUI, openSearchFlags, openSelectMaterial, openSelectPoint],
  );

  useEffect(() => {
    setPointPickerCapability(openSelectPoint);
    return () => setPointPickerCapability(null);
  }, [openSelectPoint]);

  return (
    <SelectFloorModalActionProvider open={openSelectFloor}>
      <SelectPointModalActionProvider open={openSelectPoint}>
        <SelectMaterialModalActionProvider open={openSelectMaterial}>
          <CheckboxSetModalActionProvider open={openCheckboxSet}>
            <BlocklyCapabilitiesProvider value={blocklyCapabilities}>{children}</BlocklyCapabilitiesProvider>
          </CheckboxSetModalActionProvider>
        </SelectMaterialModalActionProvider>
      </SelectPointModalActionProvider>
      {selectFloorHolder}
      {checkboxSetHolder}
      {previewUIHolder}
      {searchFlagsHolder}
      {statusBarPreviewHolder}
      {selectMaterialHolder}
      {selectPointHolder}
    </SelectFloorModalActionProvider>
  );
};
