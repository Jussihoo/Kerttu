"use strict";
var restify = require("restify");
var server = restify.createServer({
  name: 'Kerttu',
  version: '1.0.0'
});
var socketio  = require ("socket.io");

server.use(restify.bodyParser());

// socket
var io = socketio.listen(server.server);

var MeasurementPackage = []; // init

function PushMeasuredData(currentTemp, timestamp){
  var data = { temp: currentTemp, time: timestamp };
  io.emit('PushData', JSON.stringify(data));  // send data to browser
}

function addZero(i) { // adds leading zero to timestamp to get double digit figure
if (i < 10) {
      i = "0" + i;
    }
    return i;
}

server.post('/', function (req, res, next) {
    var time = new Date();
    var hh = addZero(time.getHours());
    var mm = addZero(time.getMinutes());
    var ss = addZero(time.getSeconds());
    time = hh + ":" + mm + ":" + ss; 
    var currentTemp = 0; // init
    
    console.log('got IOT message from Lutikka. Timestamp ' + time); // remove this
    console.log("The measured temperature is " + req.params[0].senses[0].val); // remove this
    var currentTemp = req.params[0].senses[0].val
    PushMeasuredData(currentTemp, time);

    res.send(Number(200)); // sen reply, otherwise Thingsee does not send next measurement normally
    next();
});

// Socket handling
io.sockets.on('connection', function (socket) {
    //wait for client to make a socket connection
    console.log("socket connection has been made");
});

server.listen(8080, function () {
    console.log('Node.js weatherMachine Kerttu listening at %s', server.url);
});
