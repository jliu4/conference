
var isUseHTTPs = !(!!process.env.PORT || !!process.env.IP);

var server = require(isUseHTTPs ? 'https' : 'http'),
    url = require('url'),
    path = require('path'),
    fs = require('fs');

var static = require('node-static');
var socketIO = require('socket.io');
var file = new(static.Server)();
var app;

if (isUseHTTPs) {
    var options = {
        key: fs.readFileSync(path.join(__dirname, 'keys/server.key')),
        cert: fs.readFileSync(path.join(__dirname, 'keys/server.crt'))
    };

    app = server.createServer(options,function (req, res) {
         file.serve(req, res);

})} else app = server.createServer(function (req, res) {
        file.serve(req, res);
});

app = app.listen(process.env.PORT || 9001, process.env.IP || "0.0.0.0", function() {
    var addr = app.address();
    console.log("Server listening at", addr.address + ":" + addr.port);
});

var io = socketIO.listen(app);
io.sockets.on('connection', function (socket) {
    socket.on('message', function (data) {
        socket.broadcast.emit('message', data);
    });
});

