import { useEffect, useMemo, useRef, useState, type FC } from 'react';

import { projectAssets } from '@/project/assets';
import { projectModel, type ProjectImageEntry } from '@/project/model/projectModel';
import { notifyError } from '@/utils/notify';
import { AudioPreview } from '../shared/AudioPreview';
import { ImagePreview } from '../shared/ImagePreview';
import type { SelectMaterialOptions } from '../shared/types';
import { AnimationPreviewEditor } from './AnimationPreviewEditor';

interface SelectMaterialContentProps {
  value: string[];
  directory: string;
  source?: SelectMaterialOptions['source'];
  multiple?: boolean;
  transform?: ((one: string) => string | null) | null;
  onChange: (value: string[]) => void;
}

interface MaterialEntry {
  name: string;
  path: string;
  isImage: boolean;
  isAudio: boolean;
  isAnimate: boolean;
  crop?: ProjectImageEntry['crop'];
}

const isImageFile = (name: string) => /\.(png|jpg|jpeg|gif)$/i.test(name);
const isAudioFile = (name: string) => /\.(mp3|ogg|wav|m4a|flac)$/i.test(name);

function audioMimeType(path: string): string {
  if (/\.ogg$/i.test(path)) return 'audio/ogg';
  if (/\.wav$/i.test(path)) return 'audio/wav';
  if (/\.m4a$/i.test(path)) return 'audio/mp4';
  if (/\.flac$/i.test(path)) return 'audio/flac';
  return 'audio/mpeg';
}

function useAssetUrl(path: string, mime: string): string {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const resource = projectAssets.image(path);
    let currentUrl = '';
    const dispose = resource.subscribe((content) => {
      if (content.status !== 'loaded') return;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      const bytes = new Uint8Array(content.value.bytes);
      currentUrl = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: mime }));
      setUrl(currentUrl);
    });
    void resource.ensureLoaded();
    return () => {
      dispose();
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [mime, path]);
  return url;
}

const AssetImagePreview: FC<{ path: string }> = ({ path }) => {
  const url = useAssetUrl(path, 'image/*');
  return url ? <ImagePreview src={url} /> : <small>正在加载预览...</small>;
};

const CroppedImagePreview: FC<{ path: string; crop: NonNullable<ProjectImageEntry['crop']> }> = ({ path, crop }) => {
  const url = useAssetUrl(path, 'image/*');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!url || !canvasRef.current) return;
    const image = new Image();
    image.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = crop.width;
      canvas.height = crop.height;
      canvas.getContext('2d')?.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
    };
    image.src = url;
  }, [crop.height, crop.width, crop.x, crop.y, url]);
  return (
    <canvas
      data-test-id="select-material-crop-preview"
      ref={canvasRef}
      style={{ display: 'block', maxWidth: '100%' }}
    />
  );
};

const AssetAudioPreview: FC<{ path: string }> = ({ path }) => {
  const url = useAssetUrl(path, audioMimeType(path));
  const name = path.split('/').pop() ?? path;
  return url ? (
    <AudioPreview src={url} testId={`select-material-audio-preview-${name}`} />
  ) : (
    <small>正在加载音频...</small>
  );
};

export const SelectMaterialContent: FC<SelectMaterialContentProps> = ({
  value,
  directory,
  source,
  multiple = true,
  transform,
  onChange,
}) => {
  const [rawEntries, setRawEntries] = useState<string[]>([]);
  const [projectImages, setProjectImages] = useState<ProjectImageEntry[]>([]);
  const [preview, setPreview] = useState<Record<string, boolean>>({});
  const resolvedSource = useMemo<SelectMaterialOptions['source']>(
    () =>
      source ??
      (directory.includes(':images')
        ? { kind: 'project-images', includeLogical: true }
        : directory.includes('animates')
          ? { kind: 'animations' }
          : { kind: 'directory', path: directory }),
    [directory, source],
  );
  const baseDirectory = useMemo(() => {
    const path = resolvedSource?.kind === 'directory' ? resolvedSource.path : directory;
    return path.split(':')[0].replace(/^\.\//, '');
  }, [directory, resolvedSource]);

  useEffect(() => {
    if (resolvedSource?.kind === 'project-images') {
      const resource = projectModel.projectImageCatalog();
      const dispose = resource.subscribe((content) => {
        if (content.status === 'loaded') {
          setProjectImages(
            content.value.entries.filter((entry) => resolvedSource.includeLogical || entry.kind === 'physical'),
          );
        }
        if (content.status === 'error') notifyError(`project/images 不存在：${content.error.message}`);
      });
      void resource.reload();
      return dispose;
    }
    const directoryPath = resolvedSource?.kind === 'animations' ? 'project/animates/' : baseDirectory;
    const resource = projectAssets.directory(directoryPath);
    const dispose = resource.subscribe((content) => {
      if (content.status === 'loaded') setRawEntries(content.value.entries);
      if (content.status === 'error') {
        notifyError(`${baseDirectory}不存在：${content.error.message}`);
        setRawEntries([]);
      }
    });
    void resource.reload();
    return dispose;
  }, [baseDirectory, resolvedSource]);

  const entries = useMemo(() => {
    if (resolvedSource?.kind === 'project-images') {
      return projectImages.flatMap((entry): MaterialEntry[] => {
        const name = transform ? transform(entry.name) : entry.name;
        if (!name) return [];
        return [{ name, path: entry.path, crop: entry.crop, isImage: true, isAudio: false, isAnimate: false }];
      });
    }
    const directoryPath = resolvedSource?.kind === 'animations' ? 'project/animates/' : baseDirectory;
    return rawEntries.flatMap((rawName): MaterialEntry[] => {
      const name = transform ? transform(rawName) : rawName;
      if (!name) return [];
      return [
        {
          name,
          path: `${directoryPath}${rawName}`,
          isImage: isImageFile(rawName),
          isAudio: isAudioFile(rawName),
          isAnimate: /\.animate$/i.test(rawName) || resolvedSource?.kind === 'animations',
        },
      ];
    });
  }, [baseDirectory, projectImages, rawEntries, resolvedSource, transform]);

  const selected = useMemo(() => new Set(value), [value]);
  const handleToggle = (name: string, checked: boolean) => {
    if (!multiple) {
      onChange(checked ? [name] : []);
      return;
    }
    const next = new Set(value);
    if (checked) next.add(name);
    else next.delete(name);
    onChange([...next]);
  };

  return (
    <div data-test-id="select-material-content" style={{ display: 'block', marginTop: -10 }}>
      <div style={{ marginLeft: 10, lineHeight: '25px' }}>
        {multiple && (
          <>
            <button data-test-id="select-material-all" onClick={() => onChange(entries.map((entry) => entry.name))}>
              全选
            </button>
            <button data-test-id="select-material-none" style={{ marginLeft: 10 }} onClick={() => onChange([])}>
              全不选
            </button>
            <br />
          </>
        )}
        {entries.map((entry) => (
          <div key={`${entry.path}:${entry.name}`} style={{ display: 'block' }}>
            <input
              type="checkbox"
              className="materialCheckbox"
              data-test-id={`select-material-${entry.name}`}
              checked={selected.has(entry.name)}
              onChange={(event) => handleToggle(entry.name, event.target.checked)}
            />{' '}
            {entry.name}
            {(entry.isImage || entry.isAnimate) && (
              <button
                data-test-id={`select-material-preview-${entry.name}`}
                style={{ marginLeft: 10 }}
                onClick={() => setPreview((current) => ({ ...current, [entry.name]: !current[entry.name] }))}
              >
                {preview[entry.name] ? '折叠' : '预览'}
              </button>
            )}
            {entry.isAudio && <AssetAudioPreview path={entry.path} />}
            {preview[entry.name] &&
              entry.isImage &&
              (entry.crop ? (
                <CroppedImagePreview path={entry.path} crop={entry.crop} />
              ) : (
                <AssetImagePreview path={entry.path} />
              ))}
            {preview[entry.name] && entry.isAnimate && <AnimationPreviewEditor name={entry.name} path={entry.path} />}
          </div>
        ))}
      </div>
      <p style={{ marginLeft: 10 }}>
        <small>如果文件未在此列表显示，请检查文件名和后缀是否合法。</small>
      </p>
    </div>
  );
};
