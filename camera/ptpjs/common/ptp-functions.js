
/****************************************************************************
 LICENSE: CC BY-NC-SA 4.0 https://creativecommons.org/licenses/by-nc-sa/4.0/
 This is an original driver by Elijah Parker <mail@timelapseplus.com>
 It is free to use in other projects for non-commercial purposes.  For a
 commercial license and consulting, please contact mail@timelapseplus.com
*****************************************************************************/

exports.PTP_OC_Undefined              =  0x1000;
exports.PTP_OC_GetDeviceInfo          =  0x1001;
exports.PTP_OC_OpenSession            =  0x1002;
exports.PTP_OC_CloseSession           =  0x1003;
exports.PTP_OC_GetStorageIDs          =  0x1004;
exports.PTP_OC_GetStorageInfo         =  0x1005;
exports.PTP_OC_GetNumObjects          =  0x1006;
exports.PTP_OC_GetObjectHandles       =  0x1007;
exports.PTP_OC_GetObjectInfo          =  0x1008;
exports.PTP_OC_GetObject              =  0x1009;
exports.PTP_OC_GetThumb               =  0x100A;
exports.PTP_OC_DeleteObject           =  0x100B;
exports.PTP_OC_SendObjectInfo         =  0x100C;
exports.PTP_OC_SendObject             =  0x100D;
exports.PTP_OC_InitiateCapture        =  0x100E;
exports.PTP_OC_FormatStore            =  0x100F;
exports.PTP_OC_ResetDevice            =  0x1010;
exports.PTP_OC_SelfTest               =  0x1011;
exports.PTP_OC_SetObjectProtection    =  0x1012;
exports.PTP_OC_PowerDown              =  0x1013;
exports.PTP_OC_GetDevicePropDesc      =  0x1014;
exports.PTP_OC_GetDevicePropValue     =  0x1015;
exports.PTP_OC_SetDevicePropValue     =  0x1016;
exports.PTP_OC_ResetDevicePropValue   =  0x1017;
exports.PTP_OC_TerminateOpenCapture   =  0x1018;
exports.PTP_OC_MoveObject             =  0x1019;
exports.PTP_OC_CopyObject             =  0x101A;
exports.PTP_OC_GetPartialObject       =  0x101B;
exports.PTP_OC_InitiateOpenCapture    =  0x101C;

exports.PTP_EC_Undefined			 = 0x4000;
exports.PTP_EC_CancelTransaction	 = 0x4001;
exports.PTP_EC_ObjectAdded			 = 0x4002;
exports.PTP_EC_ObjectRemoved		 = 0x4003;
exports.PTP_EC_StoreAdded			 = 0x4004;
exports.PTP_EC_StoreRemoved			 = 0x4005;
exports.PTP_EC_DevicePropChanged	 = 0x4006;
exports.PTP_EC_ObjectInfoChanged	 = 0x4007;
exports.PTP_EC_DeviceInfoChanged	 = 0x4008;
exports.PTP_EC_RequestObjectTransfer = 0x4009;
exports.PTP_EC_StoreFull			 = 0x400A;
exports.PTP_EC_DeviceReset			 = 0x400B;
exports.PTP_EC_StorageInfoChanged	 = 0x400C;
exports.PTP_EC_CaptureComplete		 = 0x400D;
exports.PTP_EC_UnreportedStatus		 = 0x400E;

exports.PTP_OFC_Association          = 0x3001;
exports.PTP_OFC_EXIF_JPEG            = 0x3801;

exports.PTP_RC_Undefined                = 0x2000;
exports.PTP_RC_OK                       = 0x2001;
exports.PTP_RC_GeneralError             = 0x2002;
exports.PTP_RC_SessionNotOpen           = 0x2003;
exports.PTP_RC_InvalidTransactionID     = 0x2004;
exports.PTP_RC_OperationNotSupported    = 0x2005;
exports.PTP_RC_ParameterNotSupported    = 0x2006;
exports.PTP_RC_IncompleteTransfer       = 0x2007;
exports.PTP_RC_InvalidStorageId         = 0x2008;
exports.PTP_RC_InvalidObjectHandle      = 0x2009;
exports.PTP_RC_DevicePropNotSupported   = 0x200A;
exports.PTP_RC_InvalidObjectFormatCode  = 0x200B;
exports.PTP_RC_StoreFull                = 0x200C;
exports.PTP_RC_ObjectWriteProtected     = 0x200D;
exports.PTP_RC_StoreReadOnly            = 0x200E;
exports.PTP_RC_AccessDenied             = 0x200F;
exports.PTP_RC_NoThumbnailPresent       = 0x2010;
exports.PTP_RC_SelfTestFailed           = 0x2011;
exports.PTP_RC_PartialDeletion          = 0x2012;
exports.PTP_RC_StoreNotAvailable        = 0x2013;
exports.PTP_RC_SpecificationByFormatUnsupported = 0x2014;
exports.PTP_RC_NoValidObjectInfo        = 0x2015;
exports.PTP_RC_InvalidCodeFormat        = 0x2016;
exports.PTP_RC_UnknownVendorCode        = 0x2017;
exports.PTP_RC_CaptureAlreadyTerminated = 0x2018;
exports.PTP_RC_DeviceBusy               = 0x2019;
exports.PTP_RC_InvalidParentObject      = 0x201A;
exports.PTP_RC_InvalidDevicePropFormat  = 0x201B;
exports.PTP_RC_InvalidDevicePropValue   = 0x201C;
exports.PTP_RC_InvalidParameter         = 0x201D;
exports.PTP_RC_SessionAlreadyOpened     = 0x201E;
exports.PTP_RC_TransactionCanceled      = 0x201F;
exports.PTP_RC_SpecificationOfDestinationUnsupported = 0x2020;

var LOG_LEVEL = 0;
var LOG_USB = false;

function _logD() {
	if(LOG_LEVEL > 0) return;
    if(arguments.length > 0) {
        arguments[0] = "PTP-USB: " + arguments[0];
    }
    console.log.apply(console, arguments);
}

function _logE() {
	if(LOG_LEVEL > 0) return;
    if(arguments.length > 0) {
        arguments[0] = "PTP-USB: ERROR:" + arguments[0];
    }
    console.log.apply(console, arguments);
}

function _logUSB(dir, data) {
	if(!LOG_USB) return;
	var d = "<--";
	if(dir == 'out') {
		d = "-->";
	}
    console.log('PTP-USB', d, data);
}


exports.uint32buf = function(uint32) {
	var buf = new Buffer(4);
	buf.writeUInt32LE(uint32, 0);
	return buf;
}

exports.int32buf = function(int32) {
	var buf = new Buffer(4);
	buf.writeInt32LE(int32, 0);
	return buf;
}

exports.uint16buf = function(uint16) {
	var buf = new Buffer(2);
	buf.writeUInt16LE(uint16, 0);
	return buf;
}

exports.int16buf = function(int16) {
	var buf = new Buffer(2);
	buf.writeInt16LE(int16, 0);
	return buf;
}

exports.uint8buf = function(uint8) {
	var buf = new Buffer(1);
	buf.writeUInt8(uint8, 0);
	return buf;
}

exports.int8buf = function(int8) {
	var buf = new Buffer(1);
	buf.writeInt8(int8, 0);
	return buf;
}

exports.init = function(cam, callback) {
	exports.transaction(cam, exports.PTP_OC_OpenSession, [0x00000001], null, function(err, responseCode, data) {
		_logD("session open", err, exports.hex(responseCode), data);
		exports.transaction(cam, exports.PTP_OC_GetDeviceInfo, [], null, function(err, responseCode, data) {
			_logD("init complete", err, exports.hex(responseCode), data);
			if(!err && data) {
				var di = exports.parseDeviceInfo(data);
				_logD("device info:", di);
				//_logD("entering olympus pc mode...");
				callback && callback(err, di);
			} else {
				callback && callback(err);
			}
			//exports.transaction(cam, 0x1016, [0xD052], exports.uint16buf(1), function(err, responseCode, data) {
			//	_logD("olympus pc mode", err, responseCode);
			//	exports.transaction(cam, 0x9481, [0x3], null, function(err, responseCode, data)  {
			//		exports.transaction(cam, 0x9481, [0x6], null, function(err, responseCode, data) {
			//		});
			//	});
			//});
		});
	});
}

exports.setPropU8 = function(cam, prop, value, callback) {
	exports.transaction(cam, exports.PTP_OC_SetDevicePropValue, [prop], exports.uint8buf(value), function(err, responseCode, data) {
		callback && callback(err || responseCode == 0x2001 ? null : responseCode);
	});
}

exports.getPropU8 = function(cam, prop, callback) {
	exports.transaction(cam, exports.PTP_OC_GetDevicePropValue, [prop], null, function(err, responseCode, data) {
		callback && callback(err || responseCode == 0x2001 ? null : responseCode, data && data.readUInt8 && data.readUInt8(0));
	});
}

exports.setPropU16 = function(cam, prop, value, callback) {
	exports.transaction(cam, exports.PTP_OC_SetDevicePropValue, [prop], exports.uint16buf(value), function(err, responseCode, data) {
		callback && callback(err || responseCode == 0x2001 ? null : responseCode);
	});
}

exports.getPropU16 = function(cam, prop, callback) {
	exports.transaction(cam, exports.PTP_OC_GetDevicePropValue, [prop], null, function(err, responseCode, data) {
		callback && callback(err || responseCode == 0x2001 ? null : responseCode, data && data.readUInt16LE && data.readUInt16LE(0));
	});
}

exports.setProp16 = function(cam, prop, value, callback) {
	exports.transaction(cam, exports.PTP_OC_SetDevicePropValue, [prop], exports.int16buf(value), function(err, responseCode, data) {
		callback && callback(err || responseCode == 0x2001 ? null : responseCode);
	});
}

exports.getProp16 = function(cam, prop, callback) {
	exports.transaction(cam, exports.PTP_OC_GetDevicePropValue, [prop], null, function(err, responseCode, data) {
		callback && callback(err || responseCode == 0x2001 ? null : responseCode, data && data.readInt16LE && data.readInt16LE(0));
	});
}

exports.setPropU32 = function(cam, prop, value, callback) {
	exports.transaction(cam, exports.PTP_OC_SetDevicePropValue, [prop], exports.uint32buf(value), function(err, responseCode, data) {
		callback && callback(err || responseCode == 0x2001 ? null : responseCode);
	});
}

exports.getPropU32 = function(cam, prop, callback) {
	exports.transaction(cam, exports.PTP_OC_GetDevicePropValue, [prop], null, function(err, responseCode, data) {
		callback && callback(err || responseCode == 0x2001 ? null : responseCode, data && data.readUInt32LE && data.readUInt32LE(0));
	});
}

exports.setProp32 = function(cam, prop, value, callback) {
	exports.transaction(cam, exports.PTP_OC_SetDevicePropValue, [prop], exports.int32buf(value), function(err, responseCode, data) {
		callback && callback(err || responseCode == 0x2001 ? null : responseCode);
	});
}

exports.getProp32 = function(cam, prop, callback) {
	exports.transaction(cam, exports.PTP_OC_GetDevicePropValue, [prop], null, function(err, responseCode, data) {
		callback && callback(err || responseCode == 0x2001 ? null : responseCode, data && data.readInt32LE && data.readInt32LE(0));
	});
}

exports.objCopy = function(sourceObj, destObj) {
    if(!destObj) destObj = {};
    if(!sourceObj) return destObj;
    for(var k in sourceObj) {
        if(sourceObj.hasOwnProperty(k)) destObj[k] = sourceObj[k];
    }
    return destObj;
}

exports.getTypeInfo = function(type) {
	var itemSize = 0;
	var itemReadFunction = null;
	var itemWriteFunction = null;
	var typeName = "";

	switch(type) {
		case 1: {
			itemSize = 1;
			itemReadFunction = 'readInt8';
			itemWriteFunction = 'writeInt8';
			typeName = "int8";
			break;
		}
		case 2: {
			itemSize = 1;
			itemReadFunction = 'readUInt8';
			itemWriteFunction = 'writeUInt8';
			typeName = "uint8";
			break;
		}
		case 3: {
			itemSize = 2;
			itemReadFunction = 'readInt16LE';
			itemWriteFunction = 'writeInt16LE';
			typeName = "int16";
			break;
		}
		case 4: {
			itemSize = 2;
			itemReadFunction = 'readUInt16LE';
			itemWriteFunction = 'writeUInt16LE';
			typeName = "uint16";
			break;
		}
		case 5: {
			itemSize = 4;
			itemReadFunction = 'readInt32LE';
			itemWriteFunction = 'writeInt32LE';
			typeName = "int32";
			break;
		}
		case 6: {
			itemSize = 4;
			itemReadFunction = 'readUInt32LE';
			itemWriteFunction = 'writeUInt32LE';
			typeName = "uint32";
			break;
		}
		case 7: {
			itemSize = 8;
			itemReadFunction = 'readInt64LE';
			itemWriteFunction = 'writeInt64LE';
			typeName = "int64";
			break;
		}
		case 8: {
			itemSize = 8;
			itemReadFunction = 'readUInt64LE';
			itemWriteFunction = 'writeUInt64LE';
			typeName = "uint64";
			break;
		}
		default: {
			itemSize = 0;
			break;
		}
	}
	return {
		size: itemSize,
		readFunction: itemReadFunction,
		writeFunction: itemWriteFunction,
		name: typeName
	}
}

exports.listProp = function(cam, prop, callback) {
	exports.transaction(cam, exports.PTP_OC_GetDevicePropDesc, [prop], null, function(err, responseCode, data) {
		var current = null;
		var list = [];
		var type = null;
		var writeable = null;
		var itemSize = 0;
		var itemFunction = 'readUInt8';
		var typeName = "unknown";

		var error = (err || responseCode == 0x2001 ? null : responseCode);
		//console.log("data", data);
		if(!error && data && data.length >= 4) {
			type = data.readUInt16LE(2);
			writeable = data.readUInt8(4);
			var typeInfo = exports.getTypeInfo(type);
			if(typeInfo.size) {
				var index = 5 + typeInfo.size;
				if(data.length >= index + typeInfo.size) {
					current = data[typeInfo.readFunction](index);
					index += typeInfo.size;
				}
				formType = data.readUInt8(index);
				index += 1; // skip form type
				if(formType == 2) index += 2; // skip length for list type
				for(;;) {
					if(data.length >= index + typeInfo.size) {
						list.push(data[typeInfo.readFunction](index));
						index += typeInfo.size;
					} else {
						break;
					}
				}
			}
			callback && callback(error, current, list, typeInfo.name, formType);
		} else {
			callback && callback(error, null);
		}
	});
}

exports.getPropData = function(cam, prop, callback) {
	exports.transaction(cam, exports.PTP_OC_GetDevicePropValue, [prop], null, function(err, responseCode, data) {
		callback && callback(err || responseCode == 0x2001 ? null : responseCode, data);
	});
}

exports.getObjectInfo = function(cam, objectId, callback) {
	exports.transaction(cam, exports.PTP_OC_GetObjectInfo, [objectId], null, function(err, responseCode, data) {
		callback && callback(err || responseCode == 0x2001 ? null : responseCode, data && exports.parseObjectInfo(data));
	});
}

exports.getThumb = function(cam, objectId, callback) {
	exports.transaction(cam, exports.PTP_OC_GetThumb, [objectId], null, function(err, responseCode, data) {
		callback && callback(err || responseCode == 0x2001 ? null : responseCode, data);
	});
}

exports.deleteObject = function(cam, objectId, callback) {
	exports.transaction(cam, exports.PTP_OC_DeleteObject, [objectId], null, function(err, responseCode, data) {
		callback && callback(err || responseCode == 0x2001 ? null : responseCode, data);
	});
}

exports.getObject = function(cam, objectId, callback) {
	exports.transaction(cam, exports.PTP_OC_GetObject, [objectId], null, function(err, responseCode, data) {
		callback && callback(err || responseCode == 0x2001 ? null : responseCode, data);
	});
}

exports.getObjectHandles = function(cam, callback) {
	exports.transaction(cam, exports.PTP_OC_GetObjectHandles, [0xFFFFFFFF, 0x00000000], null, function(err, responseCode, data) {
		var error = (err || responseCode == 0x2001 ? null : responseCode);
		var handles = [];
		if(!error) {
            var objectCount = data.readUInt32LE(0);
            for(var i = 0; i < objectCount; i++) {
	            handles.push(data.readUInt32LE(4 + i * 4));
            }
		}
		callback && callback(err || responseCode == 0x2001 ? null : responseCode, handles);
	});
}

exports.ptpCapture = function(cam, params, callback) {
	exports.transaction(cam, exports.PTP_OC_InitiateCapture, params, null, function(err, responseCode, data) {
		callback && callback(err || responseCode == 0x2001 ? null : responseCode, data);
	});
}

exports.initiateOpenCapture = function(cam, callback) {
	exports.transaction(cam, exports.PTP_OC_InitiateOpenCapture, [0x00000000, 0x00000000], null, function(err, responseCode, data) {
		var error = err || responseCode == 0x2001 ? null : responseCode;
		if(!error) cam._openCaptureTransactionId = cam.transactionId;
		callback && callback(error, data);
	});
}

exports.terminateOpenCapture = function(cam, callback) {
	if(!cam._openCaptureTransactionId) cam._openCaptureTransactionId = 0;
	exports.transaction(cam, exports.PTP_OC_TerminateOpenCapture, [cam._openCaptureTransactionId], null, function(err, responseCode, data) {
		var error = err || responseCode == 0x2001 ? null : responseCode;
		if(!error) cam._openCaptureTransactionId = 0;
		callback && callback(err || responseCode == 0x2001 ? null : responseCode, data);
	});
}

exports.hex = function(val) {
	if(val == null) return "null";
	return "0x" + val.toString(16);
}

exports.extractJpeg = function(data, startIndex, jpegsArray) {
    if(!data) {
    	_logD("no data");
    	return null;
    }

    if(!jpegsArray) jpegsArray = [];

	var maxSearch = 6 * 1024 * 1024; // limit to first 6MB
	if(maxSearch > data.length) maxSearch = data.length;

    //console.log("   searching for jpeg...", maxSearch);
    var jpegStart = null;
    var jpegEnd = maxSearch;  
    var hasExif = false;

    var i = startIndex || 0;
    while(i < maxSearch) {

      	if(jpegStart !== null) {
	      	if(data[i + 0] == 0xFF && data[i + 1] == 0xD9) {
	    		jpegEnd = i + 2;
			    var jpegBuf = new Buffer(jpegEnd - jpegStart);
			    data.copy(jpegBuf, 0, jpegStart, jpegEnd);
			    if(data[jpegEnd] == 0x00) {
				    _logD("found jpeg at", jpegStart, "size:", jpegBuf.length, "data", data[jpegStart+3].toString(16), data[jpegEnd].toString(16));
				    jpegsArray.push({
				    	data: jpegBuf,
				    	size: jpegBuf.length,
				    	hasExif: hasExif
				    });
				    hasExif = false;
				    if(jpegsArray.length > 1 && i > 64 * 1024) break;
			    }
			    jpegStart = null;
			    if(startIndex != null) return jpegEnd;
	    	} else if(!hasExif && data[i + 0] == 45 && data[i + 1] == 78 && data[i + 1] == 69 && data[i + 1] == 66) { // has exif
	    		hasExif = true;
	    	}
	    }

    	if(data[i + 0] == 0xFF && data[i + 1] == 0xD8 && data[i + 2] == 0xFF) {
    		if(jpegStart === null) {
	    		jpegStart = i;
    		} else {
    			i += exports.extractJpeg(data, i, jpegsArray);
			    if(jpegsArray.length > 1) break;
    		}
    	}
		i++;
    }

    if(startIndex == null) {
    	var biggestIndex = null;
    	for(var i = 0; i < jpegsArray.length; i++) {
			if(biggestIndex == null) {
				biggestIndex = i;
				continue;
			}
			if(jpegsArray[i].hasExif || jpegsArray[i].size > jpegsArray[biggestIndex].size) {
				biggestIndex = i;
				continue;
			}
    	}
    	return biggestIndex == null ? null : jpegsArray[biggestIndex].data;
    } else {
	    return (jpegEnd || 0);
    }
}


exports.extractJpegSimple = function(data) {
    if(!data) {
    	_logD("no data");
    	return null;
    }
	var maxSearch = data.length;
	//if(maxSearch > 6000000) maxSearch = 6000000; // limit to first 6MB

    _logD("searching for jpeg...", maxSearch);
    var jpegStart = null;//data.indexOf("FFD8FF", 0, "hex");
    var jpegEnd = maxSearch;//data.indexOf("FFD9", jpegStart, "hex");

    var jpegDetails = {};

    var startIndex = 0;
    //for(var i = startIndex; i < maxSearch; i++) {
    //	if(data[i + 0] == 0xFF && data[i + 1] == 0xE1) {
    //		startIndex = i;
    //		break;
    //	}
    //}

    for(var i = startIndex; i < maxSearch; i++) {
    	if(data[i + 0] == 0xFF && data[i + 1] == 0xD8 && data[i + 2] == 0xFF) {
    		jpegStart = i;
    		break;
    	}
    }
    if(jpegStart === null) {
    	_logD("no jpeg found.");
    	return null;
    }

    for(var i = jpegStart + 3; i < maxSearch; i++) {
    	if(data[i + 0] == 0xFF && data[i + 1] == 0xD9) {
    		jpegEnd = i + 2;
			break;
    	}
    }

    var jpegBuf = new Buffer(jpegEnd - jpegStart);
    data.copy(jpegBuf, 0, jpegStart, jpegEnd);

    _logD("found jpeg at", jpegStart, "size:", jpegBuf.length);
    return jpegBuf;
}

exports.parseObjectInfo = function(data) {
	if(data && data.length >= 50) {
		var oi = {
			storageId: data.readUInt32LE(0),
			objectFormat: data.readUInt16LE(4),
			protectionStatus: data.readUInt16LE(6),
			objectCompressedSize: data.readUInt32LE(8),
			thumbFormat: data.readUInt16LE(12),
			thumbCompressedSize: data.readUInt32LE(14),
			thumbPixWidth: data.readUInt32LE(18),
			thumbPixHeight: data.readUInt32LE(22),
			imagePixWidth: data.readUInt32LE(26),
			imagePixHeight: data.readUInt32LE(30),
			imageBitDepth: data.readUInt32LE(34),
			parentObject: data.readUInt32LE(38),
			associationType: data.readUInt16LE(42),
			associationDesc: data.readUInt16LE(44),
			sequenceNumber: data.readUInt32LE(46),
			filename: "",
		}
		if(data.length > 52) {
			oi.filename = data.toString('utf16le', 53);
			oi.filename = oi.filename.substring(0, oi.filename.indexOf('\0'));
		}
		return oi;
	}
	return {};
}

exports.parseEvent = function(data, callback) {
	var type = null;
	var event = null;
	var param1 = null;
	var param2 = null;
	var param3 = null;
	if(data.length >= 6) type = data.readUInt16LE(4);
	if(data.length >= 8) event = data.readUInt16LE(6);
	if(data.length >= 12 + 4*1) param1 = data.readInt32LE(12+4*0);
	if(data.length >= 12 + 4*2) param2 = data.readInt32LE(12+4*1);
	if(data.length >= 12 + 4*3) param3 = data.readInt32LE(12+4*2);
	callback && callback(type, event, param1, param2, param3);
}

function runTransaction(cam, opcode, params, data, callback) {
	try {
		if(!params) params = [];
		cam.transactionId++
		var length = 12 + 4 * params.length;
		var type = 1; // command
		var maxPacket = cam.ep.in.descriptor.wMaxPacketSize;
		var CHUNK_LIMIT = 6000000;

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
				_logUSB('out', buf);
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

		var receiveErrorCount = 0;

		var receive = function(cb, rbuf) {
			_logD("reading 12 bytes...");
			cam.ep.in.transfer(packetSize(cam.ep.in, 12), function(err, data) {
				if(!err && data && data.length >= 12) {
					var rlen = data.readUInt32LE(0);
					var rtype = data.readUInt16LE(4);
					_logD("received packet type #", rtype, "total size:", rlen, "data length received:", data.length);
					if(rtype == 3) {
						var responseCode = parseResponse(data);
						_logD("completed transaction, response code", exports.hex(responseCode));
						if(rbuf) {
							rbuf = rbuf.slice(12); // strip header from data returned
							_logD("-> received", rbuf.length, "byte with err:", err);
							_logUSB("in", rbuf);
						}
						cb && cb(err, responseCode, rbuf);
					} else {
						if(rlen > data.length) {
							var remainingBytes = rlen - data.length;
							var receivedIndex = 0;
							var bigData = new Buffer(rlen);
							data.copy(bigData, receivedIndex);
							receivedIndex += data.length;
							_logD("requesting more data:", remainingBytes);

							var fetchMore = function() {
								var chunk = rlen - receivedIndex;
								if(chunk > CHUNK_LIMIT) chunk = CHUNK_LIMIT;
								cam.ep.in.transfer(packetSize(cam.ep.in, chunk), function(err, data2) {
									if(!err && data2) {
										data2.copy(bigData, receivedIndex);
										receivedIndex += data2.length;
										_logD("received", data2.length, "bytes additional");
										if(receivedIndex < rlen) {
											fetchMore();
										} else {
											receive(cb, bigData);
										}
									} else {
										_logD("ERROR", err);
										receive(cb, data);
									}
								});
							}
							fetchMore();
						} else {
							receive(cb, data);
						}
					}
				} else {
					if(err) {
						_logD("error reading:", err);
					} else {
						_logD("error reading, data length", data && data.length);
					}
					if(receiveErrorCount < 10) {
						_logD("error reading:", err);
						receiveErrorCount++;
						if(receiveErrorCount % 3 == 0) {
							if(cam.ep && cam.ep.in && cam.ep.in.clearHalt) {
								cam.ep.in.clearHalt(function(error){
									if(error) console.log("Error clearing endpoint stall:", error); else _logD("cleared endpoint stall");
									receive(cb, rbuf);
								});
							} else {
								if(receiveErrorCount < 10) {
									receive(cb, rbuf);
								} else {
									return callback && callback("not connected");
								}
							}
						} else {
							receive(cb, rbuf);
						}
					} else {
						cb && cb(err || "no data read");
					}
				}
			});
		}

		send(buf, function(err) {
			if(err) return callback && callback(err);
			return receive(callback);
		});
	} catch(e) {
		_logE("ERROR during transaction! Opcode:", exports.hex(opcode), "error:", e);
		return callback && callback("transaction error for", exports.hex(opcode));
	}
}

function nextTransaction(cam) {
	cam.transactionRunning = true;
	if(cam.transactionQueue && cam.transactionQueue.length > 0) {
		var next = cam.transactionQueue.shift();
		runTransaction(next.cam, next.opcode, next.params, next.data, function() {
			next.callback && next.callback.apply(this, arguments);	
			nextTransaction(next.cam);
		});
	} else {
		cam.transactionRunning = false;
	}
}

exports.transaction = function(cam, opcode, params, data, callback) {
	if(!cam.transactionQueue) cam.transactionQueue = [];
	cam.transactionQueue.push({
		cam: cam,
		opcode: opcode,
		params: params,
		data: data,
		callback: callback
	});

	if(!cam.transactionRunning) {
		nextTransaction(cam);
	}
}

exports.parseUnicodeString = function(buf, offset) {
	var end = offset;
	if(!buf) return "";
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
