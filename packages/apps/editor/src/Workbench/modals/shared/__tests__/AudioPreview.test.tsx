import { fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AudioPreview } from "../AudioPreview";

describe("AudioPreview", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mounts the audio element before playback and follows media state", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function () {
      this.dispatchEvent(new Event("play"));
      return Promise.resolve();
    });
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function () {
      this.dispatchEvent(new Event("pause"));
    });

    const { container, unmount } = render(<AudioPreview src="blob:test-audio" testId="audio-test" />);
    const audio = container.querySelector<HTMLAudioElement>("[data-test-id='audio-test-element']")!;
    const toggle = container.querySelector<HTMLButtonElement>("[data-test-id='audio-test-toggle']")!;

    expect(audio.getAttribute("src")).toBe("blob:test-audio");
    expect(toggle.textContent).toBe("播放");

    fireEvent.click(toggle);
    await waitFor(() => expect(play).toHaveBeenCalledOnce());
    expect(toggle.textContent).toBe("暂停");

    fireEvent.click(toggle);
    expect(pause).toHaveBeenCalledOnce();
    expect(toggle.textContent).toBe("播放");

    unmount();
    expect(pause).toHaveBeenCalledTimes(2);
  });
});
