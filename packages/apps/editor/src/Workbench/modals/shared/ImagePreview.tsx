import type { FC } from "react";

interface ImagePreviewProps {
  src: string;
}

export const ImagePreview: FC<ImagePreviewProps> = ({ src }) => (
  <img src={src} style={{ display: "block", maxWidth: "100%" }} />
);
