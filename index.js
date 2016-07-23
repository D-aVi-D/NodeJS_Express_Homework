var express = require('express');
var bodyParser = require('body-parser');
var socketio = require('socket.io');
var datetime = require('node-datetime');
var mongodb = require('mongodb');

var app = express();
var server = app.listen(5555);
var io = socketio.listen(server);

var staticDir = __dirname + '/public/';
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

var messages = [];

var MongoClient = mongodb.MongoClient;
//console.log(MongoClient);
var url = 'mongodb://127.0.0.1:27017/BinaryDB';
var dblink;
MongoClient.connect(url, function (err, db) {
	dblink = db;
	if (err) {
		console.log('Unable to connect to the mongoDB server. Error:', err);
		throw err;
	} else {
		console.log('Connection established to', url);
	}
	//db.close();
});

var getDBMessages = function(){
	
	//console.log('DBlink: ' + dblink);
	if (dblink != null){
		dblink.collection('chat', function(err, collection) {
  			collection.find({}, function(err, cursor) {
  				if (err){
  					console.log('Cursor error: ' + err);
  				} else {
  					//console.log('Cursor: ok');
  					cursor.toArray(function(err, items){
  						if (err){
  							console.log('getDBMessages() toArray error: ' + err);
  							throw err;
  						} else {
  							//console.log('toArray: ok');
  							messages = items;
  						}
  					});
  				}	
  			})
		});
	}
	//console.log('Recieved messages: '+ messages);
	return messages;
}

var pushDBMessage = function(lmsg){
	if (dblink != null){
		dblink.collection('chat', function(err, collection) {
  			collection.insert(lmsg, function(err, item) {
  				if (err){
  					console.log('pushDBMessage() insert error: ' + err);
  					throw err;
  				} else {
  					//console.log('Insert: ok');
  				}	
  			})
		});
	}	
	return lmsg;
}

var correctShutdown = function() {
  console.log("Received kill signal");
  server.close(function() {
    console.log("Closed out remaining connections");
    dblink.close();
    process.exit();
  });
   setTimeout(function() {
       console.error("Connections still not closed, shutting down immediately");
       process.exit()
  }, 5*1000);
}

process.on ('SIGTERM', correctShutdown);
process.on ('SIGINT', correctShutdown);   


app.get('/', function (req, res) {
	res.sendFile(staticDir + 'index.html');
});

app.get('/messages', function (req, res) {
	res.json(getDBMessages());
});

app.post('/messages', function (req, res) {
	var message = req.body;
	//messages.push(message);
	pushDBMessage(message);
	res.json(message);
	console.log(message);
});

app.get('/sockets', function (req, res) {
	res.sendFile(staticDir + 'index_socket.html');
});

io.on('connection', function(socket) {
	
	var formatted_date = datetime.create().format('d/m/Y H:M:S');

	console.log(formatted_date +': Client connected');

	socket.on('disconnected', function() {
		console.log('Client disconnected');
	});

	socket.on('chat message', function(msg) {
		//messages.push(msg);
		pushDBMessage(msg);
		io.emit('chat message', msg);
		console.log(msg);
	});

	//socket.emit('chat history', messages);
	socket.emit('chat history', getDBMessages());
	setInterval(function() {
		//alert('Renewing history completed');
		socket.emit('chat history', getDBMessages());
	}, 5000);
});