var Express = require('express');
var express = Express();
var http = require('http');
var server = http.Server(express);
var WebSocket = require('ws');
var WebSocketServer = WebSocket.Server;
var exec = require('child_process').exec;
var fs = require('fs');

var viewAccountName = "elijahparker";
var CLIENT_SERVER_PORT = 80;
var CLIENT_WS_PORT = 8101;

var wss = new WebSocketServer({
    port: CLIENT_WS_PORT
});

var EventEmitter = require("events").EventEmitter;

var app = new EventEmitter();

express.use(Express.static('/home/view/current/frontend/www'));

express.get('/socket/address', function(req, res) {
    var host = req.headers.host;
    var domain = host.split(':')[0];
    res.send({
        address: 'ws://' + domain + ':' + CLIENT_WS_PORT,
        server: 'local'
    });
});

var viewId = null;

wss.broadcast = function broadcast(data) {
    wss.clients.forEach(function each(client) {
        //console.log("client:", client);
        try {
            if (client) client.send(data);
        } catch (err) {
            console.log("broadcast error:", err);
        }
    });
};

wss.on('connection', function connection(ws) {
    ws.on('message', function incoming(message) {
        //console.log('received: %s', message);
        receive_message(message, ws);
    });
});

app.remote = false;
app.authCode = null;
var wsRemote;
var remotePingHandle = null;


function connectRemote() {
    if (app.remote) return;
    wsRemote = new WebSocket('ws://incoming.view.tl/socket/device', {
        headers: {
            'x-view-id': viewId
        }
    });

    wsRemote.on('message', function incoming(message) {
        //if (message.type != "pong") console.log('remote: %s', message);
        if(app.remote) {
            receive_message(message, wsRemote);
        } else {
            try {
                var msg = JSON.parse(message);
                if(msg.connected) {
                    app.remote = true;
                    app.authCode = null;
                    app.emit('auth-complete', app.authCode);
                    console.log("Connected to view.tl");
                    remotePingHandle = setInterval(function() {
                        send_message('ping', null, wsRemote);
                    }, 10000);
                    sendLogs();
                } else if(msg.code) {
                    app.authCode = msg.code;
                    app.emit('auth-required', app.authCode);
                }
            } catch (err) {
                console.log("Error while parsing message:", message, err);
                return;
            }
        }
    });

    wsRemote.once('open', function() {
    });

    wsRemote.once('close', function() {
        if (remotePingHandle) clearInterval(remotePingHandle);
        remotePingHandle = null;
        console.log("Disconnected from view.tl");
        app.remote = false;
        setTimeout(connectRemote);
    });

    wsRemote.once('error', function() {
        if (remotePingHandle) clearInterval(remotePingHandle);
        remotePingHandle = null;
        //console.log("Error connecting to view.tl");
        app.remote = false;
        setTimeout(connectRemote, 15000);
    });
}

// get cpu serial number as unique id for view device
exec('cat /proc/cpuinfo', function(error, stdout, stderr) {
    lines = stdout.split('\n');
    for(var i = 0; i < lines.length; i++) {
        if(lines[i].indexOf('Serial') === 0) {
            var matches = lines[i].match(/: ([0-9a-f]+)/i);
            if(matches.length > 1) {
                viewId = matches[1];
                console.log("VIEW_ID:", viewId);
                connectRemote();
            }
        }
    }
});

function sendLog(logfile, logname, callback) {
    if(app.remote) {
        fs.readFile(logfile, function(err, file) {
            if(!err && file) {
                console.log("sending log file to proxy: ", logfile);
                var obj = {
                    logname: logname,
                    bzip2: file.toString('base64')
                }
                send_message('log', obj, wsRemote);
                callback(null);
            } else {
                console.log("error sending log: ", err);
                callback(null);
            }
        });
    } else {
        callback(true);
    }
}

function sendLogs() {
    if(app.remote) {
        var logs = fs.readdirSync("/home/view/logsForUpload");
        logs = logs.filter(function(log) {
            return log.match(/^log/) ? true : false;
        });

        if(logs && logs.length > 0) {
            var nextLogName = logs.pop();
            var nextLog = "/home/view/logsForUpload/" + nextLogName;
            sendLog(nextLog, function(err) {
                if(!err) {
                    fs.unlink(nextLog, nextLogName, function() {
                        setTimeout(sendLogs, 120 * 1000);
                    });
                }
            });
        }
    }
}

function send_message(type, object, socket) {
    if (!object) object = {};
    if (typeof(type) === "string") {
        object.type = type;
    } else if (typeof(type) === "object" && type.type) {
        object = type;
    }

    var msg_string;
    try {
        msg_string = JSON.stringify(object);
    } catch (err) {
        console.log("Error encoding data to send:", err);
        return;
    }
    try {
        if (socket) {
            socket.send(msg_string);
        } else {
            wss.broadcast(msg_string);
            if (app.remote) wsRemote.send(msg_string);
        }
    } catch (err) {
        console.log("Error sending message:", err);
        return;
    }
}

function receive_message(msg_string, socket) {
    try {
    	var buildReply = function(nMsg, nSocket) {
    		return function(type, object) {
    			if(!object) object = {};
    			object.ack = nMsg.ack;
    			object._cbId = nMsg._cbId;

                send_message(type, object, nSocket);
    		}
    	}

        var msg = JSON.parse(msg_string);
        if (!msg || !msg.type) {
            throw "invalid message: no type set";
        } else if (msg.type == "ping") {
            send_message('pong', {}, socket);
        } else if (msg.type == "pong") {
            // ignoring...
        } else {
        	msg.reply = buildReply(msg, socket);
        	app.emit("message", msg);
        }
    } catch (err) {
        console.log("Error while parsing message:", msg_string, err);
        return;
    }
}

app.send = send_message;
app.sendLogs = sendLogs;

server.listen(CLIENT_SERVER_PORT, function() {
    console.log('listening on *:' + CLIENT_SERVER_PORT);
});

module.exports = app;