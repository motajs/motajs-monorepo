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
import "codemirror/addon/search/match-highlighter";

// 对话框
import "codemirror/addon/dialog/dialog";
import "codemirror/addon/dialog/dialog.css";

// 代码折叠
import "codemirror/addon/fold/foldcode";

// 代码检查
import "codemirror/addon/lint/lint";
import "codemirror/addon/lint/javascript-lint";
import "codemirror/addon/lint/lint.css";
import { JSHINT } from "jshint";

// Tern 集成
import "tern/plugin/doc_comment";
import "tern/plugin/complete_strings";
import "codemirror/addon/hint/show-hint";
import "codemirror/addon/tern/tern";
import "codemirror/addon/hint/show-hint.css";
import "codemirror/addon/tern/tern.css";

// 编辑器样式
import "@/css/editor.css";

// CodeMirror 5's JavaScript lint addon deliberately looks up JSHINT on the
// browser global instead of importing it. Keep that legacy contract contained
// in this setup module so every CodeMirror surface gets a working lint helper.
const lintGlobal = globalThis as typeof globalThis & { JSHINT?: typeof JSHINT };
lintGlobal.JSHINT = JSHINT;
