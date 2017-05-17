var Speaker = require('speaker');
var fs = require('fs');
var exec = require('child_process').exec;
 
var sampleRate = 44100;
  
// Create the Speaker instance 
var speaker = new Speaker({
  channels: 1,          // 2 channels 
  bitDepth: 16,         // 16-bit samples 
  signed: true,
  float: false,
  sampleRate: sampleRate     // 44,100 Hz sample rate 
});
 
function sineWaveAt(sampleNumber, tone) {
  var sampleFreq = sampleRate / tone
  return Math.sin(sampleNumber / (sampleFreq / (Math.PI*2)))
}

exports.sine = function(freq, duration) {
  var toneSamples = sampleRate * duration * 2;
  var totalSamples = sampleRate * (duration < 0.1 ? 0.1 : duration) * 2;
  var beep = new Buffer(totalSamples);
   
  var val = 0;
  for(var i = 0; i < beep.length / 2; i++) {
    if(i * 2 < toneSamples) {
      val = parseInt(sineWaveAt(i, freq) * Math.pow(2, 15));
    } else {
      val = 0;
    }
    beep.writeInt16LE(val, i * 2);
  }
  return beep;
} 

exports.sine2 = function(freq1, freq2, duration) {
  var toneSamples = sampleRate * duration * 2;
  var totalSamples = sampleRate * (duration < 0.1 ? 0.1 : duration) * 2;
  var beep = new Buffer(totalSamples);
   
  var val = 0;
  for(var i = 0; i < beep.length / 2; i++) {
    if(i * 2 < toneSamples) {
      val = parseInt(sineWaveAt(i, freq1) * Math.pow(2, 14) + sineWaveAt(i, freq2) * Math.pow(2, 14));
    } else {
      val = 0;
    }
    beep.writeInt16LE(val, i * 2);
  }
  return beep;
} 

var handle = null;
var enabled = true;

exports.play = function(beep, count, intervalSeconds) {
  if(!enabled) return null;
  speaker.write(beep);
  if(count > 0 && intervalSeconds > 0) {
    count--;
    return handle = setInterval(function(){
      speaker.write(beep);
      count--;
      if(count <= 0) {
        clearInterval(handle);
        handle = null;
      }
    }, intervalSeconds * 1000)
  } else {
    return null;
  }
}
 
exports.cancel = function() {
  if(handle) {
    clearInterval(handle);
  }
}

exports.enable = function(enable, callback) {
  enabled = enable;
  exec("amixer set 'Power Amplifier' 100%", function(err){
    callback && callback(err);
  });
}

