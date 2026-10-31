import { EditorEntryKind, IFileEntry } from '@motajs/editor-core';
import { Button, Spin } from 'antd';
import { Fragment, ReactElement, useEffect, useRef, useState } from 'react';
import { IFileBrowserProps } from './types';
import './file-browser.css';

// 单目录列表 + 面包屑的共用文件浏览器。
// 目录状态由组件自持，面板只提供「读目录 / 过滤 / 打开」三项输入；
// 组件不接触文件系统，也不解释路径含义（D-24 / D-25）。

/** 未指定时使用的 test id 前缀 */
const DEFAULT_TEST_ID_PREFIX = 'file-browser';
/** 空目录的缺省提示文案 */
const DEFAULT_EMPTY_TEXT = '该目录下没有文件';
/** 读取失败的缺省提示文案 */
const DEFAULT_ERROR_TEXT = '目录读取失败，请稍后重试。';
/** 面包屑分隔符，同时也是根目录段的文字 */
const CRUMB_SEPARATOR = '/';

/**
 * 取路径的父目录，根目录下返回空串
 * @param path 完整路径
 * @returns 父目录路径
 */
function parentDirectory(path: string): string {
  const index = path.lastIndexOf('/');

  return index === -1 ? '' : path.slice(0, index);
}

/**
 * 把当前目录按 `/` 切成各级目录名
 * @param directory 当前目录路径；根目录为空串
 * @returns 各级目录名；根目录时为空数组
 */
function directorySegments(directory: string): string[] {
  return directory === '' ? [] : directory.split('/');
}

/**
 * 浏览器的共用渲染逻辑：单目录列表 + 面包屑 + 载入 / 空 / 错误 / 有内容四态
 * @param props 浏览器 props
 * @returns 浏览器元素
 */
export function FileBrowser(props: IFileBrowserProps): ReactElement {
  const prefix = props.testIdPrefix ?? DEFAULT_TEST_ID_PREFIX;
  const [directory, setDirectory] = useState(props.directory);
  const [entries, setEntries] = useState<readonly IFileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);
  const requestRef = useRef(0);
  const loadedDirectoryRef = useRef<string | null>(null);
  const crumbsRef = useRef<HTMLDivElement>(null);
  const loadChildrenRef = useRef(props.loadChildren);

  // 把最新的读目录回调镜像进 ref：既不把回调放进依赖（避免调用方内联函数导致反复重读），
  // 又保证每次真正读目录时用的是最新那个回调
  useEffect(() => {
    loadChildrenRef.current = props.loadChildren;
  });

  useEffect(() => {
    requestRef.current += 1;
    const requestId = requestRef.current;

    if (loadedDirectoryRef.current !== directory) {
      loadedDirectoryRef.current = directory;
      setEntries([]);
      setLoading(true);
      setFailed(false);
    }

    loadChildrenRef.current(directory).then(
      (next): void => {
        if (requestRef.current !== requestId) return;

        setEntries(next);
        setLoading(false);
        setFailed(false);
      },
      (): void => {
        if (requestRef.current !== requestId) return;

        setLoading(false);
        setFailed(true);
      },
    );
  }, [directory, props.reloadToken, reloadCount]);

  // 导航后把面包屑滚到最右端，保证当前目录始终可见
  useEffect(() => {
    const element = crumbsRef.current;

    if (element !== null) element.scrollLeft = element.scrollWidth;
  }, [directory]);

  const requestReload = (): void => {
    setReloadCount((value) => value + 1);
  };

  const retry = (): void => {
    setLoading(true);
    setFailed(false);
    setReloadCount((value) => value + 1);
  };

  const filter = props.filter;
  const renderRowAction = props.renderRowAction;
  const rows: ReactElement[] = [];

  if (directory !== '') {
    rows.push(
      <div className="efb-row-line" key="up">
        <button
          type="button"
          className="efb-row efb-row-directory"
          data-test-id={`${prefix}-up`}
          title="返回上级目录"
          aria-label="返回上级目录"
          onClick={(): void => setDirectory(parentDirectory(directory))}
        >
          ..
        </button>
      </div>,
    );
  }

  for (const entry of entries) {
    if (entry.kind === EditorEntryKind.Directory) {
      rows.push(
        <div className="efb-row-line" key={`dir:${entry.path}`}>
          <button
            type="button"
            className="efb-row efb-row-directory"
            data-test-id={`${prefix}-entry-${entry.path}`}
            title={entry.path}
            onClick={(): void => setDirectory(entry.path)}
          >
            {entry.name}
          </button>
        </div>,
      );
      continue;
    }

    if (filter !== undefined && !filter(entry.path)) continue;

    rows.push(
      <div className="efb-row-line" key={`file:${entry.path}`}>
        <button
          type="button"
          className="efb-row efb-row-file"
          data-test-id={`${prefix}-entry-${entry.path}`}
          title={entry.path}
          onClick={(): void => props.onOpen(entry.path)}
        >
          {entry.name}
        </button>
        {renderRowAction === undefined ? null : (
          <span className="efb-row-action-slot" data-test-id={`${prefix}-row-action-${entry.path}`}>
            {renderRowAction(entry)}
          </span>
        )}
      </div>,
    );
  }

  const segments = directorySegments(directory);
  let body: ReactElement | ReactElement[];

  if (failed) {
    body = (
      <div className="efb-status efb-status-error" data-test-id={`${prefix}-error`}>
        <span>{props.errorText ?? DEFAULT_ERROR_TEXT}</span>
        <Button size="small" autoInsertSpace={false} data-test-id={`${prefix}-retry`} onClick={retry}>
          重试
        </Button>
      </div>
    );
  } else if (loading) {
    body = (
      <div className="efb-status efb-status-loading" data-test-id={`${prefix}-loading`}>
        <Spin size="small" />
        <span>正在读取目录…</span>
      </div>
    );
  } else if (rows.length === 0) {
    body = (
      <div className="efb-status" data-test-id={`${prefix}-empty`}>
        {props.emptyText ?? DEFAULT_EMPTY_TEXT}
      </div>
    );
  } else {
    body = rows;
  }

  return (
    <div className="efb" data-test-id={prefix}>
      <div className="efb-toolbar" data-test-id={`${prefix}-toolbar`}>
        <div className="efb-crumbs" ref={crumbsRef}>
          {directory === '' ? (
            <span
              className="efb-crumb-current"
              aria-current="location"
              data-test-id={`${prefix}-current`}
              title={CRUMB_SEPARATOR}
            >
              {CRUMB_SEPARATOR}
            </span>
          ) : (
            <Fragment>
              <Button
                type="text"
                size="small"
                autoInsertSpace={false}
                className="efb-crumb"
                data-test-id={`${prefix}-crumb-root`}
                title="根目录"
                aria-label="根目录"
                onClick={(): void => setDirectory('')}
              >
                {CRUMB_SEPARATOR}
              </Button>
              {segments.map((segment, index) => {
                const path = segments.slice(0, index + 1).join('/');
                const isCurrent = index === segments.length - 1;
                // 根段已经输出了 `/`，第一个目录段前不再补分隔符
                const separator = index !== 0 && (
                  <span className="efb-crumb-sep" aria-hidden="true">
                    {CRUMB_SEPARATOR}
                  </span>
                );

                return (
                  <Fragment key={path}>
                    {separator}
                    {isCurrent ? (
                      <span
                        className="efb-crumb-current"
                        aria-current="location"
                        data-test-id={`${prefix}-current`}
                        title={path}
                      >
                        {segment}
                      </span>
                    ) : (
                      <Button
                        type="text"
                        size="small"
                        autoInsertSpace={false}
                        className="efb-crumb"
                        data-test-id={`${prefix}-crumb-${path}`}
                        title={path}
                        onClick={(): void => setDirectory(path)}
                      >
                        {segment}
                      </Button>
                    )}
                  </Fragment>
                );
              })}
            </Fragment>
          )}
        </div>
        <button
          type="button"
          className="efb-reload"
          data-test-id={`${prefix}-reload`}
          title="重新加载"
          aria-label="重新加载"
          onClick={requestReload}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M13 8a5 5 0 1 1-1.5-3.6" strokeLinecap="round" />
            <path d="M13 2.5v3h-3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <div className="efb-list" data-test-id={`${prefix}-list`} aria-busy={loading}>
        {body}
      </div>
    </div>
  );
}
