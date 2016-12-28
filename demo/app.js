var express = require('express');
var app = express();
var expressWs = require('express-ws')(app);
var os = require('os');
var pty = require('pty.js');
var request = require('request');
var terminals = {},
    logs = {};

app.all('*', function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Accept,X-Requested-With,Sec-Websocket-Version,Sec-Websocket-Extensions,Sec-Websocket-Key,pragma, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, Api-Version, Authorization");
    res.header("Access-Control-Allow-Methods","PUT,POST,GET,DELETE,OPTIONS");
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    next();
});

app.use('/build', express.static(__dirname + '/../build'));
app.use('/addons', express.static(__dirname + '/../addons'));
app.use(function (req,res,next) {
    
  if(req.method == 'OPTIONS'){
    next()
  }else{
     headers = req.headers;
    authorization = headers.authorization;
    if (authorization == null || authorization == "" || authorization == undefined){
      res.jsonp({
        code: -1,
        message :'无权访问!!' + authorization
      })
    }
  const options = {
    url: 'http://api.gospely.com/users/authorization',
    headers: {
      'Authorization': authorization
    }
  };
  request(options,function (err,response,body) {
    if (!err && response.statusCode == 200){
      res = JSON.parse(body);
      if (res.code === 1){
        next()
      }else {
        res.jsonp({
          code: -1,
          message :'无权访问!!'
        })
      }
    }
  });
  }
});

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

app.get('/style.css', function(req, res){
  res.sendFile(__dirname + '/style.css');
});

app.get('/main.js', function(req, res){
  res.sendFile(__dirname + '/main.js');
});



app.post('/terminals', function (req, res) {
  var cols = parseInt(req.query.cols),
      rows = parseInt(req.query.rows),
      term = pty.spawn(process.platform === 'win32' ? 'cmd.exe' : 'bash', [], {
        name: 'xterm-color',
        cols: cols || 80,
        rows: rows || 24,
        cwd: process.env.PWD,
        env: process.env
      });

  console.log('Created terminal with PID: ' + term.pid);
  terminals[term.pid] = term;
  logs[term.pid] = '';
  term.on('data', function(data) {
    logs[term.pid] += data;
  });
  res.send(term.pid.toString());
  res.end();
});

app.post('/terminals/:pid/size', function (req, res) {
  var pid = parseInt(req.params.pid),
      cols = parseInt(req.query.cols),
      rows = parseInt(req.query.rows),
      term = terminals[pid];

  term.resize(cols, rows);
  console.log('Resized terminal ' + pid + ' to ' + cols + ' cols and ' + rows + ' rows.');
  res.end();
});

app.ws('/terminals/:pid', function (ws, req) {
  var term = terminals[parseInt(req.params.pid)];
  console.log('Connected to terminal ' + term.pid);
  ws.send(logs[term.pid]);

  term.on('data', function(data) {
    try {
      ws.send(data);
    } catch (ex) {
      // The WebSocket is not open, ignore
    }
  });
  ws.on('message', function(msg) {
    term.write(msg);
  });
  ws.on('close', function () {
    process.kill(term.pid);
    console.log('Closed terminal ' + term.pid);
    // Clean things up
    delete terminals[term.pid];
    delete logs[term.pid];
  });
});

var port = process.env.PORT || 3000,
    host = os.platform() === 'win32' ? '127.0.0.1' : '0.0.0.0';

console.log('App listening to http://' + host + ':' + port);
app.listen(port, host);
