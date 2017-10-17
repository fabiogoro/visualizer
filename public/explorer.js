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
function test(){
  socket.emit('test');
}
var recorder;

var audio_context = new AudioContext();

var lt;
var time_count;
function draw(element, array, last_tick){
  canvas_context = element.getContext('2d');
  canvas_context.fillStyle = '#222222';
  var last_time = array[0][0];
  for(i in array){
    var time = array[i][0];
    if(array[i][2]==0){
      var pitch = array[i][1];
      canvas_context.fillRect(Math.floor(last_time/last_tick*element.width), pitch%12/12*100, Math.floor((time-last_time)/last_tick*element.width), 10);
    }
    last_time = time;
  }
  lt = last_tick;
}

var last_image = null;
var jump;
function marker(element){
  canvas_context = element.getContext('2d');
  if(last_image!=null) {
    var last_time = Math.floor(time_count);
    canvas_context.clearRect(last_time,0,2,100);
    canvas_context.putImageData(last_image,last_time,0);
    time_count = time_count+jump;
  }
  var last_time = Math.floor(time_count);
  last_image = canvas_context.getImageData(last_time, 0, 2, 100);
  canvas_context.fillRect(last_time, 0, 2, 100);
  if(last_time < element.width) window.requestAnimationFrame(()=>marker(element));
  else {
    canvas_context.clearRect(last_time-jump,0,2,100);
    canvas_context.putImageData(last_image,last_time-jump,0);
    playing=false;
  }
}

socket.on('ans', function(message) {
  message = JSON.parse(message);
  document.body.innerHTML = '';
  var button_res = document.createElement("button");
  button_res.setAttribute("id", "res");
  button_res.setAttribute("class", "player");
  document.body.appendChild(button_res);
  var canvas_res = document.createElement("canvas");
  canvas_res.setAttribute("id", "canvas_res");
  canvas_res.setAttribute("class", "visualizer");
  draw(canvas_res, message['res'], message['res'][message['res'].length-1][0]);
  document.body.appendChild(canvas_res);
  var button_trans = document.createElement("button");
  button_trans.setAttribute("id", "trans");
  button_trans.setAttribute("class", "player");
  document.body.appendChild(button_trans);
  var canvas_trans = document.createElement("canvas");
  canvas_trans.setAttribute("id", "canvas_trans");
  canvas_trans.setAttribute("class", "visualizer");
  draw(canvas_trans, message['trans'], message['res'][message['res'].length-1][0]);
  document.body.appendChild(canvas_trans);
  button_res.addEventListener('mousedown', function(){play(message['res'], '_res')});
  button_trans.addEventListener('mousedown', function(){play(message['trans'], '_trans')});
});

var playing = false;
function play(events, which) {
  if(playing == false){
    playing = true;
    osc = audio_context.createOscillator();
    osc.start(audio_context.currentTime);
    osc.connect(audio_context.destination);
    osc.frequency.setValueAtTime(0, audio_context.currentTime);
    var i;
    for(i in events){
      var frequency = Math.pow(2, (events[i][1]%12) / 12)*440;
      osc.frequency.setValueAtTime(frequency, audio_context.currentTime+events[i][0]/1000);
    }
    osc.stop(audio_context.currentTime+events[i][0]/1000);
    time_count = 0;
    var element = document.getElementById('canvas'+which);
    jump = 16.55*element.width/lt;
    marker(element);
  }
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
