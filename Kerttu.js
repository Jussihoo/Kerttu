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

function getVisitorCounter(res,callback){
   db.collection('log').count(function(err,visitorCount){ // get the amount of log items
   assert.equal(err, null);
     console.dir(visitorCount); // remove this 
     callback( res, JSON.stringify(visitorCount)); // once the count is read from database (asynchronous call), call the callback function and send the response        
   });  
}

function storeLogdata(logdata, res, callback) {
  console.dir(logdata);
  db.collection('log').insert(logdata, function(err, result) {
     assert.equal(err, null);
     callback( res, sendRes); // once all items read from database (asynchronous call), call the callback function and send the response        
  });
}

function getButtonStats(res, items, callback){
  var logs = {};
  logs["logitems"] = items;
  db.collection('buttonStats').find({},{_id:0}).toArray(function(err,stats) {
     assert.equal(err, null);
     logs["stats"] = stats;
     callback(res, logs); // once all items read from database (asynchronous call), call the callback function and send the response        
  });  
}

function getLogdata(res, callback) {
  db.collection('log').find({},{ip:1,hostname:1,time:1,_id:0}).sort({time:1}).toArray(function(err,items) {
     assert.equal(err, null);
     callback(res, items, sendRes); // once all items read from database (asynchronous call), call the callback function and send the response        
  });
}

function storeButtonStats(range, res,callback){
  console.log("store button data into the DB " + range);
  var data = {};
  data[range] = 1;
  db.collection('buttonStats').update({},{$inc: data},{upsert: true}, function(err, result) { // increment range value by one
     assert.equal(err, null);
     callback( range, res, sendRes); // once the buttonStats have been updated into the database (asynchronous call), call the callback function and getTempData        
  });
}

function getTempData(range, res,callback){
    console.dir(range);
    db.collection('temperature').find({time: {$gte: new Date(new Date().setHours(new Date().getHours()-range))}},{time:1, temp:1, _id:0}).sort({ time: 1 }).toArray(function(err,items){ // get the samples from database
           assert.equal(err, null);
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
server.post('/getTempData', function (req, res, next) {
    if (req.params.buttonStats){ // button has been pressed, store stats into database
      storeButtonStats(req.params.range, res, getTempData );
    }
    else
    { // button has not been pressed, no need to store stats into database
      getTempData(req.params, res, sendRes);
      console.log ("A request to get temperature data for last " + req.params + " hours from the database was received");
    }
    next();
});

//REST API implementation for getting the log data from the client
server.post('/sendLog', function (req, res, next) {
    var logdata = req.params;
    logdata.browser = req.headers['user-agent']; // store browser info
    logdata.time = new Date();
    console.log ("Log information received");
    console.dir (req.headers);
    storeLogdata(logdata, res, getVisitorCounter);
    next();
});

//REST API implementation for getting the log data from the client
server.post('/getLog', function (req, res, next) {
    console.log ("Log request received");
    getLogdata(res, getButtonStats);
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
