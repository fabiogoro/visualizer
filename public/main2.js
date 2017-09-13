function initAudio() {
  if (!navigator.getUserMedia)
    navigator.getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
  if (!navigator.cancelAnimationFrame)
    navigator.cancelAnimationFrame = navigator.webkitCancelAnimationFrame || navigator.mozCancelAnimationFrame;
  if (!navigator.requestAnimationFrame)
    navigator.requestAnimationFrame = navigator.webkitRequestAnimationFrame || navigator.mozRequestAnimationFrame;

}
initAudio();

var socket = io();
var recorder;

var audio_context = new AudioContext();
var osc;
socket.on('ans', function(message) {
  console.log(message);
  var events = JSON.parse(message);
  osc = audio_context.createOscillator();
  osc.start(audio_context.currentTime);
  osc.connect(audio_context.destination);
  var i;
  for(i in events){
    var frequency = Math.pow(2, (events[i][1] - 69) / 12)*440;
    osc.frequency.setValueAtTime(frequency, audio_context.currentTime+events[i][0]/1000);
  }
  osc.stop(audio_context.currentTime+events[i][0]/1000);
});

function send() {
  socket.emit('init', '');
  recorder.startCapture(function(stream, streamInfo) {
    socket.emit('talk', { stream: stream, streamInfo: streamInfo });
  });
}

function end() {
  recorder.stopCapture();
  socket.emit('end', '');
}

window.onload = function() {
  recorder = new Recorder();
  recorder.turnOn(function(){return});
  var recorderButton = document.getElementById('recorder');
  recorderButton.addEventListener('touchstart', send);
  recorderButton.addEventListener('mousedown', send);
  recorderButton.addEventListener('mouseup', end);
  recorderButton.addEventListener('touchend', end);
}
function Recorder() {
  this.captureContext = new AudioContext();
  this.currentCaptureStream = null;
  this.currentAudioInput = null;
  this.currentCaptureProcessorNode = null;
  this.analyser = null;
  this.dataArray = null;

  this.paused = false;

  this.playbackContext = new AudioContext();
  this.bufferQueue = [];
  this.currentPlaybackBuffer = null;
}

Recorder.prototype._tryProcessNextServerAudioBuffer = function() {
  if (this.currentPlaybackBuffer != null)
    return;
  this._processNextServerAudioBuffer();
}

Recorder.prototype.turnOn = function(callback) {
  var self = this;
  navigator.getUserMedia({
    audio: true,
    video: false
  }, function(stream) {
    self._setupCapture(stream);
    callback(self);
  }, function(error) {
    alert('No mic.');
  });
};

Recorder.prototype._setupCapture = function(stream) {
  var self = this;
  self.currentAudioInput = self.captureContext.createMediaStreamSource(stream);
  self.currentCaptureProcessorNode = self.captureContext.createScriptProcessor(8192, 1, 1);
  /*self.biquadFilter = self.captureContext.createBiquadFilter();
  self.biquadFilter.type = "lowpass";
  self.biquadFilter.frequency.value = 8000;
  self.analyser = self.captureContext.createAnalyser();
  self.analyser.fftSize = 8192*2;
  self.dataArray = new Uint8Array(self.analyser.frequencyBinCount)
  self.biquadFilter.connect(self.analyser);
  */self.currentCaptureStream = stream;
  stream.onended = function() {
    self.currentAudioInput.disconnect();
    self.currentAudioInput = null;
    self.currentCaptureProcessorNode.disconnect();
    self.currentCaptureProcessorNode = null;
    self.currentCaptureStream = null;
  };
};

Recorder.prototype.turnOff = function(callback) {
  this.currentCaptureStream.getTracks().forEach(function(t) {
    t.stop();
  });
};

Recorder.prototype.startCapture = function(callback) {
  var sr = 8000;
  var self = this;
  self.paused = false;

  self.currentCaptureProcessorNode.onaudioprocess = function(e) {
    var buffer = e.inputBuffer;

    var offlineCtx = new OfflineAudioContext(1,8192*sr/44100,sr);
    var analyser = offlineCtx.createAnalyser();
    analyser.fftSize = 8192*2;
    var dataArray = new Uint8Array(analyser.frequencyBinCount)
    source = offlineCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(offlineCtx.destination);
    source.start();
    offlineCtx.startRendering().then(function(renderedBuffer) {
      //console.log('Rendering completed successfully');
      analyser.getByteTimeDomainData(dataArray);
      buffer = renderedBuffer.getChannelData(0);
      var intBuffer = new Uint32Array(buffer.length);
      buffer.map(function(f, i) {intBuffer[i] = f * Math.pow(2, 16) / 2;});
      console.log(intBuffer);
      callback(Array.apply([], intBuffer), {
        sampleRate: self.captureContext.sampleRate,
        channels: 1
      });
      self._logVolume(buffer, "in");
    }).catch(function(err) {
      console.log('Rendering failed: ' + err);
    });

    //var buffer = e.inputBuffer.getChannelData(0);
    //var buffer = resample(e.inputBuffer, e.inputBuffer.length, 8000);
    //var buffer = self.dataArray.filter((value, index, Arr) => {return index % downsampleRate == 0;});
    //buffer = self.dataArray;

    if (self.paused) {
      self.currentCaptureProcessorNode.disconnect(); //Wait to disconnect once the buffer has finished processing
    }
  };
  self.currentAudioInput.connect(self.currentCaptureProcessorNode);
  self.currentCaptureProcessorNode.connect(self.captureContext.destination);
};

Recorder.prototype.stopCapture = function() {
  this.paused = true;
  this.currentAudioInput.disconnect();
  document.getElementById('recorder').style.borderWidth = 10+'vw';
};

Recorder.prototype._logVolume = function(buffer, tag) {
  var sum = 0;

  for (var i = 0; i < buffer.length; i++) {
    var currentValue = buffer[i];
    sum += currentValue * currentValue;
  }
  var rms = Math.sqrt(sum / buffer.length);
  var width = rms*100+15+'vw';
  document.getElementById('recorder').style.borderWidth = width;
};



// define online and offline audio context
async function resample(buffer, sr){
  var offlineCtx = new OfflineAudioContext(1,sr,sr);
  source = offlineCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(offlineCtx.destination);
  source.start();
  await offlineCtx.startRendering().then(function(renderedBuffer) {
    //console.log('Rendering completed successfully');
    buffer = renderedBuffer;
  }).catch(function(err) {
    //console.log('Rendering failed: ' + err);
    return null;
  });
  console.log(buffer.length);
  return buffer;
}
