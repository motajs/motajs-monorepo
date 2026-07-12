cd /var/www/self-update
if [ -e ".pid" ]; then
    kill -9 `cat .pid`
    rm ./.pid
fi
nohup python self-update.py > log.txt 2>&1 & echo $! > .pid
