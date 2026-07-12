from enum import unique
from PIL import Image
import os
import zipfile
import re
import random

def compress_tileset(tilesets, floorstr):
    ids = set([int(x) for x in re.findall(r'\d{5,}', floorstr)])
    index = 0
    for tileset in tilesets:
        index += 10000
        image = Image.open(tileset)
        values = [x - index for x in ids if x >= index and x < index + 10000 and x < index + image.width * image.height / 32 / 32]
        if (len(values) == 0):
            image.close()
            Image.new('RGBA', (32, 32), (0, 0, 0, 0)).save(tileset, 'PNG')
            continue
        max_value = max(values)
        width = image.width / 32
        height = max_value // width + 1
        new_image = Image.new('RGBA', (int(image.width), int(32 * height)), (0, 0, 0, 0))
        for value in values:
            x = int(value % width)
            y = int(value // width)
            new_image.paste(image.crop((32 * x, 32 * y, 32 * x + 32, 32 * y + 32)), (32 * x, 32 * y))
        image.close()
        new_image.save(tileset, 'PNG')
        new_image.close()

class _TilesetCompressor(object):

    def __init__(self, root_dir, extension = '.h5data'):
        self.root_dir = root_dir
        self.extension = extension

    def get_list(self, data, prefix):
        index = data.index(prefix) + len(prefix)
        index2 = data.index("]", index)
        return data[index:index2].replace("\"","").replace("'","").split(',')

    def get_tilesets(self):
        if (not os.path.exists(os.path.join(self.root_dir, 'project/project.min.js'))):
            return None
        content = ''
        with open(os.path.join(self.root_dir, 'project/project.min.js'), 'r') as f:
            content = f.read()
        return self.get_list(content, 'tilesets:[')

    def get_floors(self):
        if (not os.path.exists(os.path.join(self.root_dir, 'project/floors.min.js'))):
            return None
        content = ''
        with open(os.path.join(self.root_dir, 'project/floors.min.js'), 'r') as f:
            content = f.read()
        return content

    def zip_file(self, filelist):
        filename = 'tilesets' + self.extension
        if os.path.exists(filename): os.remove(filename)
        zipf = zipfile.ZipFile(filename, 'w', zipfile.ZIP_DEFLATED)
        for f in filelist:
            if not f: continue
            if not os.path.exists(f): continue
            # compress_image(f)
            zipf.write(f)
        zipf.close()

    def work(self):
        tilesets = self.get_tilesets()
        floors = self.get_floors()
        if tilesets is None or len(tilesets) == 0 or floors is None: return
        if not os.path.exists(os.path.join(self.root_dir, 'project/tilesets')): return
        owd = os.getcwd()
        os.chdir(os.path.join(self.root_dir, 'project/tilesets'))
        try:
            compress_tileset(tilesets, floors)
        except: pass
        self.zip_file(tilesets)
        os.chdir(owd)

    # Check floors.min.js

if __name__ == '__main__':
    # _TilesetCompressor('../Downloads/9922/').work()
    dirs = os.listdir("/var/www/html/games")
    for dirname in dirs:
        if dirname == 'template': continue
        dirpath = "/var/www/html/games/%s/" % dirname
        mainjspath = os.path.join(dirpath, "main.js")
        if not os.path.exists(mainjspath): continue
        mainjs = ''
        with open(mainjspath, 'r') as f:
            content = f.read()
            if '.useCompress = true' not in content: continue
        if not os.path.exists(os.path.join(dirpath, 'project/floors.min.js')):  continue
        if not os.path.exists(os.path.join(dirpath, 'project/tilesets/tilesets.h5data')): continue
        print('Working %s...' % dirpath)
        _TilesetCompressor(dirpath).work()
        with open(mainjspath, 'a') as f:
            f.write('main.version = %d;\n' % random.randint(1,10000))
