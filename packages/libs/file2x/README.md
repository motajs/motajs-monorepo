# @motajs/file2x

2.x 游戏数据文件的纯文本 codec。

- 数据和楼层文件使用 JSON5 读取，并按 mota-js 的 tab 缩进格式写回。
- functions/plugins 使用 Acorn 静态提取函数源码，不执行工程代码。
- 本包不负责文件系统、缓存、恢复或持久化状态。

## GameData2x

```ebnf
GameData2x = ("var" | "let" | "const") JSIdentifier "=" JsonObject [";"]
```

## GameMapData2x

```ebnf
GameMapData2x = "main" "." "floors" "." JSIdentifier "=" JsonObject [";"]
```

## GameScript2x

```ebnf
GameScript2x = "var" JSIdentifier "=" JSObject
```
