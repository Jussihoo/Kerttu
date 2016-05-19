"use strict";
var restify = require("restify");
var server = restify.createServer({
  name: 'Kerttu',
  version: '1.0.0'
});
var socketio  = require ("socket.io");

// MongoDB
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var db;

var tempMeasurements = [];

server.use(restify.bodyParser());

// REMOVE THESE?? Needed for enabling CORS and needed for allowing cross-origin resource sharing 
server.use(restify.CORS());
server.use(restify.fullResponse());

// socket
var io = socketio.listen(server.server);


var MeasurementPackage = []; // init

var StoreTempData = function(currentTemp, timestamp) {
   db.collection('temperature').insert({time: timestamp, temp: currentTemp}, function(err, result) {
      assert.equal(err, null);
      console.log("stored temperature data into the database");
  });
}

var sendRes = function(res,items){
    res.send(items);
};

function getTempData(res,callback){
    db.collection('temperature').find({time: {$gte: new Date(new Date().setDate(new Date().getDate()-1))}},{time:1, temp:1, _id:0}).sort({ $natural: -1 }).limit(144).toArray(function(err,items){ // get the last 24 hours
           assert.equal(err, null);
           items.reverse(); // change the order to be from oldest to newest timestamps
           console.dir(items); // remove this 
           callback( res, items); // once all items read from database (asynchronous call), call the callback function and send the response        
    });
};

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

// connect to the database
var url = 'mongodb://localhost:27017/Kerttu';
var ObjectId = require('mongodb').ObjectID;
MongoClient.connect(url, function(err, database) {
  assert.equal(null, err);
  db = database;
  console.log("Connected correctly to the database.");
});

//REST API implementation for getting the initial temperature data to be shown in the UI
server.get('/getTempData', function (req, res, next) {
    getTempData(res, sendRes);
    console.log ("A request to get temperature data from the database was received");
    next();
});

// REST API implementation for handling the push messages from the Thingsee IOT
server.post('/', function (req, res, next) {
    var time = new Date();
    var hh = addZero(time.getHours());
    var mm = addZero(time.getMinutes());
    var ss = addZero(time.getSeconds());
    var consoleTime = hh + ":" + mm + ":" + ss; 
    var currentTemp = 0; // init
    
    console.log('got IOT message from Lutikka. Timestamp ' + consoleTime); // remove this
    console.log("The measured temperature is " + req.params[0].senses[0].val); // remove this
    var currentTemp = req.params[0].senses[0].val
    PushMeasuredData(currentTemp, time); // send data to browser
    StoreTempData(currentTemp, time);

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
