import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs/promises';
import fss from 'fs';
import path from 'path';

interface MotaServerPluginOptions {
  motaRoot?: string;
}

export default function motaServerPlugin(options: MotaServerPluginOptions = {}): Plugin {
  const motaRoot = options.motaRoot || process.cwd();

  function resolveFsPath(name: string, allowRoot = false): string {
    if (name.includes('\0') || name.includes('\\') || path.isAbsolute(name)) {
      throw new Error(`Invalid mota-js path: ${name}`);
    }
    const segments = name.split('/');
    if (segments.some((segment) => segment === '.' || segment === '..')) {
      throw new Error(`Invalid mota-js path: ${name}`);
    }
    const result = path.resolve(motaRoot, name);
    const relative = path.relative(motaRoot, result);
    if ((!allowRoot && relative === '') || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error(`Invalid mota-js path: ${name}`);
    }
    return result;
  }

  let needReload = true;
  let hotReloadData = '';
  let watched = false;
  let replayed = false;
  let repStart = 0;
  const listenedFloors: string[] = [];

  // 获取项目名称
  const getProjectName = () => {
    try {
      const data = fss.readFileSync(path.join(motaRoot, 'project/data.js'), 'utf-8');
      const json = JSON.parse(
        data
          .split(/(\n|\r\n)/)
          .slice(1)
          .join('\n'),
      );
      return json.firstData.name;
    } catch {
      return 'mota';
    }
  };

  // 获取POST数据
  async function getPostData(req: IncomingMessage): Promise<string> {
    let data = '';
    return new Promise((resolve) => {
      req.on('data', (chunk: Buffer) => {
        data += chunk.toString();
      });
      req.on('end', () => resolve(data));
    });
  }

  // 解析路径
  async function extract(...dirs: string[]): Promise<string[]> {
    const res: string[] = [];
    const tasks = dirs.map(
      (v) =>
        new Promise<void>((resolve) => {
          if (v.endsWith('/')) {
            const dir = path.join(motaRoot, v.slice(0, -1));
            fs.readdir(dir)
              .then((files) => {
                const all = files.filter((v) => v !== 'thirdparty').map((vv) => v + vv);
                res.push(...all);
                resolve();
              })
              .catch(() => resolve());
          } else if (/\/\*\.\w+$/.test(v)) {
            const suffix = /\.\w+$/.exec(v)![0];
            const d = v.split(`/*${suffix}`)[0];
            const dir = path.join(motaRoot, d);
            fs.readdir(dir)
              .then((files) => {
                const all = files.filter((v) => v.endsWith(suffix)).map((v) => `${d === '' ? '' : d + '/'}${v}`);
                res.push(...all);
                resolve();
              })
              .catch(() => resolve());
          } else {
            res.push(v);
            resolve();
          }
        }),
    );
    await Promise.all(tasks);
    return res;
  }

  // 监听文件变化
  async function watch() {
    const refresh = await extract('main.js', 'index.html', 'libs/');
    const option = { interval: 1000 };

    refresh.forEach((v) => {
      const dir = path.join(motaRoot, v);
      fss.watchFile(dir, option, () => {
        needReload = true;
        console.log(`change: ${v}`);
      });
    });

    const css = await extract('/*.css');
    css.forEach((v) => {
      const dir = path.join(motaRoot, v);
      fss.watchFile(dir, option, () => {
        hotReloadData += `@@css:${v}`;
        console.log(`css hot reload: ${v}`);
      });
    });

    const floors = await extract('project/floors/*.js');
    floors.forEach((v) => {
      watchOneFloor(v.slice(15));
    });

    const scripts = await extract('project/functions.js', 'project/plugins.js');
    scripts.forEach((v) => {
      const dir = path.join(motaRoot, v);
      const type = v.split('/').at(-1)!.slice(0, -3);
      fss.watchFile(dir, option, () => {
        hotReloadData += `@@script:${type}`;
        console.log(`script hot reload: ${type}.js`);
      });
    });

    const datas = (await extract('project/*.js')).filter(
      (v) => !v.endsWith('functions.js') && !v.endsWith('plugins.js'),
    );
    datas.forEach((v) => {
      const dir = path.join(motaRoot, v);
      const type = v.split('/').at(-1)!.slice(0, -3);
      fss.watchFile(dir, option, () => {
        hotReloadData += `@@data:${type}`;
        console.log(`data hot reload: ${type}`);
      });
    });
  }

  function testWatchFloor(url: string) {
    if (/project(\/|\\)floors(\/|\\).*\.js/.test(url)) {
      const f = url.slice(15);
      if (!listenedFloors.includes(f.slice(0, -3))) {
        watchOneFloor(f);
      }
    }
  }

  function watchOneFloor(file: string) {
    if (!/.*\.js/.test(file)) return;
    const f = file.slice(0, -3);
    listenedFloors.push(f);
    const fullPath = path.join(motaRoot, 'project/floors', file);
    fss.watchFile(fullPath, { interval: 1000 }, () => {
      const floorId = f;
      if (hotReloadData.includes(`@@floor:${floorId}`)) return;
      hotReloadData += `@@floor:${floorId}`;
      console.log(`floor hot reload: ${floorId}`);
    });
  }

  return {
    name: 'vite-plugin-mota-server',

    configureServer(server: ViteDevServer) {
      const name = getProjectName();

      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const handleRequest = async () => {
          const rawUrl = req.url || '/';
          const normalizedUrl = rawUrl.replace(`/games/${name}`, '').replace('/all/', '/');
          const parsedUrl = new URL(normalizedUrl, 'http://localhost');
          const pathname = parsedUrl.pathname;

          // GET 请求处理
          if (req.method === 'GET') {
            if (pathname === '/game.html') {
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.end(await fs.readFile(path.join(motaRoot, 'index.html'), 'utf8'));
              return;
            }
            // 处理批量楼层加载
            if (pathname.startsWith('/__all_floors__.js')) {
              const ids = parsedUrl.searchParams.get('id') || '';
              const all = ids.split(',').filter(Boolean);
              const data: Record<string, Buffer> = {};
              const tasks = all.map((v: string) =>
                fs
                  .readFile(path.join(motaRoot, `project/floors/${v}.js`))
                  .then((content) => {
                    data[v] = content;
                  })
                  .catch(() => {}),
              );
              await Promise.all(tasks);
              const result = all.map((v: string) => data[v]).join('\n');
              res.setHeader('Content-Type', 'text/javascript');
              res.end(result);
              return;
            }

            // 处理批量动画加载
            if (pathname.startsWith('/__all_animates__')) {
              const ids = parsedUrl.searchParams.get('id') || '';
              const all = ids.split(',').filter(Boolean);
              const data: Record<string, Buffer> = {};
              const tasks = all.map((v: string) =>
                fs
                  .readFile(path.join(motaRoot, `project/animates/${v}.animate`))
                  .then((content) => {
                    data[v] = content;
                  })
                  .catch(() => {}),
              );
              await Promise.all(tasks);
              const result = all.map((v: string) => data[v]).join('@@@~~~###~~~@@@');
              res.end(result);
              return;
            }
          }

          // POST 请求处理
          if (req.method === 'POST') {
            // 列出目录
            if (pathname === '/listFile') {
              const data = await getPostData(req);
              const params = new URLSearchParams(data);
              const name = params.get('name') || '';
              const dir = resolveFsPath(name, true);
              try {
                const info = await fs.readdir(dir);
                res.end(JSON.stringify(info));
              } catch {
                res.end(`error: Read dir ${dir} fail.`);
              }
              return;
            }

            // 创建目录
            if (pathname === '/makeDir') {
              const data = await getPostData(req);
              const params = new URLSearchParams(data);
              const name = params.get('name') || '';
              const dir = resolveFsPath(name);
              try {
                await fs.mkdir(dir, { recursive: true });
              } catch {
                // 目录可能已存在，忽略错误
              }
              res.end();
              return;
            }

            // 读取文件
            if (pathname === '/readFile') {
              const data = await getPostData(req);
              const params = new URLSearchParams(data);
              const name = params.get('name') || '';
              const dir = resolveFsPath(name);
              try {
                const type = params.get('type') || 'utf8';
                const encoding = type === 'base64' ? 'base64' : 'utf8';
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                const info = await fs.readFile(dir, { encoding });
                res.end(info);
              } catch {
                res.end(`error: File not found: ${name}`);
              }
              return;
            }

            // 写入文件
            if (pathname === '/writeFile') {
              const data = await getPostData(req);
              const params = new URLSearchParams(data);
              const name = params.get('name') || '';
              const dir = resolveFsPath(name);
              try {
                const type = params.get('type') === 'base64' ? 'base64' : 'utf8';
                const value = params.get('value') || '';
                await fs.writeFile(dir, value, { encoding: type });
                testWatchFloor(name);
              } catch {
                res.end(`error: Write file ${dir} fail.`);
              }
              res.end();
              return;
            }

            // 删除文件
            if (pathname === '/deleteFile') {
              const data = await getPostData(req);
              const params = new URLSearchParams(data);
              const name = params.get('name') || '';
              const dir = resolveFsPath(name);
              try {
                await fs.rm(dir);
              } catch {
                res.end(`error: Remove file ${dir} fail.`);
              }
              res.end();
              return;
            }

            // 移动文件
            if (pathname === '/moveFile') {
              const data = await getPostData(req);
              const params = new URLSearchParams(data);
              const srcName = params.get('src') || '';
              const destName = params.get('dest') || '';
              const src = resolveFsPath(srcName);
              const dest = resolveFsPath(destName);
              try {
                const fileData = await fs.readFile(src);
                await fs.writeFile(dest, fileData);
                await fs.rm(src);
              } catch {
                res.end(`error: Move file fail.`);
              }
              res.end();
              return;
            }

            // 批量写入文件
            if (pathname === '/writeMultiFiles') {
              const data = await getPostData(req);
              const params = new URLSearchParams(data);
              const names = (params.get('name') || '').split(';').filter(Boolean);
              const values = (params.get('value') || '').split(';');
              const tasks = names.map((v, i) =>
                fs.writeFile(resolveFsPath(v), values[i], 'base64').then(() => testWatchFloor(v)),
              );
              await Promise.all(tasks);
              res.end();
              return;
            }

            // 重新加载
            if (pathname === '/reload') {
              const data = await getPostData(req);
              if (data === 'test' && !watched) {
                watch();
                watched = true;
                console.log('服务器热重载模块已开始服务');
              }
              res.end(`${needReload}`);
              needReload = false;
              return;
            }

            // 热重载
            if (pathname === '/hotReload') {
              const data = await getPostData(req);
              if (data === 'test' && !watched) {
                watch();
                watched = true;
                console.log('服务器热重载模块已开始服务');
              }
              res.end(hotReloadData);
              hotReloadData = '';
              return;
            }

            // 录像调试初始化
            if (pathname === '/replay') {
              const data = await getPostData(req);
              if (data === 'test' && !replayed) {
                replayed = true;
                const replayDir = path.join(motaRoot, '_replay');
                try {
                  await fs.mkdir(path.join(replayDir, 'status'), { recursive: true });
                  await fs.mkdir(path.join(replayDir, 'save'), { recursive: true });
                } catch {
                  // 目录可能已存在，忽略错误
                }

                try {
                  await fs.readFile(path.join(replayDir, '.info'), 'utf-8');
                } catch {
                  await fs.writeFile(path.join(replayDir, '.info'), '{\n    "cnt": 0\n}', 'utf-8');
                }
                const infoData = fss.readFileSync(path.join(replayDir, '.info'), 'utf-8');
                repStart = Number(JSON.parse(infoData).cnt);
                console.log('服务器录像调试模块已开始服务');
              }
              res.end();
              return;
            }

            // 录像写入
            if (pathname === '/replayWrite') {
              const data = await getPostData(req);
              const n = ++repStart;
              const replayDir = path.join(motaRoot, '_replay');
              await Promise.all([
                fs.writeFile(path.join(replayDir, '.info'), `{\n    "cnt": ${n + 1}\n}`, 'utf-8'),
                fs.writeFile(path.join(replayDir, 'status', `${n}.rep`), data, 'utf-8'),
              ]);
              res.end(n.toString());
              return;
            }

            // 录像检查
            if (pathname === '/replayCheck') {
              const ans = await getPostData(req);
              const [n, data] = ans.split('@-|-@');
              const replayDir = path.join(motaRoot, '_replay');

              const local = (await fs.readFile(path.join(replayDir, 'status', `${n}.rep`), 'utf-8'))
                .split('@---@')
                .map((v) => JSON.parse(v));
              const rep = data.split('@---@').map((v) => JSON.parse(v));

              if (local.length !== rep.length) {
                res.end('false');
                return;
              }

              const check = (a: unknown, b: unknown): boolean => {
                if (a === b) return true;
                if (typeof a !== typeof b) return false;
                if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
                  for (const j in a as Record<string, unknown>) {
                    if (j === 'statistics' || j === 'timeout') continue;
                    if (!check((a as Record<string, unknown>)[j], (b as Record<string, unknown>)[j])) return false;
                  }
                  return true;
                }
                return a === b;
              };

              for (let i = 0; i < local.length; i++) {
                if (!check(local[i], rep[i])) {
                  res.end('false');
                  return;
                }
              }
              res.end('true');
              return;
            }

            // 获取录像状态
            if (pathname === '/replayGet') {
              const ans = Number(await getPostData(req));
              const replayDir = path.join(motaRoot, '_replay');
              const data = await fs.readFile(path.join(replayDir, 'status', `${ans}.rep`));
              res.end(data);
              return;
            }

            // 保存录像存档
            if (pathname === '/replaySave') {
              const data = await getPostData(req);
              const [cnt, save] = data.split('@-|-@');
              if (isNaN(Number(cnt))) {
                res.end('@error: 不合法的录像存档信息');
                return;
              }
              const replayDir = path.join(motaRoot, '_replay');
              await fs.writeFile(path.join(replayDir, 'save', `${cnt}.rep`), save, 'utf-8');
              res.end('success');
              return;
            }

            // 获取录像存档
            if (pathname === '/replayGetSave') {
              const ans = Number(await getPostData(req));
              const replayDir = path.join(motaRoot, '_replay');
              const data = await fs.readFile(path.join(replayDir, 'save', `${ans}.rep`));
              res.end(data);
              return;
            }
          }

          next();
        };

        handleRequest().catch(next);
      });
    },
  };
}
