/**
 * CodeMirror 和 Tern 的初始化导入
 *
 * 包含所有必要的 addon、mode 和 CSS
 * 从 setupEditor.ts 迁移而来
 */

// CodeMirror 核心
import "codemirror/lib/codemirror.css";

// JavaScript 模式
import "codemirror/mode/javascript/javascript";

// 注释功能
import "codemirror/addon/comment/comment";

// 搜索功能
import "codemirror/addon/search/search";
import "codemirror/addon/search/searchcursor";

// 对话框
import "codemirror/addon/dialog/dialog";
import "codemirror/addon/dialog/dialog.css";

// 代码折叠
import "codemirror/addon/fold/foldcode";

// 代码检查
import "codemirror/addon/lint/lint";

// Tern 集成
import "tern/plugin/doc_comment";
import "tern/plugin/complete_strings";
import "codemirror/addon/tern/tern";

// 编辑器样式
import "@/css/editor.css";
