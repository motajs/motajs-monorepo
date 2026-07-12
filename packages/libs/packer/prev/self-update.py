# -*- coding: utf-8 -*-

from datetime import datetime
from flask import Flask, request, Response, abort
from PIL import Image
import os
import zipfile
import shutil
import json
import requests
import subprocess
import random
import re
import threading
import tempfile
from tileset_compressor import compress_tileset
import time

#
def format_size(size):
    if size < 1024: return "%dB" % size
    if size < 1024 * 1024: return "%.2fKB" % (size / 1024.0)
    return "%.2fMB" % (size / 1024.0 / 1024.0)

def execute_command(command):
    process = subprocess.Popen(command, shell=True, stdout=subprocess.PIPE)
    stdout, stderr = process.communicate()
    return process.returncode == 0

# def upload_bgm(root_file, name):
#     sounds_dir = os.path.join(root_file, 'project/bgms/')
#     if not os.path.exists(sounds_dir):
#         sounds_dir = os.path.join(root_file, 'project/sounds/')
#     if not os.path.exists(sounds_dir):
#         # print(u'=====> ERROR：sounds目录不存在，无法上传三方BGM。')
#         return
#     # print(u"====> Starting uploading sounds to third party ...")
#     execute_command("ssh -p 1049 ll500@122.51.57.202 'mkdir -p /var/www/html/music/%s'" % name)
#     bgms = os.listdir(sounds_dir)
#     l = []
#     for bgm in bgms:
#         if bgm[-4:] not in ['.m4a', '.wma', '.wav', '.mid', '.mp3', '.ogg']:
#             # print("%s is an invalid bgm type, ignore ..." % bgm)
#             continue
#         if not re.match(r'^[-\w.]+$', bgm): continue
#         remote_file = '/var/www/html/music/%s/%s' % (name, bgm)
#         if execute_command("ssh -p 1049 ll500@122.51.57.202 'test -f %s'" % remote_file):
#             pass
#             # print("%s already exists in remote, ignore..." % bgm)
#         else:
#             l.append("'./" + bgm + "'")
#     if len(l) > 0:
#         owd = os.getcwd()
#         try:
#             os.chdir(sounds_dir)
#             temp_name = '__temp__.tar.gz'
#             execute_command('tar -zcvf %s %s' % (temp_name, " ".join(l)))
#             remote_file = '/var/www/html/music/%s/%s' % (name, temp_name)
#             execute_command("scp -P 1049 %s ll500@122.51.57.202:%s" % (temp_name, remote_file))
#             execute_command("ssh -p 1049 ll500@122.51.57.202 'cd /var/www/html/music/%s/ && tar -zxvf %s && rm %s'" % (name, temp_name, temp_name))
#             os.remove(temp_name)
#             os.chdir(owd)
#         except:
#             os.chdir(owd)

#     # print("====> Upload sounds to third party done.")
#     return

def uploadBGM(root_file, name):
    #execute_command("sh /var/www/rsync/music.sh %s" % name)\
    return

def refreshCDN():
    #execute_command("sh /var/www/rsync.sh")
    return


def compress(self, root_file):
    def echo_h1(text: str):
        self.append(text)
    def echo(text: str, intent = 1):
        self.append("    " * intent + text)

    def at(path: str):
        return os.path.join(root_file, path)

    def get_list(data: str, prefix):
        index = data.index(prefix) + len(prefix)
        index2 = data.index("]", index)
        return data[index:index2].replace("\"","").replace("'","").split(',')

    def get_flag(data: str, prefix):
        return data.find(prefix) != -1

    def open_data_file(filepath):
        with open(filepath) as f:
            lines = f.readlines()
            data = json.loads("\n".join(lines[1:]))
        return data
    def minify_core(filename, babel):
        temp_name = os.path.join(self.temp_dir, '__minify_result_%d.js' % (random.randint(1,100000)))
        if babel:
            command = 'npx babel %s --out-file %s' % (filename, temp_name)
        else:
            command = 'java -jar /var/www/self-update/yuicompressor-2.4.8.jar -o %s %s' % (temp_name, filename)
        process = subprocess.Popen(command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd="/var/www/self-update")
        stdout, stderr = process.communicate()
        code = process.returncode
        if code != 0:
            raise Exception(str(stderr) + str(stdout))
        with open(temp_name) as f:
            content = f.read()
        os.remove(temp_name)
        return content

    def minify(filename, babel = False):
        try:
            content = minify_core(filename, babel)
            echo(u"压缩 %s 完毕, size = %s" % (filename, format_size(len(content))))
        except Exception as e:
            raise Exception(u"压缩 %s 失败 log: %s" % (filename, str(e)))
        return content

    def minifymulti(filenames, babel = False):
        temp_name = '__minifymulti_input_%d.js' % (random.randint(1,100000))
        temp_path = os.path.join(self.temp_dir, temp_name)
        echo(u"批量压缩文件：")
        text = ""
        for filename in filenames:
            if not os.path.exists(filename):
                echo(u"!> %s 文件丢失" % filename, intent = 2)
                continue
            with open(filename) as f2:
                filecontent = f2.read()
                text += filecontent + ";\n"
            echo(u"添加文件 %s, size = %s" % (filename, format_size(len(filecontent))), intent = 2)
        with open(temp_path, 'w') as f:
            f.write(text)
            f.close()
        # try wait file write in
        retry_times = 60
        while retry_times > 0:
            if os.path.exists(temp_path):
                break
            time.sleep(1)
            retry_times -= 1
        else:
            raise Exception(u"批量压缩文件失败 - 尝试写入临时文件 %s 失败" % temp_path)
        try:
            content = minify_core(temp_path, babel)
            os.remove(temp_path)
            echo(u"压缩完毕, size = %s" % format_size(len(content)))
        except Exception as e:
            raise Exception(u"批量压缩文件失败 log: %s" % (str(e)))
        return content

    def compress_image(f):
        if os.path.getsize(f) < 256 * 1024: return
        currsize = format_size(os.path.getsize(f))
        f2 = f[:-4] + '.compressed' + f[-4:]
        try:
            if f[-4:] == '.png':
                Image.open(f).convert("P").save(f2)
            elif f[-4:] == '.jpg':
                Image.open(f).save(f2, optimized = True, quality = 30)
            else: return
        except:
            return
        if os.path.exists(f2):
            os.remove(f)
            os.rename(f2, f)
            echo('Crunching %s... %s -> %s' % (f, currsize, format_size(os.path.getsize(f))))

    def zip_file_core(dest: str, filelist, func = None):
        if os.path.exists(dest): os.remove(dest)
        echo("Open zip file %s" % os.path.relpath(dest, root_file))
        zipf = zipfile.ZipFile(dest, 'w', zipfile.ZIP_DEFLATED, compresslevel = 9)
        for (fpath, arcpath) in filelist:
            if not fpath or not arcpath: continue
            if func is not None: fpath = func(fpath)
            if not os.path.exists(fpath): continue
            # compress_image(f)
            zipf.write(fpath, arcpath)
            echo("Add %s, size = %s" % (arcpath, format_size(os.path.getsize(fpath))), intent = 2)
        zipf.close()

    splitChunks = {}

    def zip_file(dir: str, label: str, filelist, func = None):
        if not enableSplitChunks:
            zipname = label + extension
            dest = os.path.join(dir, zipname)
            zip_file_core(dest, [(os.path.join(dir, f), f) for f in filelist], func)
            if (os.path.getsize(dest) > 5 * 1024 * 1024):
                raise Exception(u"游戏资源文件 %s 体积过大，请通知作者开启分块压缩优化" % label)
            return
        threshold = 2 * 1024 * 1024
        chunks = [[]]
        current_chunk_size = 0
        for f in filelist:
            if not f: continue
            fpath = os.path.join(dir, f)
            if not os.path.exists(fpath): continue
            filesize = os.path.getsize(fpath)
            if current_chunk_size + filesize > threshold:
                chunks.append([])
                current_chunk_size = 0
            chunks[-1].append((fpath, f))
            current_chunk_size += filesize
        chunknames = []
        for id, chunk in enumerate(chunks):
            chunkname = label + '-' + str(id) + extension
            zip_file_core(os.path.join(dir, chunkname), chunk, func)
            chunknames.append(chunkname)
        splitChunks[label] = chunknames

    echo_h1(u"# 抽取源信息")
    echo(u"抽取 main.js")
    main = minify(at('main.js'))
    loadlist = get_list(main, "this.loadList=[")
    pureData = get_list(main, "this.pureData=[")
    materialsList = get_list(main, "this.materials=[")
    enableSplitChunks = get_flag(main, "this.enableSplitChunks=true")
    if enableSplitChunks:
        echo(u"启用资源分块压缩")
    echo(u"抽取 project/data.js")
    data = open_data_file(at('project/data.js'))
    mainData = data['main']
    maps = mainData.get('floorIds', [])
    images = mainData.get('images', [])
    if 'hero.png' not in images: images.append('hero.png')
    tilesets = mainData.get('tilesets', [])
    animates = mainData.get('animates', [])
    sounds = mainData.get('sounds', [])
    bgms = mainData.get('bgms', [])
    echo_h1("")

    # compress libs
    echo_h1(u"# 压缩核心文件")
    content = minifymulti([at('libs/%s.js' % one) for one in loadlist], True)
    with open(at('libs/libs.min.js'), 'w') as f:
        f.write(content)
        f.write("if(window.core){core._init_checkLocalForage=function(){core.platform.useLocalForage=true;}}")
    echo_h1(u"======> 所有核心文件已压缩到 libs/libs.min.js")

    extension = '.zip' if 'images.zip' in content else '.h5data'

    # compress project
    echo_h1(u"# 压缩数据文件")
    content = minifymulti([at('project/%s.js' % one) for one in pureData], True)
    with open(at('project/project.min.js'), 'w') as f:
        f.write(content)
    echo_h1(u"======> 所有数据文件已压缩到 project/project.min.js")

    # compress floors
    echo_h1(u"# 压缩地图文件")
    content = minifymulti([at('project/floors/%s.js' % one) for one in maps])
    with open(at('project/floors.min.js'), 'w') as f:
        f.write(content)
    echo_h1(u"======> 所有地图文件已压缩到 project/floors.min.js")

    floorstr = content

    # compress resource
    echo_h1(u"# 压缩游戏资源")
    data = open_data_file(at('project/icons.js'))
    autotiles = (data['autotile'] or {}).keys()
    skipResourcePackage = get_flag(main, "this.skipResourcePackage=true")
    if not os.path.exists(at('libs/thirdparty/zip.min.js')):
        echo_h1(u"======> 未检测到zip.min.js 跳过游戏资源压缩")
    elif skipResourcePackage:
        echo_h1(u"======> skipResourcePackage = true, 跳过游戏资源压缩")
    else:
        echo(u"压缩图片文件")
        zip_file(at('project/images/'), 'images', images)
        echo_h1(u"======> 所有图片文件已压缩")

        materialsDir = at('project/materials/') if os.path.exists(at('project/materials/')) else at('project/images/')
        zip_file(materialsDir, 'materials', [x + ".png" for x in materialsList])

        echo(u"压缩材质图片文件")
        tilesetsDir = at('project/tilesets/') if os.path.exists(at('project/tilesets/')) else at('project/images/')
        echo_h1(u"======> 所有材质图片文件已压缩")
        try:
            compress_tileset(tilesetsDir, tilesets, content + floorstr)
            echo(u"已成功合并额外素材！")
        except: pass
        echo(u"压缩瓦片图片文件")
        zip_file(tilesetsDir, 'tilesets', tilesets)
        echo_h1(u"======> 所有瓦片图片文件已压缩")

        echo(u"压缩自动元件图片文件")
        autotilesDir = at('project/autotiles/') if os.path.exists(at('project/autotiles/')) else at('project/images/')
        zip_file(autotilesDir, 'autotiles', [x.split(':')[0] + '.png' for x in autotiles])
        echo_h1(u"======> 所有自动元件图片文件已压缩")

        echo(u"压缩动画文件")
        zip_file(at('project/animates/'), 'animates', [x + '.animate' for x in animates])
        echo_h1(u"======> 所有动画文件已压缩")

        echo(u"压缩音效文件")
        zip_file(at('project/sounds/'), 'sounds', sounds)
        echo_h1(u"======> 所有音效文件已压缩")

    # remote bgm
    echo_h1(u"# 上传bgm")
    bgm_dir = at('project/bgms/')
    if not os.path.exists(bgm_dir): bgm_dir = at('project/sounds/')
    bgmsize = 0
    for bgm in bgms:
        filename = os.path.join(bgm_dir, bgm)
        if os.path.exists(filename):
            bgmsize += os.path.getsize(filename)
    echo('bgmSize = %s' % format_size(bgmsize))
    bgm_remote = True # bgmsize > 5 * 1024 * 1024:

    # endgame
    echo_h1(u"# 后处理")
    with open(at('main.js'), 'a') as f:
        f.write('\n\nmain.useCompress = true;\n')
        if enableSplitChunks:
            splitChunkMap = { key: ["project/%s/%s" % (key, chunkname) for chunkname in chunks] for key, chunks in splitChunks.items() }
            f.write("main.splitChunkMap = %s;\n" % json.dumps(splitChunkMap))
        # if bgm_remote:
        #     f.write('main.bgmRemote = true;\n')
        f.write('main.version = %d;\n' % random.randint(1,10000))
    echo_h1(u"压缩成功")

class Worker(object):
    def __init__(self, name):
        self.name = name
        self.output = []
        self.code = 0
        self.bgm_remote = False
        self.temp_dir = '_tmp/' + name + '/'
        self.zip_filename = self.temp_dir + name + '.zip'
        self.unzip_dir = self.temp_dir + 'unzipped/'

    def append(self, message):
        self.output.append(u'[%s] %s' % (datetime.now().strftime('%Y-%m-%d %H:%M:%S'), message))

    def get_result(self):
        return json.dumps({'code': self.code, 'message': u'\n'.join(self.output), 'bgm_remote': self.bgm_remote})

    def download(self, url):
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)
        os.makedirs(self.unzip_dir)
        self.append('Downloading zip from ' + url + ' ...')
        try:
            r = requests.get(url, stream=True)
            if r.status_code != 200:
                self.code = 1
                self.append(u'=====> ERROR: 压缩文件不存在！ HTTP code = %d' % r.status_code)
                return False
        except Exception as e:
            self.append(str(e))
            self.append(u'=====> ERROR: 不合法的URL ' + url)
            return False
        with open(self.zip_filename, 'wb') as f:
            r.raw.decode_content = True
            shutil.copyfileobj(r.raw, f)
        self.append('Downloaded zip finished! Write to ' + self.zip_filename)
        return True

    def move_from(self, path):
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)
        os.makedirs(self.unzip_dir)
        self.append("Copy file from %s ..." % path)
        if not os.path.exists(path):
            self.code = 1
            self.append(u'=====> ERROR：压缩文件不存在！路径：%s' % path)
            return False
        shutil.copy(path, self.zip_filename)
        return True

    def unzip(self):
        # Verify it's a valid zip
        self.append('Starting unzip ' + self.zip_filename + ' ...')
        try:
            zip_file = zipfile.ZipFile(self.zip_filename, "r")
            for one in zip_file.namelist():
                try:
                    utf8name = one.decode('gbk')
                except:
                    utf8name = one
                if utf8name.endswith(".php"):
                    self.code = 3
                    self.append(u'=====> ERROR: 发现存在php文件： %s' % utf8name)
                    return False
                pathname = os.path.join(self.unzip_dir, os.path.dirname(utf8name))
                filename = os.path.join(pathname, os.path.basename(utf8name))
                if not os.path.exists(pathname) and pathname!= "":
                    os.makedirs(pathname)
                if not os.path.exists(filename):
                    with open(filename, 'wb') as f:
                        f.write(zip_file.read(one))
                self.append(u"Extracting file " + utf8name + ", size = " + format_size(os.path.getsize(filename)))
            zip_file.close()
        except Exception as e:
            self.code = 2
            self.append(str(e))
            self.append(u'=====> ERROR: 不是有效的的zip文件!')
            return False
        return True

    def get_root_file(self):
        if not os.path.exists(self.unzip_dir):
            self.code = 4
            self.append(u'=====> ERROR: 解压目录不存在！')
            return False
        root_files = os.listdir(self.unzip_dir)
        if len(root_files) != 1:
            self.code = 4
            self.append(u'=====> ERROR: 不合法的目录结构：是否是对塔目录进行的压缩？')
            return False
        self.root_file = os.path.join(self.unzip_dir, root_files[0])
        if root_files[0] != self.name:
            os.rename(self.root_file, os.path.join(self.unzip_dir, self.name))
            self.root_file = os.path.join(self.unzip_dir, self.name)
        return True

    def verify(self):
        self.append('Starting verifing unzipped files ...')

        if not self.get_root_file(): return False
        root_file = self.root_file
        self.append('Root directory: ' + root_file)

        # if os.path.exists(os.path.join(root_file, '_saves')):
        #     self.code = 4
        #     self.append(u'=====> ERROR: 检测到存在_saves文件夹，这会导致你的测试存档被泄露。')
        #     self.append(u'=====> ERROR: 请打包前备份并删除_saves文件夹，再重新上传。')
        #     return False

        self.append('Unzip finished!')

        for d in [".git", ".idea", "_docs", "docs", "_saves", u"常用工具"]:
            if os.path.exists(os.path.join(root_file, d)):
                shutil.rmtree(os.path.join(root_file, d))
                self.append(u'Removing dir: %s' % os.path.join(root_file, d))
        for f in os.listdir(root_file):
            if f.endswith(".txt") or f.endswith(".url") or f.endswith(".exe") or f.endswith(".md"):
                os.remove(os.path.join(root_file, f))
                self.append(u'Removing file: %s' % os.path.join(root_file, f))

        # Verify main.js
        main_file = os.path.join(root_file, 'main.js')
        if not os.path.exists(main_file):
            self.code = 4
            self.append(u'=====> ERROR: main.js不存在；是否多套了一层？')
            return False
        # Verify compress
        if os.path.exists(os.path.join(root_file, 'project')):
            useCompress = True
            # with open(main_file) as f:
            #     if 'useCompress = true' not in f.read(): useCompress = False
            if True: # not useCompress:
                self.append(u'======> 当前JS代码未压缩，尝试进行JS压缩...')
                try:
                    compress(self, root_file)
                except Exception as e:
                    self.code = 4
                    self.append(u"无法压缩JS文件，请本地手动压缩再上传。")
                    self.append(str(e))
                    return False
        # Verify bgm_remote
        with open(main_file) as f:
            if 'bgmRemote = true' in f.read():
                self.append('Found bgm_remote = true')
                self.bgm_remote = True

        # Verify project/data.js
        data_file = os.path.join(root_file, 'project/data.js')
        if not os.path.exists(data_file):
            self.code = 4
            self.append(u'=====> ERROR: project/data.js不存在；是否多套了一层？')
            return False
        with open(data_file) as f:
            lines = f.readlines()
            try:
                data = json.loads("\n".join(lines[1:]))
                dataname = data["firstData"]["name"]
                if dataname == 'template':
                    self.code = 6
                    self.append(u'=====> ERROR：全塔属性中的name值为template！')
                    return False
                if dataname != self.name:
                    self.code = 6
                    self.append(u'=====> ERROR：全塔属性中的name和期望的不一致！期望值：%s，实际值：%s' % (self.name, dataname))
                    return False
            except Exception as e:
                self.code = 5
                self.append(str(e))
                self.append(u'=====> ERROR：不合法的data.js文件！请用编辑器编辑并保存。')
                return False

        self.append('Verify succeeded!')
        return True

    def work(self):
        if self.code != 0: return False
        if not self.unzip(): return False
        if not self.verify(): return False
        self.append('Success.')
        return True

    def execute_command(self, command):
        self.append('$> ' + command)
        process = subprocess.Popen(command, shell=True, stdout=subprocess.PIPE)
        stdout, stderr = process.communicate()
        code = process.returncode
        self.append(stdout)
        self.append(stderr)
        return code == 0

    def move(self, to, bgm_remote = False):
        if not to: return False
        if not self.get_root_file(): return False
        self.bgm_remote = bgm_remote

        # self.append("Backup zip file to /data/towers_tmp/ ...")
        # shutil.copy(self.zip_filename, '/data/towers_tmp/' + self.name + '.zip')
        self.append("Move zip file to directory ...")
        shutil.move(self.zip_filename, os.path.join(self.root_file, self.name + '.zip'))

        destination = to
        if os.path.exists(destination):
            self.append('Removing items in games ...')
            shutil.rmtree(destination)
        self.append("Move to " + destination)
        shutil.move(self.root_file, destination)
        shutil.rmtree(self.temp_dir)
        if bgm_remote:
            threading.Thread(target = uploadBGM, args = (destination, self.name)).start()
        threading.Thread(target = refreshCDN).start()
        self.append('Success.')
        return True

    def upload_temp(self, src, dest):
        self.append('upload from %s to %s' % (src, dest))
        execute_command("scp -P 1049 %s ubuntu@182.254.227.113:%s" % (src, dest))
        self.append('Success.')
        return True

app = Flask(__name__)

@app.route('/unzip', methods=['GET', 'POST'])
def unzip():
    args = request.form if request.method == 'POST' else request.args
    worker = Worker(args.get('name', ''))
    worker.move_from(args.get('path'))
    worker.work()
    return Response(worker.get_result(), mimetype='application/json')

@app.route('/download', methods=['GET', 'POST'])
def download():
    args = request.form if request.method == 'POST' else request.args
    worker = Worker(args.get('name', ''))
    worker.download(args.get('url'))
    worker.work()
    return Response(worker.get_result(), mimetype='application/json')

@app.route('/move', methods=['GET', 'POST'])
def move():
    args = request.form if request.method == 'POST' else request.args
    worker = Worker(args.get('name', ''))
    worker.move(args.get('to', ''), args.get('bgm_remote') == '1')
    return Response(worker.get_result(), mimetype='application/json')

@app.route('/upload_temp', methods=['GET', 'POST'])
def upload_temp():
    args = request.form if request.method == 'POST' else request.args
    worker = Worker(args.get('name', ''))
    worker.upload_temp(args.get('from', ''), args.get('to', ''))
    return Response(worker.get_result(), mimetype='application/json')

if __name__ == '__main__':
    app.run(host="127.0.0.1", port=5058, debug=False)
