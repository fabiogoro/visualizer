var express = require('express'),
  app = express(),
  https = require('https'),
  io = require('socket.io'),
  fs = require('fs'),
  nconf = require('nconf'),
  wav = require('wav');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
var buffer;

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

function write(path){
	var writer = new wav.FileWriter(path, {channels: 1, bitDepth: 8, sampleRate: 11025});
	writer.write(new Buffer(buffer));
	writer.end();
}

async function run(path, socket) {
  await write(path);
  await exec('echo querying...');
  await exec('asymut -w 256 -s 64 -i '+path+' | peak_filter | pda | pitch2note > '+path+'.csv');
  const { stdout } = await exec('qbh-server/bin/python qbh.py '+path+'.csv');
  socket.emit('ans', stdout);
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
  socket.join('walkie-talkie');

  socket.on('talk', function(msg) {
    buffer = buffer.concat(msg.stream);
  });
  socket.on('init', function() {
    buffer = [];
  });
  socket.on('end', function() {
    var path = 'queries/'+socket.id+'.wav';
    run(path, socket);
  });
});


