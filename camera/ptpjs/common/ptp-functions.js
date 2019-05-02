
/****************************************************************************
 LICENSE: CC BY-NC-SA 4.0 https://creativecommons.org/licenses/by-nc-sa/4.0/
 This is an original driver by Elijah Parker <mail@timelapseplus.com>
 It is free to use in other projects for non-commercial purposes.  For a
 commercial license and consulting, please contact mail@timelapseplus.com
*****************************************************************************/

exports.PTP_OC_Undefined              =  0x1000
exports.PTP_OC_GetDeviceInfo          =  0x1001
exports.PTP_OC_OpenSession            =  0x1002
exports.PTP_OC_CloseSession           =  0x1003
exports.PTP_OC_GetStorageIDs          =  0x1004
exports.PTP_OC_GetStorageInfo         =  0x1005
exports.PTP_OC_GetNumObjects          =  0x1006
exports.PTP_OC_GetObjectHandles       =  0x1007
exports.PTP_OC_GetObjectInfo          =  0x1008
exports.PTP_OC_GetObject              =  0x1009
exports.PTP_OC_GetThumb               =  0x100A
exports.PTP_OC_DeleteObject           =  0x100B
exports.PTP_OC_SendObjectInfo         =  0x100C
exports.PTP_OC_SendObject             =  0x100D
exports.PTP_OC_InitiateCapture        =  0x100E
exports.PTP_OC_FormatStore            =  0x100F
exports.PTP_OC_ResetDevice            =  0x1010
exports.PTP_OC_SelfTest               =  0x1011
exports.PTP_OC_SetObjectProtection    =  0x1012
exports.PTP_OC_PowerDown              =  0x1013
exports.PTP_OC_GetDevicePropDesc      =  0x1014
exports.PTP_OC_GetDevicePropValue     =  0x1015
exports.PTP_OC_SetDevicePropValue     =  0x1016
exports.PTP_OC_ResetDevicePropValue   =  0x1017
exports.PTP_OC_TerminateOpenCapture   =  0x1018
exports.PTP_OC_MoveObject             =  0x1019
exports.PTP_OC_CopyObject             =  0x101A
exports.PTP_OC_GetPartialObject       =  0x101B
exports.PTP_OC_InitiateOpenCapture    =  0x101C

exports.uint16buf = function(uint16) {
	var buf = new Buffer(2);
	buf.writeUInt16LE(uint16, 0);
	return buf;
}

exports.init = function(cam, callback) {
	exports.transaction(cam, exports.PTP_OC_OpenSession, [0x00000001], null, function(err, responseCode, data) {
		console.log("session open", err, exports.hex(responseCode), data);
		exports.transaction(cam, exports.PTP_OC_GetDeviceInfo, [], null, function(err, responseCode, data) {
			console.log("init complete", err, exports.hex(responseCode), data);
			var di = exports.parseDeviceInfo(data);
			console.log("device info:", di);
			//console.log("entering olympus pc mode...");
			callback && callback(err, di);
			//exports.transaction(cam, 0x1016, [0xD052], exports.uint16buf(1), function(err, responseCode, data) {
			//	console.log("olympus pc mode", err, responseCode);
			//	exports.transaction(cam, 0x9481, [0x3], null, function(err, responseCode, data)  {
			//		exports.transaction(cam, 0x9481, [0x6], null, function(err, responseCode, data) {
			//		});
			//	});
			//});
		});
	});
}

exports.setPropU16 = function(cam, prop, value, callback) {
	exports.transaction(cam, exports.PTP_OC_SetDevicePropValue, [prop], exports.uint16buf(value), function(err, responseCode, data) {
		callback && callback(err || responseCode == 0x2001 ? null : responseCode);
	});
}

exports.getPropU16 = function(cam, prop, value, callback) {
	exports.transaction(cam, exports.PTP_OC_GetDevicePropValue, [prop], null, function(err, responseCode, data) {
		callback && callback(err || responseCode == 0x2001 ? null : responseCode, data && data.readUInt16LE && data.readUInt16LE(0));
	});
}

exports.ptpCapture = function(cam, params, callback) {
	exports.transaction(cam, exports.PTP_OC_InitiateCapture, params, null, function(err, responseCode, data) {
		callback && callback(err || responseCode == 0x2001 ? null : responseCode, data && data.readUInt16LE && data.readUInt16LE(0));
	});
}

exports.hex = function(val) {
	if(val == null) return "null";
	return "0x" + val.toString(16);
}

exports.transaction = function(cam, opcode, params, data, callback) {
	if(!params) params = [];
	cam.transactionId++
	var length = 12 + 4 * params.length;
	var type = 1; // command
	var maxPacket = cam.ep.in.descriptor.wMaxPacketSize;

	// uint32 length (4) 0
	// uint16 type (2) 4
	// uint16 opcode (2) 6
	// uint32 transactionId (4) 8
	// uint32[4] params (optional) or data 12

	var buf = new Buffer(length);

	buf.writeUInt32LE(length, 0);
	buf.writeUInt16LE(type, 4);
	buf.writeUInt16LE(opcode, 6);
	buf.writeUInt32LE(cam.transactionId, 8);
	for(var i = 0; i < params.length; i++) {
		buf.writeUInt32LE(params[i], 12 + i * 4);
	}

	var send = function(buf, cb) {
		cam.ep.out.transfer(buf, function(err)  {
			console.log("sent", buf);
			if(data) {
				buf.writeUInt32LE(12 + data.length, 0); // overwrite length
				buf.writeUInt16LE(2, 4); // update type to 2 (data)
				var dbuf = Buffer.concat([buf.slice(0, 12), data]);
				data = null;
				send(dbuf, cb);
			} else {
				cb && cb(err);
			}
		});
	}

	var packetSize = function(ep, bytes) {
		return Math.ceil(bytes / maxPacket) * maxPacket;
	}

	var parseResponse = function(buf) {
		if(buf && buf.length == 12) {
			return buf.readUInt16LE(6);
		} else {
			return null;
		}
	}

	var receive = function(cb, rbuf) {
		console.log("reading 12 bytes...");
		cam.ep.in.transfer(packetSize(cam.ep.in, 12), function(err, data) {
			if(!err && data) {
				var rlen = data.readUInt32LE(0);
				var rtype = data.readUInt16LE(4);
				console.log("received packet type #", rtype, "total size:", rlen, "data length received:", data.length);
				if(rtype == 3) {
					var responseCode = parseResponse(data);
					console.log("completed transaction, response code", exports.hex(responseCode));
					if(rbuf) {
						rbuf = rbuf.slice(12); // strip header from data returned
						console.log("-> received", rbuf.length, "bytes: ", rbuf);
					}
					cb && cb(err, responseCode, rbuf);
				} else {
					if(rlen > data.length) {
						console.log("requesting more data:", rlen - data.length);
						cam.ep.in.transfer(packetSize(cam.ep.in, rlen - data.length), function(err, data2) {
							console.log("received", data2.length, "bytes additional");
							receive(cb, Buffer.concat([data, data2]));
						});
					} else {
						receive(cb, data);
					}
				}
			} else {
				console.log("error reading:", err);
				cb && cb(err);
			}
		});
	}

	send(buf, function(err) {
		receive(callback);
	});

}

exports.parseUnicodeString = function(buf, offset) {
	var end = offset;
	for(var i = offset; i < buf.length; i += 2) {
		if(buf.readUInt16LE(i) == 0) {
			end = i;
			break;
		}
	}
	return buf.toString('utf16le', offset, end);
}

exports.parseDeviceInfo = function(buf) {
	var di = {};
	var offset = 12 + 8;
	di.vendorExtDesc = exports.parseUnicodeString(buf, offset);
	offset += di.vendorExtDesc.length * 2;
	offset += 3;
	di.operationsCount = buf.readUInt32LE(offset);
	offset += 4;
	di.operations = [];
	return di;
	for(var i = 0; i < di.operationsCount; i++) {
		di.operations.push(buf.readUInt16LE(offset).toString(16));
		offset += 2;
	}
	di.eventsCount = buf.readUInt32LE(offset);
	offset += 4;
	di.events = [];
	for(var i = 0; i < di.eventsCount; i++) {
		di.events.push(buf.readUInt16LE(offset).toString(16));
		offset += 2;
	}
	di.propertiesCount = buf.readUInt32LE(offset);
	offset += 4;
	di.properties = [];
	for(var i = 0; i < di.propertiesCount; i++) {
		di.properties.push(buf.readUInt16LE(offset).toString(16));
		offset += 2;
	}
	di.captureFormatsCount = buf.readUInt32LE(offset);
	offset += 4;
	di.captureFormats = [];
	for(var i = 0; i < di.captureFormatsCount; i++) {
		di.captureFormats.push(buf.readUInt16LE(offset).toString(16));
		offset += 2;
	}
	di.imageFormatsCount = buf.readUInt32LE(offset);
	offset += 4;
	di.imageFormats = [];
	for(var i = 0; i < di.imageFormatsCount; i++) {
		di.imageFormats.push(buf.readUInt16LE(offset).toString(16));
		offset += 2;
	}
	offset += 1;
	di.manufacturer = exports.parseUnicodeString(buf, offset);
	offset += di.manufacturer.length * 2;
	offset += 3;
	di.model = exports.parseUnicodeString(buf, offset);
	offset += di.model.length * 2;
	offset += 3;
	di.version = exports.parseUnicodeString(buf, offset);
	offset += di.version.length * 2;
	offset += 3;

	return di;
}
