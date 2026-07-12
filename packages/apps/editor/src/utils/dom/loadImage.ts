import { tapAsync } from "../base/tapAsync";
import { listenOnce } from "./listen";

export const loadImage = async (src: string) => {
  const image = document.createElement('img');
  await tapAsync(listenOnce(image, 'load'), () => image.src = src);
  return image;
};
