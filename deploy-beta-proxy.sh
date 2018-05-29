#/bin/sh

#DATE=`date`
#sed "s/{DATE}/$DATE/g" "./frontend/www/view.template" > ./frontend/www/view.manifest
#rsync -r ./ root@view.tl:/var/www/tlpv2-beta --stats --exclude "node_modules"
rsync -r ./frontend/www/ root@view.tl:/var/www/tlpv2-beta/frontend/www/ --stats --exclude "node_modules"
#ssh root@45.55.94.97 'service view-proxy restart'
