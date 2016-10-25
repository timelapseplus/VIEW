#!/bin.sh
killall wpa_supplicant
killall hostapd
killall dhclient
rm /run/hostapd.pid
rm /var/run/hostapd/wlan0
ip addr flush dev wlan0
/usr/sbin/hostapd -B -P /run/hostapd.pid /etc/hostapd/hostapd.conf
ip addr add 10.0.0.1/24 dev wlan0
ip route add default via 10.0.0.1