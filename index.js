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

function write(path, msg){
  var file = fs.createWriteStream(path);
  var buffer;

  var data = Int16Array.from(msg.stream, function (val) {
    return val*32768;
  });

  var size = data.length*2;
  file.write(header(size, {
    bitDepth: 16,
    sampleRate: 8000,
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

  file.write(buffer);
  file.end();
}

async function run(path, socket, msg){
  await write(path, msg);
  await exec('echo querying...');
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

var port = process.env.PORT || nconf.get('server:port');
var server = https.createServer(options, app).listen(port, function () {
  console.log('listening on *:', port);
});
io = io.listen(server);

io.on('connection', function(socket) {

  socket.on('record', function(msg) {
    var path = 'queries/'+socket.id+'.wav';
    run(path, socket, msg);
  });
});
