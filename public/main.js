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

socket.on('ans', function(message) {
  message = JSON.parse(message);
  document.body.innerHTML = '<button id=res class=player></button><button id=trans class=player></button>';
  var play_res = document.getElementById('res');
  play_res.addEventListener('mousedown', function(){play(message['res'])});
  var play_trans = document.getElementById('trans');
  play_trans.addEventListener('mousedown', function(){play(message['trans'])});
});

function play(events) {
  osc = audio_context.createOscillator();
  osc.start(audio_context.currentTime);
  osc.connect(audio_context.destination);
  var i;
  for(i in events){
    var frequency = Math.pow(2, (events[i][1] - 69) / 12)*440;
    osc.frequency.setValueAtTime(frequency, audio_context.currentTime+events[i][0]/1000);
  }
  osc.stop(audio_context.currentTime+events[i][0]/1000);
}

var vec;
function send() {
  vec = [];
  recorder.startCapture(function(stream, streamInfo) {
    vec = vec.concat(stream);
  });
}

function end() {
  var sr = 8000;
  var n = vec.length;
  vec = new Float32Array(vec);
  var buffer = audio_context.createBuffer(1, n, audio_context.sampleRate);
  buffer.copyToChannel(vec, 0, 0);

  var resampler = new OfflineAudioContext(1,n*sr/44100,sr);
  source = resampler.createBufferSource();
  source.buffer = buffer;
  source.connect(resampler.destination);
  source.start();
  resampler.startRendering().then(function(renderedBuffer) {
    socket.emit('record', { stream: Array.apply([], renderedBuffer.getChannelData(0)) });
  });

  recorder.stopCapture();
  vec = [];
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
    alert('No access to microphone, it won\'t be possible to record audio.');
  });
};

Recorder.prototype._setupCapture = function(stream) {
  var self = this;
  self.currentAudioInput = self.captureContext.createMediaStreamSource(stream);
  self.currentCaptureProcessorNode = self.captureContext.createScriptProcessor(1024, 1, 1);
  self.currentCaptureStream = stream;
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
  var self = this;
  self.paused = false;

  self.currentCaptureProcessorNode.onaudioprocess = function(e) {
    var buffer = e.inputBuffer;
    buffer = buffer.getChannelData(0);
    self._logVolume(buffer);
    callback(Array.apply([], buffer), {
      sampleRate: self.captureContext.sampleRate,
      channels: 1
    });
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
  var width = rms*10+10+'vh';
  document.getElementById('recorder').style.borderWidth = width;
};
