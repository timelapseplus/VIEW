/*jslint node:true,vars:true,bitwise:true */
'use strict';

console.log('Starting up...');

var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var http = require('http');
var server = http.Server(app);
var async = require('async');
var WebSocketServer = require('ws').Server
var uid = require('uid');
var bcrypt = require('bcrypt');
var mysql      = require('mysql');
var fs = require('fs');
var exec = require('child_process').exec;

var db = mysql.createConnection({
  host     : '104.131.0.142',
  user     : 'view',
  password : '@H9dp44td*>-0~dkgjhgq1-l,p866',
  database : 'view'
});

db.connect();

var sessions = [];

var UPLOADED_LOGS = "/var/www/logs/";

function updateSessions(callback) {
    var newSessions = [];
    db.query('SELECT * FROM `sessions` AS `s`, `users` AS `u` WHERE `u`.`id` = `s`.`user_id`', function(err, rows, fields) {
      if (err) callback(err);
      if(rows && rows.length > 0) {
        for(var i = 0; i < rows.length; i++) {
            newSessions.push(rows[i]);
        }
      }
      sessions = newSessions;
      console.log("sessions", sessions);
      callback && callback();
    });
}
updateSessions();

function loginUser(email, password, callback) {
    getUserByEmail(email, function(err, user) {
        if(!err && user) {
            bcrypt.compare(password, user.password, function(err, res) {
                if(!err && res) {
                    var session = {
                        user_id: user.id,
                        sid: uid(64) + user.id,
                        date: (new Date()).toISOString()
                    }
                    db.query("INSERT INTO `sessions` SET ?", session, function(err) {
                        updateSessions(function(){
                            callback(null, session);
                        });
                    });
                } else {
                    callback("invalid username or password");
                }
            });
        } else {
            callback("invalid username or password");
        }
    });    
}

function updateUser(email, subdomain, password, callback) {
    getUserByEmail(email, function(err, user) {
        bcrypt.hash(password, 10, function(err, hash) {
            if (user && user.id) {
                db.query("UPDATE `users` SET `subdomain` = ?, `password` = ? WHERE `id` = ?", [subdomain, hash, user.id], function(err) {
                    callback && callback();
                });
            } else {
                db.query("INSERT INTO `users` SET `email` = ?, `subdomain` = ?, `password` = ?", [email, subdomain, hash], function(err) {
                    callback && callback();
                });
            }
        });
    });
}

function getUserByEmail(email, callback) {
    db.query('SELECT * FROM `users` WHERE `email` = ?', email, function(err, rows, fields) {
      if (err) callback(err);
      if(rows && rows.length > 0) {
        return callback(null, rows[0]);
      }
      return callback(null, null);
    });
}

function getUserById(userId, callback) {
    db.query('SELECT * FROM `users` WHERE `id` = ?', userId, function(err, rows, fields) {
      if (err) callback(err);
      if(rows && rows.length > 0) {
        return callback(null, rows[0]);
      }
      return callback(null, null);
    });
}

function getUserBySubdomain(subdomain, callback) {
    db.query('SELECT * FROM `users` WHERE `subdomain` = ?', subdomain, function(err, rows, fields) {
      if (err) callback(err);
      if(rows && rows.length > 0) {
        return callback(null, rows[0]);
      }
      return callback(null, null);
    });
}

function getDeviceByViewId(viewId, callback) {
    db.query('SELECT * FROM `devices` WHERE `view_id` = ?', viewId, function(err, rows, fields) {
      if (err) callback(err);
      if(rows && rows.length > 0) {
        return callback(null, rows[0]);
      }
      return callback(null, null);
    });
}

function addDeviceToDb(viewId, userId, callback) {
    var device = {
        'view_id': viewId,
        'user_id': userId
    }
    db.query('INSERT INTO `devices` SET ?', device, function(err, res) {
      callback && callback(err);
    });
}

function findSession(sid, subdomain) {
    for(var i = 0; i < sessions.length; i++) {
        if(sid === sessions[i].sid) { //} && subdomain === sessions[i].subdomain) {
            // valid session
            return sessions[i];
        }
    }
    return null;
}

function validateSession(req, res, callback) {
    var host = req.headers.host;
    var subdomain = host.split('.')[0];
    var sid = req.headers['x-view-session'];
    var session = findSession(sid, subdomain);
    if(session) {
        return callback(session)
    }
    console.log("session not found: ", sid, subdomain);
    res.send({
        action: 'login_required',
        message: "access denied, login required"
    });
}

process.on('exit', function(){
    db.end();
});

var previewBufferSize = 3;
var previewBuffer = [];
var previewRunning = false;
var previewIndex = -1;
var previewCancel = 0;

var cache = {};

var wssView = new WebSocketServer({
    port: 8102
});
var wssNet = new WebSocketServer({
    port: 8100
});

app.use(express.static(__dirname + '/frontend/www'));

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

app.post('/api/login', function(req, res) {
    loginUser(req.body.email, req.body.password, function(err, session) {
        if(!err && session) {
            res.send({
                action: 'login',
                session: session.sid,
                message: "successfully logged in"
            });
        } else {
            res.send({
                action: 'login_failed',
                message: err
            });
        }
    });
});

app.post('/api/register', function(req, res) {
    console.log("trying to register ", req.body.email);
    updateUser(req.body.email, req.body.subdomain, req.body.password, function(err) {
        loginUser(req.body.email, req.body.password, function(err, session) {
            if(!err && session) {
                console.log("registered ", req.body.email, req.body.subdomain);
                res.send({
                    action: 'login',
                    session: session.sid,
                    message: "successfully logged in"
                });
            } else {
                console.log("ERROR: failed to register ", req.body.email, err);
                res.send({
                    action: 'login_failed',
                    message: err
                });
            }
        });
    });
});

app.post('/api/email', function(req, res) {
    getUserByEmail(req.body.email, function(err, user) {
        if(!err) {
            if(user && user.password) {
                res.send({
                    action: 'login',
                    message: "email found, valid account"
                });
            } else {
                res.send({
                    action: 'register',
                    message: "no account, registration required"
                });
            }
        } else {
            console.log("ERROR: error occurred while checking email ", req.body.email, err);
            res.send({
                action: 'error',
                message: err
            });
        }
    });
});

app.post('/api/subdomain/check', function(req, res) {
    getUserBySubdomain(req.body.subdomain, function(err, user) {
        if(!err && !user) {
            res.send({
                action: 'available',
                message: "subdomain is available"
            });
        } else {
            res.send({
                action: 'error',
                message: err
            });
        }
    });
});

app.post('/api/device/new', function(req, res) {
    //console.log(req.body, req.headers);
    validateSession(req, res, function(session) {
        if(req.body.code) {
            console.log("adding device...");
            var dev = null;
            for(var i = 0; i < wssView.clients.length; i++) {
                if(parseInt(wssView.clients[i].authCode) === parseInt(req.body.code)) {
                    dev = wssView.clients[i];
                }
            }
            if(dev && dev.viewId) {
                console.log("device found, adding to DB");
                addDeviceToDb(dev.viewId, session.user_id, function(err){
                    dev.userId = session.user_id;
                    dev.authCode = null;

                    if(!viewConnected[dev.userId]) viewConnected[dev.userId] = {current: null, devices:[]};
                    viewConnected[dev.userId].devices.push(dev.viewId);
                    if(viewConnected[dev.userId].current === null) viewConnected[dev.userId].current = dev.viewId;
                    console.log("viewConnected[dev.userId]", viewConnected[dev.userId]);

                    startViewConnection(dev);
                    res.send({
                        action: 'device_added',
                        message: 'device added'
                    });
                });
            } else {
                console.log("failed to find device with code " + req.body.code);
                res.send({
                    action: 'device_add_failed',
                    message: 'device not found or code expired, please try again'
                });
            }
        } else {
            console.log("error: no code included for add device");
        }
    });
});


app.get('/socket/address', function(req, res) {
    validateSession(req, res, function(session) {
        console.log("session validated for " + session.subdomain);
        res.send({
            address: 'ws://' + session.subdomain + '.view.tl/socket/app/',
            server: 'view.tl'
        });
    });
});

wssNet.broadcast = function broadcast(data, userId, viewId) {
    //console.log("broadcasting to (app)", userId);
    wssNet.clients.forEach(function each(client) {
        if (client.userId == userId) {
            if(!viewId || viewConnected[userId].current == viewId) client.send(data);
        }
    });
};

wssView.broadcast = function broadcast(data, userId) {
    //console.log("broadcasting to (device)", userId);
    wssView.clients.forEach(function each(client) {
        if (client.userId == userId && client.viewId == viewConnected[userId].current) client.send(data);
    });
};

wssNet.on('connection', function connection(ws) {
    var host = ws.upgradeReq.headers.host;
    console.log("headers", ws.upgradeReq.headers);
    var subdomain = host.split('.')[0];
    ws.viewDomain = subdomain;
    console.log("Connection from App:", ws.viewDomain);
    ws.on('message', function incoming(message) {
        //console.log('received (app): %s', message);
        receiveNetMessage(message, ws);
    });
    ws.on('close', function() {
        console.log("App disconnected");
    });
    ws.on('error', function(err) {
        console.log("App communication error:", err);
    });
});

var startViewConnection = function(ws) {
    getUserById(ws.userId, function(err, user) {
        var email = null;
        if(!err && user) email = user.email;
        sendViewMessage({
            connected: true,
            email: email
        }, ws);
        sendViewMessage({
            type: "get",
            key: "camera"
        }, ws);
        sendIntervalometerUpdate(null, ws.userId, ws.viewId);
    });
}

var viewConnected = {};
wssView.on('connection', function connection(ws) {
    ws.viewId = ws.upgradeReq.headers['x-view-id'];
    if(!ws.viewId) return ws.close();
    console.log("Connection from Device:", ws.viewId);

    getDeviceByViewId(ws.viewId, function(err, device) {
        if(!device) {
            ws.authCode = Math.random().toString(10).substr(2, 6);;
            console.log("validating device with auth code ", ws.authCode);
            sendViewMessage({
                code: ws.authCode
            }, ws);
        } else {
            console.log("device authenticated: ", ws.viewId);
            ws.userId = device.user_id;
            if(!viewConnected[ws.userId]) viewConnected[ws.userId] = {current: null, devices:[]};
            viewConnected[ws.userId].devices.push(ws.viewId);
            if(viewConnected[ws.userId].current === null) viewConnected[ws.userId].current = ws.viewId;
            console.log(viewConnected[ws.userId]);
            startViewConnection(ws);
        }
    });

    ws.on('message', function incoming(message) {
        //console.log('received (view): %s', message);
        receiveViewMessage(message, ws);
    });
    ws.on('close', function() {
        if(cache[ws.viewId]) delete cache[ws.viewId];
        if(viewConnected[ws.userId] && viewConnected[ws.userId].devices && viewConnected[ws.userId].devices.length > 0) {
            var index = viewConnected[ws.userId].devices.indexOf(ws.viewId);
            viewConnected[ws.userId].devices.splice(index, 1);
            if(viewConnected[ws.userId].current == ws.viewId) {
                  viewConnected[ws.userId].current = null;
                  if(viewConnected[ws.userId].devices.length > 0) viewConnected[ws.userId].current = viewConnected[ws.userId].devices[0];             
            }
        }
        if(viewConnected[ws.userId] && viewConnected[ws.userId].devices.length == 0) {
            delete viewConnected[ws.userId];
        }
    });
});

function sendViewMessage(object, socket, viewId) {
    var msg_string = JSON.stringify(object);
    if (socket) {
        socket.send(msg_string);
    } else {
        wssView.broadcast(msg_string, viewId);
    }
}

function sendNetMessage(object, socket, userId, viewId) {
    var msg_string = JSON.stringify(object);
    if (socket) {
        socket.send(msg_string);
    } else {
        wssNet.broadcast(msg_string, userId, viewId);
    }
}

var returnSockets = [];

function receiveNetMessage(msg_string, socket) {
    try {
        var msg = JSON.parse(msg_string);
        if (!msg || !msg.type) {
            throw "invalid message: no type set";
        } else {
            if(msg.type == 'auth' && msg.session) {
                var session = findSession(msg.session, socket.viewDomain);
                if(!session) {
                    return socket.close();
                }
                return socket.userId = session.user_id;
            } else if(!socket.userId) {
                return socket.close();
            }
            if (!viewConnected[socket.userId] || viewConnected[socket.userId].devices.length == 0) {
                sendNetMessage({
                    type: 'nodevice'
                }, socket);
            }
            if (msg.type == "ping") {
                if (previewRunning) {
                    previewCancel++;
                    if (previewCancel > 1) previewRunning = false;
                }
                sendNetMessage({
                    type: 'pong'
                }, socket);
            } else if (msg.type == "intervalometerStatus") {
                if(viewConnected[socket.userId] && viewConnected[socket.userId].current)
                sendIntervalometerUpdate(socket, socket.userId, viewConnected[socket.userId].current);
            } else if (msg.type == "previewStop") {
                previewRunning = false;
            } else if (msg.type == "preview") {
                console.log("PREVIEW REQUEST");
                previewCancel = 0;
                if (!previewRunning || previewIndex <= 0) {
                    if (!previewRunning) {
                        sendViewMessage({
                            type: 'preview'
                        }, null, socket.userId);
                        console.log("starting preview");
                        previewIndex = -1;
                        previewRunning = true;
                    }
                } else {
                    console.log("SENDING FROM BUFFER");
                    sendNetMessage({
                        type: 'thumbnail',
                        jpeg: previewBuffer[0]
                    }, socket);
                    if (previewIndex > 0) {
                        for (var i = 1; i < previewIndex; i++) {
                            previewBuffer[i - 1] = previewBuffer[i];
                        }
                    }
                }
                if (previewIndex >= 0) previewIndex--;
            } else {
                console.log("received message from APP:", msg.type);
                do {
                    msg.ack = uid(10);
                } while (returnSockets[msg.ack])
                returnSockets[msg.ack] = socket;
                sendViewMessage(msg, null, socket.userId);
            }
        }
    } catch (err) {
        console.log("Error while parsing message (APP):", msg_string, err);
        return;
    }
}

function updateCache(viewId, key, data) {
    if(!cache[viewId]) cache[viewId] = {};
    cache[viewId][key] = data;
}

function recordLogReport(filename, userId) {
    var reason = "";
    var version = "";
    var matches = filename.match(/\-([a-z]+).txt/i);
    if(matches && matches.length > 1) reason = matches[1];
    var camera = "";
    exec('/bin/bunzip2 ' + UPLOADED_LOGS + filename + ' -c | /bin/grep -m 1 "Camera connected:"', function(err, stdout, stderr) {
        if(!err && stdout) {
            matches = stdout.match(/Camera connected:\s*(.+)/i);
            if(matches && matches.length > 1) camera = matches[1].trim();
        }
        exec('/bin/bunzip2 ' + UPLOADED_LOGS + filename + ' -c | /bin/grep -m 1 "current version:"', function(err, stdout, stderr) {
            if(!err && stdout) {
                matches = stdout.match(/current version:\s*(.+)/i);
                if(matches && matches.length > 1) version = matches[1].trim();
            }
            var report = {
                user_id: userId,
                logfile: filename,
                reason: reason,
                camera: camera,
                version: version,
                date: (new Date()).toISOString()
            }
            db.query("INSERT INTO `reports` SET ?", report, function(err) {
                if(err) {
                    console.log("Error while saving report:", err);
                }

            });
        });
    });
}

function receiveViewMessage(msg_string, socket) {
    if(!socket.userId) {
        console.log("userId not found for VIEW device, ignoring.");
        return;
    }
    try {
        var msg = JSON.parse(msg_string);
        if (!msg || !msg.type) {
            throw "invalid message: no type set";
        }

        var s = null;
        if (msg.ack) {
            s = returnSockets[msg.ack];
            delete returnSockets[msg.ack];
        }

        if (msg.type == "ping") {
            sendViewMessage({
                type: 'pong'
            }, socket);
        } else if (msg.type == "log") {
            console.log("received log:", msg.logname)
            if(msg.logname.length < 64) {
                var matches = msg.logname.match(/^[0-9a-z\-.]+$/i);
                if(matches && matches.length > 0) {
                    var filename = 'user' + socket.userId + '-' + uid(5) + '-' + matches[0];
                    var filepath = UPLOADED_LOGS + filename;
                    console.log("saving log to " + filepath);
                    fs.writeFile(filepath, new Buffer(msg.bzip2, 'base64'), function(err) {
                        console.log("wrote log:", err);
                        recordLogReport(filename, socket.userId);
                    });
                }
            }
        } else if (msg.type == "thumbnail" && previewRunning) {
            updateCache(socket.viewId, 'thumbnail', msg.jpeg);
            if (previewRunning) {
                sendViewMessage({
                    type: 'preview'
                }, socket);
                if (previewIndex < 0) {
                    console.log("SENDING DIRECT");
                    sendNetMessage(msg, s, socket.userId, socket.viewId);
                    previewIndex = 0;
                } else {
                    console.log("preview buffer:", previewIndex);
                    if (previewIndex >= previewBufferSize) {
                        previewRunning = false;
                        console.log("preview buffer full");
                    } else {
                        previewBuffer[previewIndex] = msg.jpeg;
                        previewIndex++;
                    }
                }
            }

        } else {
            sendNetMessage(msg, s, socket.userId, socket.viewId);

            if (msg.type == "intervalometerStatus") {
                updateCache(socket.viewId, 'intervalometerStatus', msg.status);
            }
        }
        console.log("received message from VIEW:", msg.type);
    } catch (err) {
        console.log("Error while parsing message (VIEW):", msg_string, err);
        return;
    }
}

function sendIntervalometerUpdate(socket, viewId, userId) {
    if (cache[viewId] && cache[viewId].intervalometerStatus) {
        sendNetMessage({
            type: 'intervalometerStatus',
            status: cache[viewId].intervalometerStatus
        }, socket, viewId, userId);
        if (cache[viewId].intervalometerStatus && cache[viewId].intervalometerStatus.running && cache[viewId].jpeg) {
            sendNetMessage({
                type: 'thumbnail',
                jpeg: cache[viewId].thumbnail
            }, socket, viewId, userId);
        }
    }
}

server.listen(8001, function() {
    console.log('listening on *:8001');
});