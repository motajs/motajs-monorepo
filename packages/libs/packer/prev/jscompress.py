# -*- coding: utf-8 -*-

import os
import subprocess
import zipfile
import shutil
import random
from PIL import Image

def format_size(size):
    if size < 1024: return "%dB" % size
    if size < 1024 * 1024: return "%.2fKB" % (size / 1024.0)
    return "%.2fMB" % (size / 1024.0 / 1024.0)

def compress(self, root_file):
    def get_list(data, prefix):
        index = data.index(prefix) + len(prefix)
        index2 = data.index("]", index)
        return data[index:index2].replace("\"","").replace("'","").split(',')
    def minify(filename):
        temp_name = '__temp__.txt'
        command = 'java -jar yuicompressor-2.4.8.jar -o %s %s' % (temp_name, filename)
        process = subprocess.Popen(command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        stdout, stderr = process.communicate()
        code = process.returncode
        if code != 0:
            raise Exception(stderr)
        with open(temp_name) as f:
            content = f.read()
        os.remove(temp_name)
        return content
    def minifymulti(filenames):
        temp_name = '__temp__.js'
        with open(temp_name, 'w') as f:
            for filename in filenames:
                if not os.path.exists(filename): continue
                with open(filename) as f2:
                    f.write(f2.read()+";\n")
        content = minify(temp_name)
        os.remove(temp_name)
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
            self.append('Crunching %s... %s -> %s' % (f, currsize, format_size(os.path.getsize(f))))
    def zip_file(filename, filelist, func = None):
        if os.path.exists(filename): os.remove(filename)
        zipf = zipfile.ZipFile(filename, 'w', zipfile.ZIP_DEFLATED)
        for f in filelist:
            if not f: continue
            if func is not None: f = func(f)
            if not os.path.exists(f): continue
            compress_image(f)
            zipf.write(f)
            self.append("Compressing %s to %s... size = %s" % (f, filename, format_size(os.path.getsize(f))))
        zipf.close()

    main = minify(os.path.join(root_file, 'main.js'))
    # compress libs
    loadlist = get_list(main, "this.loadList=[")
    materialsList = get_list(main, "this.materials=[")
    content = ''
    # for one in loadlist:
    #     content += minify(os.path.join(root_file, 'libs/%s.js' % one))
    content = minifymulti([os.path.join(root_file, 'libs/%s.js' % one) for one in loadlist])
    with open(os.path.join(root_file, 'libs/libs.min.js'), 'w') as f:
        f.write(content)
    self.append(u"======> 所有核心文件已压缩到 libs/libs.min.js。")
    extension = '.zip' if 'images.zip' in content else '.h5data'
    # compress project
    loadlist = get_list(main, "this.pureData=[")
    content = minifymulti([os.path.join(root_file, 'project/%s.js' % one) for one in loadlist])
    # content = ''
    for one in ['data', 'icons']:
        data = minify(os.path.join(root_file, 'project/%s.js' % one))
        # content += data
        if one == 'data':
            maps = get_list(data, 'floorIds:[')
            images = get_list(data, 'images:[')
            if 'hero.png' not in images: images.append('hero.png')
            tilesets = get_list(data, 'tilesets:[')
            animates = get_list(data, 'animates:[')
            sounds = get_list(data, 'sounds:[')
            bgms = get_list(data, 'bgms:[')
        if one == 'icons':
            index = data.index('autotile:{') + 10
            index2 = data.index('}', index)
            autotiles = data[index:index2].replace("\"","").replace("'","").split(',') if index2 > 0 else []
    with open(os.path.join(root_file, 'project/project.min.js'), 'w') as f:
        f.write(content)
    self.append(u"======> 所有核心文件已压缩到 project/project.min.js。")
    # compress floors
    content = minifymulti([os.path.join(root_file, 'project/floors/%s.js' % one) for one in maps])
    # content = ''
    # for one in maps:
    #     content += minify(os.path.join(root_file, 'project/floors/%s.js' % one))
    with open(os.path.join(root_file, 'project/floors.min.js'), 'w') as f:
        f.write(content)
    self.append(u"======> 所有地图文件已压缩到 project/floors.min.js。")
    owd = os.getcwd()
    # compress data
    if os.path.exists(os.path.join(root_file, 'libs/thirdparty/zip.min.js')):
        os.chdir(os.path.join(root_file, 'project/images/'))
        zip_file('images' + extension, images)
        self.append(u"======> 所有图片文件已压缩。")
        if os.path.exists('../materials/'): os.chdir('../materials/')
        zip_file('materials' + extension, materialsList, lambda x: x + ".png")
        self.append(u"======> 所有材质图片文件已压缩。")
        if os.path.exists('../tilesets/'): os.chdir('../tilesets/')
        zip_file('tilesets' + extension, tilesets)
        self.append(u"======> 所有瓦片图片文件已压缩。")
        if os.path.exists('../autotiles/'): os.chdir('../autotiles/')
        zip_file('autotiles' + extension, autotiles, lambda x: x.split(':')[0] + '.png')
        self.append(u"======> 所有自动元件图片文件已压缩。")
        os.chdir('../animates/')
        zip_file('animates' + extension, animates, lambda x: x + '.animate')
        self.append(u"======> 所有动画文件已压缩。")
        os.chdir('../sounds/')
        zip_file('sounds' + extension, sounds)
        self.append(u"======> 所有音效文件已压缩。")
        os.chdir(owd)
    # compress success...
    bgm_dir = os.path.join(root_file, 'project/bgms/')
    if not os.path.exists(bgm_dir): bgm_dir = os.path.join(root_file, 'project/sounds/')
    bgmsize = 0
    for bgm in bgms:
        filename = os.path.join(bgm_dir, bgm)
        if os.path.exists(filename):
            bgmsize += os.path.getsize(filename)
    with open(os.path.join(root_file, 'main.js'), 'a') as f:
        f.write('\n\nmain.useCompress = true;\n')
        self.append('bgmSize = %s' % format_size(bgmsize))
        if bgmsize > 10 * 1024 * 1024:
            f.write('main.bgmRemote = true;\n')
        f.write('main.version = %d;\n' % random.randint(1,10000))
    self.append(u"压缩成功。")

class Test:
    def __init__(self):
        pass

    def append(self, message):
        print(message)

    def run(self, path):
        compress(self, path)

if __name__ == '__main__':
    Test().run('../Downloads/9922/')
