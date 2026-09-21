import { clamp } from 'es-toolkit';
import { useEffect, useRef, useState, type ChangeEvent, type FC, type MouseEvent } from 'react';

interface AudioPreviewProps {
  src: string;
  testId?: string;
}

const formatTime = (time: number) => {
  const minutes = Math.floor(time / 60);
  const seconds = String(Math.floor(time) % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
};

export const AudioPreview: FC<AudioPreviewProps> = ({ src, testId = 'audio-preview' }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [open, setOpen] = useState(false);
  const [pitch, setPitch] = useState('100');
  const [progress, setProgress] = useState(0);
  const [timeText, setTimeText] = useState('0:00 / 0:00');

  useEffect(() => {
    const audio = audioRef.current;
    return () => audio?.pause();
  }, [src]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (open) {
      audio.pause();
      return;
    }
    try {
      await audio.play();
    } catch {
      setOpen(false);
    }
  };

  const handlePitchChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setPitch(next);
    const audio = audioRef.current;
    if (!audio) return;
    audio.preservesPitch = false;
    audio.playbackRate = clamp((parseInt(next, 10) || 100) / 100, 0.3, 3.0);
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio || audio.duration <= 0) return;
    setTimeText(`${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`);
    setProgress(audio.currentTime / audio.duration);
  };

  const handleSeek = (event: MouseEvent<HTMLProgressElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const element = event.currentTarget;
    const value = (event.nativeEvent.offsetX * element.max) / element.offsetWidth;
    setProgress(value);
    audio.currentTime = audio.duration * value;
    if (audio.paused) audio.play();
  };

  return (
    <span data-test-id={testId}>
      <button data-test-id={`${testId}-toggle`} onClick={() => void toggle()} style={{ marginLeft: 10 }}>
        {open ? '暂停' : '播放'}
      </button>
      <small>
        {' '}
        音调：
        <input value={pitch} style={{ width: 28 }} onChange={handlePitchChange} />
      </small>
      {open && (
        <>
          <small style={{ marginLeft: 15 }}>{timeText}</small>
          <br />
          <progress value={progress} max={1} style={{ width: '100%' }} onClick={handleSeek} />
        </>
      )}
      <audio
        ref={audioRef}
        data-test-id={`${testId}-element`}
        preload="metadata"
        src={src}
        onPlay={() => setOpen(true)}
        onPause={() => setOpen(false)}
        onEnded={() => setOpen(false)}
        onTimeUpdate={handleTimeUpdate}
      />
    </span>
  );
};
