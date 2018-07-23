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
var internalEvent = new EventEmitter();
app.remoteEnabled = false;

fs.writeFile("/proc/sys/net/ipv4/tcp_low_latency", "0"); // favor low latency over high throughput (reversed now to support high-throughput for LV)

express.use(Express.static('/home/view/current/frontend/www'));

express.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, access-control-allow-origin, x-view-session");
  next();
});

express.get('/socket/address', function(req, res) {
    var host = req.headers.host;
    var domain = host.split(':')[0];
    res.send({
        address: 'ws://' + domain + ':' + CLIENT_WS_PORT,
        server: 'local'
    });
});

var jpegFrame = null;

var connectedStreams = [];

//express.get('/camera/stream.mjpeg', function(req, res) {
/*var streamServer = http.createServer(function(req, res) {
    console.log("APP: stream request started");
    res.writeHead(200, {
        'Cache-Control': 'no-store, no-cache, must-revalidate, pre-check=0, post-check=0, max-age=0',
        Pragma: 'no-cache',
        Connection: 'close',
        'Content-Type': 'multipart/x-mixed-replace; boundary=--myboundary'
    });

    var writeFrame = function() {
        var buffer = jpegFrame;
        res.write("--myboundary\nContent-Type: image/jpg\nContent-length: " + jpegFrame.length + "}\n\n");
        res.write(buffer);
    };

    if(Buffer.isBuffer(jpegFrame)) writeFrame();

    res.index = connectedStreams.length;
    connectedStreams.push(res);

    res.addListener('close', function() {
        console.log("APP: stream request ended");
        connectedStreams.splice(res.index, 1);
    });
});
streamServer.listen(9000);*/

app.addJpegFrame = function(frameBuffer) {
    jpegFrame = frameBuffer;
    console.log("APP: writing frame to " + connectedStreams.length + " streams...");
    for(var i = 0; i < connectedStreams.length; i++) {
        connectedStreams[i].write("--myboundary\nContent-Type: image/jpg\nContent-length: " + frameBuffer.length + "}\n\n");
        connectedStreams[i].write(frameBuffer);
    }
}

//express.get('//')

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


function connectRemote(version) {
    if (app.remote || !app.remoteEnabled) return;
    console.log("connecting to view.tl");
    wsRemote = new WebSocket('wss://app.view.tl/socket/device', {
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
                    app.emit('auth-complete', msg.email);
                    app.emit('connected', true);
                    console.log("Connected to view.tl");
                    remotePingHandle = setInterval(function() {
                        send_message('ping', null, wsRemote);
                    }, 10000);
                    if(version) send_message('version', {version: version}, wsRemote);
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
        app.emit('connected', false);
        app.remote = false;
        setTimeout(connectRemote, 5000);
    });

    wsRemote.once('error', function() {
        if (remotePingHandle) clearInterval(remotePingHandle);
        remotePingHandle = null;
        console.log("Disconnected from view.tl");
        app.emit('connected', false);
        app.remote = false;
        setTimeout(connectRemote, 5000);
    });
}

app.serial = "unknown";
// get cpu serial number as unique id for view device
exec('cat /proc/cpuinfo', function(error, stdout, stderr) {
    lines = stdout.split('\n');
    for(var i = 0; i < lines.length; i++) {
        if(lines[i].indexOf('Serial') === 0) {
            var matches = lines[i].match(/: ([0-9a-f]+)/i);
            if(matches.length > 1) {
                viewId = matches[1];
                console.log("VIEW_ID:", viewId);
                app.serial = viewId;
                connectRemote();
            }
        }
    }
});

function closeApp() {
    app.remoteEnabled = false;
    closeHttpServer();
    if(wsRemote && wsRemote.destroy) {
        wsRemote.close();
    }
    wss.clients.forEach(function (client) {
        try {
            if (client && client.close) client.close();
        } catch (err) {
            console.log("error closing websocket:", err);
        }
    });
}

function sendLog(logfile, logname, callback) {
    if(app.remote) {
        console.log("Reading", logfile);
        fs.readFile(logfile, function(err, file) {
            if(!err) {
                if(file) {
                    console.log("sending log file to proxy: ", logfile);
                    var obj = {
                        logname: logname,
                        bzip2: file.toString('base64')
                    }
                    send_message('log', obj, wsRemote, function(err2) {
                        if(err2) {
                            console.log("error sending log via ws:", err2);
                            callback(err2);
                        } else {
                            callback(null);
                        }
                    });
                } else {
                    console.log("empty log file, continuing anyway");
                    callback(null);
                }
            } else {
                console.log("error sending log: ", err);
                callback(null);
            }
        });
    } else {
        callback(true);
    }
}

function sendLogs(callback, uploaded) {
    if(!uploaded) uploaded = 0;
    if(app.remote) {
        console.log("Checking for logs to upload...", uploaded);
        var logs = null;
        try {
            logs = fs.readdirSync("/home/view/logsForUpload");
            logs = logs.filter(function(log) {
                return log.match(/^(log|TL|view-)/) ? true : false;
            });
        } catch(e) {
            logs = null;
        }

        if(logs && logs.length > 0) {
            var nextLogName = logs.pop();
            var nextLog = "/home/view/logsForUpload/" + nextLogName;
            sendLog(nextLog, nextLogName, function(err) {
                if(!err) {
                    fs.unlink(nextLog, function() {
                        uploaded++;
                        setTimeout(function() {
                            sendLogs(callback, uploaded);
                        }, 15 * 1000);
                    });
                } else {
                    console.log("log upload failed");
                    callback && callback("failed to upload log");
                }
            });
        } else {
            console.log("log uploads complete (" + uploaded + ")");
            callback && callback(null, uploaded);
            if(uploaded > 0) app.emit('logs-uploaded', uploaded);
        }
    } else {
        callback && callback("not connected");
    }
}

function send_message(type, object, socket, callback) {
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
            socket.send(msg_string, callback);
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
    		return function(type, object, callback) {
    			if(!object) object = {};
    			object.ack = nMsg.ack;
    			object._cbId = nMsg._cbId;

                send_message(type, object, nSocket, callback);
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

app.enableRemote = function(version) {
    app.remoteEnabled = true;    
    connectRemote(version);
}

app.disableRemote = function() {
    app.remoteEnabled = false;
    if(wsRemote && wsRemote.close) {
        wsRemote.close();
    }
    app.remote = false;
    app.emit('connected', false);
}

app.send = send_message;
app.sendLogs = sendLogs;
app.close = closeApp;

var httpServer = server.listen(CLIENT_SERVER_PORT, function() {
    console.log('listening on *:' + CLIENT_SERVER_PORT);
});

var sockets = {}, nextSocketId = 0;
httpServer.on('connection', function (socket) {
  // Add a newly connected socket
  var socketId = nextSocketId++;
  sockets[socketId] = socket;
  console.log('socket', socketId, 'opened');

  // Remove the socket when it closes
  socket.on('close', function () {
    console.log('socket', socketId, 'closed');
    delete sockets[socketId];
  });

  // Extend socket lifetime for demo purposes
  socket.setTimeout(4000);
});

function closeHttpServer() {
    // Close the server
    httpServer.close(function () { console.log('Server closed!'); });
    // Destroy all open sockets
    for (var socketId in sockets) {
        console.log('socket', socketId, 'destroyed');
        sockets[socketId].destroy();
    }
}
    

module.exports = app;