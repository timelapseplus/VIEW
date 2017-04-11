

/*  Intervalometer API

message                  args                     response
-------------------------------------------------------------------------
'load'                 program (obj)              validationResult (obj)
'start'                ---                        status (obj)
'pause'                ---                        status (obj)
'cancel'               ---                        status (obj)

'motion-step'          axis (int), steps (int)    motionStatus (obj)
'motion-move'          axis (int), speed (float)  motionStatus (obj)
'motion-stop'          axis (int)                 motionStatus (obj)
'motion-info'          ---                        motionStatus (obj)

'camera-update'        ---                        cameraStatus (obj)
'camera-set'           param (str), val (str)     cameraStatus (obj)
'camera-get'           ---                        cameraStatus (obj)
'camera-set-primary'   cameraIndex (int)          cameraStatus (obj)
'camera-capture'       options (obj)              captureResult (obj)
'camera-liveview'      enable (bool)              camera_status (obj)


event                  payload                    
--------------------------------------------------
'error'                message (str)              
'status'               intervalometerStatus (obj)
'motion-status'        motionStatus (obj)
'camera-status'        cameraStatus (obj)
'jpeg-capture'         jpegImage (buf)
'jpeg-liveview'        jpegImage (buf)



*/

var net = require('net');
var client = net.connect('/tmp/intervalometer.sock', function() {
  console.log('connected to server!');
  client.write('world!\r\n');
});
client.on('data', function(data) {
  console.log(data.toString());
  client.end();
});
client.on('end', function() {
  console.log('disconnected from server');
});
client.on('error', function(err) {
	if(err && err.code && (err.code == 'ECONNREFUSED' || err.code == 'ENOENT')) {
		console.log("Error: server not ready");
	} else {
		console.log("error: ", err);
	}
});

var net = require('net');
var server = net.createServer(function(c) {
  // 'connection' listener
  console.log('client connected');
  c.on('data', function(data) {
  	console.log("received:", data);
  });
  c.on('end', function() {
    console.log('client disconnected');
  });
  c.write('hello\r\n');
  //c.pipe(c);
});

setInterval(function() {
	server.broadcast('testing');
}, 2000);

server.on('error', function(err) {
  throw err;
});
server.listen('/tmp/intervalometer.sock',  function() {
  console.log('server bound');
});
