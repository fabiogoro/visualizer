var express = require('express'),
  app = express(),
  https = require('https'),
  io = require('socket.io'),
  fs = require('fs'),
  nconf = require('nconf'),
  header = require('waveheader');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem'),
  requestCert: false,
  rejectUnauthorized: false
};

var redirectApp = express(),
    redirectServer = require('http').createServer(redirectApp);

redirectApp.use(function requireHTTPS(req, res, next) {
  if (!req.secure) {
    return res.redirect('https://' + req.headers.host + req.url);
  }
  next();
})

redirectServer.listen(80);

function write(path, msg, callback){
  var file = fs.createWriteStream(path);
  var buffer;

  var data = Int16Array.from(msg.stream, function (val) {
    return val*32768;
  });

  var size = data.length*2;
  file.write(header(size, {
    bitDepth: 16,
    sampleRate: 44100,
    channels: 1
  }));

  if (Buffer.allocUnsafe) { 
    buffer = Buffer.allocUnsafe(size);
  } else {
    buffer = new Buffer(size);
  }

  data.forEach(function (value, index) {
    buffer.writeInt16LE(value, index * 2)
  });

  file.write(buffer, callback);
  file.end();
}

var syscall = function(cmd, callback) {
  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return;
    }

    callback(stdout);
  });
}

function run_nowrite(path, socket){
  //exec('asymut -w 256 -s 64 -i '+path+' | peak_filter | pda | pitch2note > '+path+'.csv', function(err, out){
  console.log(path)
  exec('python3 audio_to_midi_melodia.py '+path+' '+path+'.mid 130 --minduration 0.1 --smooth 0.5', function(err, out){
    exec('midicsv '+path+'.mid '+path+'.csv', function(err, out){
      exec('python3 qbh_dtw.py '+path+'.csv', function(err, out){
        socket.emit('ans', out);
      });
    });
  });
}

function run(path, socket, msg){
  write(path, msg, function(){
  console.log(path)
    //exec('asymut -w 256 -s 64 -i '+path+' | peak_filter | pda | pitch2note > '+path+'.csv', function(err, out){
    exec('python3 audio_to_midi_melodia.py '+path+' '+path+'.mid 130 --minduration 0.04 --smooth 0.5', function(err, out){
      exec('midicsv '+path+'.mid '+path+'.csv', function(err, out){
        exec('python3 qbh.py '+path+'.csv', function(err, out){
          socket.emit('ans', out);
        });
      });
    });
  });
}

nconf.argv()
  .env()
  .file({
    file: 'config.json'
  });

app.use(express.static('public'));

var port = process.env.PORT || nconf.get('server:port');
var server = https.createServer(options, app).listen(port, function () {
  console.log('listening on *:', port);
});
io = io.listen(server);

io.on('connection', function(socket) {
  socket.on('test', function(){
    var path = 'queries/6_-EfdjB82exiyrjAAAc.wav';
    run_nowrite(path, socket);
  });

  socket.on('record', function(msg) {
    var path = 'queries/'+socket.id+'.wav';
    run(path, socket, msg);
  });
});
