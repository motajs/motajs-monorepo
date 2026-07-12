import { Json2xDataHandler } from "@/fs/Json2xDataHandler";
import type { FileHandler } from "@/fs/FileHandler";
import type { IconsData } from "./iconsService";

const DATA_VAR_NAME = "icons_4665ee12_3a1f_44a4_bea3_0fccba634dc1";

export class IconsDataHandler extends Json2xDataHandler<IconsData> {
  constructor(fileHandler: FileHandler) {
    super(fileHandler, DATA_VAR_NAME, "Icons Data");
  }
}
