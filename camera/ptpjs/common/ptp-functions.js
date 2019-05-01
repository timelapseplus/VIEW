
/****************************************************************************
 LICENSE: CC BY-NC-SA 4.0 https://creativecommons.org/licenses/by-nc-sa/4.0/
 This is an original driver by Elijah Parker <mail@timelapseplus.com>
 It is free to use in other projects for non-commercial purposes.  For a
 commercial license and consulting, please contact mail@timelapseplus.com
*****************************************************************************/

exports.uint16buf = function(uint16) {
	const buf = Buffer.alloc(2);
	buf.writeUInt16LE(uint16);
	return buf;
}

exports.init = function(cam, callback) {
	exports.transaction(cam, 0x1002, [0x00000001], null, (err, responseCode, data) => {
		console.log("session open", err, exports.hex(responseCode), data);
		exports.transaction(cam, 0x1001, [], null, (err, responseCode, data) => {
			console.log("init complete", err, exports.hex(responseCode), data);
			const di = exports.parseDeviceInfo(data);
			console.log("device info:", di);
			console.log("entering olympus pc mode...");
			exports.transaction(cam, 0x1016, [0xD052], exports.uint16buf(1), (err, responseCode, data) => {
				console.log("olympus pc mode", err, responseCode);
				exports.transaction(cam, 0x9481, [0x3], null, (err, responseCode, data) => {
					exports.transaction(cam, 0x9481, [0x6], null, (err, responseCode, data) => {
					});
				});
			});
		});
	});
}

exports.hex = function(val) {
	if(val == null) return "null";
	return "0x" + val.toString(16);
}

exports.transaction = function(cam, opcode, params, data, callback) {
	if(!params) params = [];
	cam.transactionId++
	const length = 12 + 4 * params.length;
	const type = 1; // command
	const maxPacket = cam.ep.in.descriptor.wMaxPacketSize;

	// uint32 length (4) 0
	// uint16 type (2) 4
	// uint16 opcode (2) 6
	// uint32 transactionId (4) 8
	// uint32[4] params (optional) or data 12

	const buf = Buffer.alloc(length);

	buf.writeUInt32LE(length, 0);
	buf.writeUInt16LE(type, 4);
	buf.writeUInt16LE(opcode, 6);
	buf.writeUInt32LE(cam.transactionId, 8);
	for(let i = 0; i < params.length; i++) {
		buf.writeUInt32LE(params[i], 12 + i * 4);
	}

	const send = (buf, cb) => {
		cam.ep.out.transfer(buf, (err) => {
			console.log("sent", buf);
			if(data) {
				buf.writeUInt32LE(12 + data.length, 0); // overwrite length
				buf.writeUInt16LE(2, 4); // update type to 2 (data)
				const dbuf = Buffer.concat([buf.slice(0, 12), data]);
				data = null;
				send(dbuf, cb);
			} else {
				cb && cb(err);
			}
		});
	}

	const packetSize = (ep, bytes) => {
		return Math.ceil(bytes / maxPacket) * maxPacket;
	}

	const parseResponse = (buf) => {
		if(buf && buf.length == 12) {
			return buf.readUInt16LE(6);
		} else {
			return null;
		}
	}

	const receive = (cb, rbuf) => {
		console.log("reading 12 bytes...");
		cam.ep.in.transfer(packetSize(cam.ep.in, 12), (err, data) => {
			if(!err && data) {
				const rlen = data.readUInt32LE(0);
				const rtype = data.readUInt16LE(4);
				if(rtype == 3) {
					cb && cb(err, parseResponse(data), rbuf);
				} else {
					console.log("data received:", rlen);
					if(rlen > 12) {
						console.log("requesting mode data:", rlen - 12);
						cam.ep.in.transfer(packetSize(cam.ep.in, rlen - 12), (err, data2) => {
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

	send(buf, (err) => {
		receive(callback);
	});

}

exports.parseUnicodeString = function(buf, offset) {
	let end = offset;
	for(let i = offset; i < buf.length; i += 2) {
		if(buf.readUInt16LE(i) == 0) {
			end = i;
			break;
		}
	}
	return buf.toString('utf16le', offset, end);
}

exports.parseDeviceInfo = function(buf) {
	const di = {};
	let offset = 12 + 8;
	di.vendorExtDesc = exports.parseUnicodeString(buf, offset);
	offset += di.vendorExtDesc.length * 2;
	offset += 3;
	di.operationsCount = buf.readUInt32LE(offset);
	offset += 4;
	di.operations = [];
	for(let i = 0; i < di.operationsCount; i++) {
		di.operations.push(buf.readUInt16LE(offset).toString(16));
		offset += 2;
	}
	di.eventsCount = buf.readUInt32LE(offset);
	offset += 4;
	di.events = [];
	for(let i = 0; i < di.eventsCount; i++) {
		di.events.push(buf.readUInt16LE(offset).toString(16));
		offset += 2;
	}
	di.propertiesCount = buf.readUInt32LE(offset);
	offset += 4;
	di.properties = [];
	for(let i = 0; i < di.propertiesCount; i++) {
		di.properties.push(buf.readUInt16LE(offset).toString(16));
		offset += 2;
	}
	di.captureFormatsCount = buf.readUInt32LE(offset);
	offset += 4;
	di.captureFormats = [];
	for(let i = 0; i < di.captureFormatsCount; i++) {
		di.captureFormats.push(buf.readUInt16LE(offset).toString(16));
		offset += 2;
	}
	di.imageFormatsCount = buf.readUInt32LE(offset);
	offset += 4;
	di.imageFormats = [];
	for(let i = 0; i < di.imageFormatsCount; i++) {
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
