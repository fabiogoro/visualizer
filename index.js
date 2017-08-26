var express = require('express'),
  app = express(),
  http = require('http').Server(app),
  io = require('socket.io')(http),
  fs = require('fs'),
  nconf = require('nconf'),
  wav = require('wav');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
var buffer;

async function run(path, socket) {
  await exec('asymut -w 256 -s 64 -i '+path+' | peak_filter | pda | pitch2note > '+path+'.csv');
  const { stdout } = await exec('python3 qbh.py '+path+'.csv');
  socket.emit('ans', stdout);
}

nconf.argv()
  .env()
  .file({
    file: 'config.json'
  });

app.use(express.static('public'));

io.on('connection', function(socket) {
  socket.join('walkie-talkie');

  socket.on('talk', function(msg) {
    buffer = buffer.concat(msg.stream);
  });
  socket.on('init', function() {
    buffer = [];
  });
  socket.on('end', function() {
    var path = 'queries/'+socket.id+'.wav';
    var writer = new wav.FileWriter(path, {channels: 1, bitDepth: 8, sampleRate: 11025});
    writer.write(new Buffer(buffer));
    writer.end();
    run(path, socket);
  });
});

var port = process.env.PORT || nconf.get('server:port');
http.listen(port, function() {
  console.log('listening on *:', port);
});

