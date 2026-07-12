# -*- coding: utf-8 -*-

import os
import subprocess
import re

def execute_command(command):
    process = subprocess.Popen(command, shell=True, stdout=subprocess.PIPE)
    stdout, stderr = process.communicate()
    return process.returncode == 0

def upload_bgm(root_file, name):
    sounds_dir = os.path.join(root_file, 'project/bgms/')
    if not os.path.exists(sounds_dir):
        sounds_dir = os.path.join(root_file, 'project/sounds/')
    if not os.path.exists(sounds_dir):
        # print(u'=====> ERROR：sounds目录不存在，无法上传三方BGM。')
        return
    # print(u"====> Starting uploading sounds to third party ...")
    execute_command("ssh -p 1049 ll500@122.51.57.202 'mkdir -p /var/www/html/music/%s'" % name)
    bgms = os.listdir(sounds_dir)
    l = []
    for bgm in bgms:
        if bgm[-4:] not in ['.m4a', '.wma', '.wav', '.mid', '.mp3', '.ogg']:
            # print("%s is an invalid bgm type, ignore ..." % bgm)
            continue
        if not re.match(r'^[-\w.]+$', bgm): continue
        remote_file = '/var/www/html/music/%s/%s' % (name, bgm)
        if execute_command("ssh -p 1049 ll500@122.51.57.202 'test -f %s'" % remote_file):
            pass
            # print("%s already exists in remote, ignore..." % bgm)
        else:
            l.append("'./" + bgm + "'")
    if len(l) > 0:
        owd = os.getcwd()
        try:
            os.chdir(sounds_dir)
            temp_name = '__temp__.tar.gz'
            execute_command('tar -zcvf %s %s' % (temp_name, " ".join(l)))
            remote_file = '/var/www/html/music/%s/%s' % (name, temp_name)
            execute_command("scp -P 1049 %s ll500@122.51.57.202:%s" % (temp_name, remote_file))
            execute_command("ssh -p 1049 ll500@122.51.57.202 'cd /var/www/html/music/%s/ && tar -zxvf %s && rm %s'" % (name, temp_name, temp_name))
            os.remove(temp_name)
            os.chdir(owd)
        except:
            os.chdir(owd)

    # print("====> Upload sounds to third party done.")
    return

if __name__ == '__main__':
    dirs = os.listdir("/var/www/html/games")
    for dirname in dirs:
        dirpath = "/var/www/html/games/%s/" % dirname
        mainjspath = os.path.join(dirpath, "main.js")
        if not os.path.exists(mainjspath):
            continue
        with open(mainjspath, 'r') as f:
            content = f.read()
            if content.find('this.bgmRemoteRoot = "https://h5mota.com/music/";') == -1:
                continue
            if content.find('this.bgmRemote = true;') != -1:
                continue
            if content.find('main.bgmRemote = true;') != -1:
                continue
        upload_bgm(dirpath, dirname)
        with open(mainjspath, 'a') as f:
            f.write('main.bgmRemote = true;\n')
        print(dirname)
