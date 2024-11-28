# @motajs/file2x

2.x 游戏数据文件相关的工具

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
