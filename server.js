var os = require('os');

//explaination http://www.kevinleary.net/simple-node-static-server/
//modules
var static = require('node-static');

//from node.js
var http = require('http');
var socketIO = require('socket.io');

//config
var fileServer = new(static.Server)();
//http.createServer return http.server
//https://nodejs.org/api/http.html#http_http_createserver_requestlistener

//this is an anonymous function that defines what happens 
//with each request to the server and response from the server.
//function(req,res) {
//	fileServer.server(req,res);
//}
//server
var app = http.createServer(function (req, res) {
  fileServer.serve(req, res);
}).listen(process.env.PORT || 2013);

//server is instantiated (note: not connected to) we will open a listener for socket.io. 
//This means that our server will ‘listen’ for pages loaded by the server 
//that have a WebSocket connection instantiated on them.
//http://danielnill.com/nodejs-tutorial-with-socketio/
var io = socketIO.listen(app);

io.sockets.on('connection', function (socket){

    // convenience function to log server messages on the client
    function log(){
		var array = [">>> Message from server:"];
        array.push.apply(array, arguments);
	    socket.emit('log', array);
	}
    //comment out for production
	socket.on('message', function (message) {
		log('Client said:', message);
        // for a real app, would be room only (not broadcast)
		socket.broadcast.emit('message', message);
	});

	socket.on('create or join', function (room) {
        log('Request to create or join room ' + room);
        log(io.sockets.adapter.rooms);

		var numClients = io.sockets.adapter.rooms[room]!=undefined ? (io.sockets.adapter.rooms).length:0;
		log('Room ' + room + ' has ' + numClients + ' client(s)');
		log(io.sockets.adapter.rooms[room]);
		
		
		//JLIU TODO io.sockets.adapter.rooms is null  
		

		if (numClients === 0){
			socket.join(room);
			socket.emit('created', room, socket.id);


		} else if (numClients === 1) {
			socket.join(room);
            socket.emit('joined', room, socket.id);
            io.sockets.in(room).emit('ready');

		} else { // max two clients
			socket.emit('full', room);
		}
	});
     
   
    socket.on('ipaddr', function () {
        var ifaces = os.networkInterfaces();
        for (var dev in ifaces) {
            ifaces[dev].forEach(function (details) {
                if (details.family=='IPv4' && details.address != '127.0.0.1') {
                    socket.emit('ipaddr', details.address);
                    log('Server IP address is: ' + details.address);
                }
          });
        }
    });

});


