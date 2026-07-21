// Monaco reads its message table while editor modules are evaluated, so this
// side-effect import must stay ahead of every `monaco-editor` import.
import "monaco-editor/nls/lang/zh-cn.js";
