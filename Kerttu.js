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

server.use(restify.bodyParser());

// REMOVE THESE?? Needed for enabling CORS and needed for allowing cross-origin resource sharing 
server.use(restify.CORS());
server.use(restify.fullResponse());

// socket
var io = socketio.listen(server.server);

var storeSensesData = function(collection,sense, value, timestamp) {
   var senseData = {};
   senseData["time"] = timestamp;
   senseData[sense]  = value;  
   db.collection(collection).insert(senseData, function(err, result) {
      assert.equal(err, null);
      console.log("stored senses data into the database for " + collection + " collection");
  });
}

var sendRes = function(res,items){
    console.dir(items);
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

function getChargerdata(res, batteryData, callback) {
  db.collection('charger').find({},{time:1,_id:0}).sort({time:-1}).limit(1).toArray(function(err,item) {
     assert.equal(err, null);
     var charger = false;
     console.log("patteriaika " + new Date(batteryData.battery.time) + " ja chargeraika" + new Date(item[0].time))
     if (new Date(item[0].time) - new Date(batteryData.battery.time) == 0){ // charger is ON, same timestamp on battery and charger collections
        charger = true;
        console.log("charger is on");
     }
     batteryData.charger = charger;
     callback(res, batteryData); // once the item read from database (asynchronous call), call the callback function and send the response        
  });
}

function getBatterydata(res, callback) {
  var batteryData = {};
  db.collection('battery').find({},{battery:1,time:1,_id:0}).sort({time:-1}).limit(1).toArray(function(err,item) {
     assert.equal(err, null);
     batteryData.battery = item[0];
     callback(res, batteryData, sendRes); // once the item read from database (asynchronous call), call the callback function and get charger data        
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
     callback( range, res, getPressureData); // once the buttonStats have been updated into the database (asynchronous call), call the callback function and getTempData        
  });
}
function getHumidityData(range, res, samples, callback){
    db.collection('humidity').find({time: {$gte: new Date(new Date().setHours(new Date().getHours()-range))}},{time:1, humidity:1, _id:0}).sort({ time: 1 }).toArray(function(err,items){ // get the samples from database
           assert.equal(err, null);
           //console.dir(items); // remove this
           samples.humidity = items; 
           callback(res, samples); // once all items read from database (asynchronous call), call the callback function and send the response        
    });
};

function getPressureData(range, res, samples, callback){
    db.collection('pressure').find({time: {$gte: new Date(new Date().setHours(new Date().getHours()-range))}},{time:1, pressure:1, _id:0}).sort({ time: 1 }).toArray(function(err,items){ // get the samples from database
           assert.equal(err, null);
           //console.dir(items); // remove this
           samples.pressure = items; 
           callback( range, res, samples, sendRes); // once all items read from database (asynchronous call), call the callback function and get the humidity data        
    });
};

function getTempData(range, res,callback){
    console.dir(range);
    var samples = {};
    db.collection('temperature').find({time: {$gte: new Date(new Date().setHours(new Date().getHours()-range))}},{time:1, temp:1, _id:0}).sort({ time: 1 }).toArray(function(err,items){ // get the samples from database
           assert.equal(err, null);
           //console.dir(items); // remove this
           samples.temperature = items; 
           callback( range, res, samples, getHumidityData); // once all items read from database (asynchronous call), call the callback function and get the pressure data        
    });
};

function pushMeasuredData(data){
  io.emit('PushData', JSON.stringify(data));  // send data to browser
}

function handleSenses(senses, time){
    var currentTemp = 0; // init
    var currentPressure = 0; // init
    var currentHumidity = 0; // init
    var currentBattery = 0; // init
    var chargerConnected = false; // init
    var pushData = {};  // init
    for (var i=0; i<senses.length; i++){ // go through all the senses data
      if (senses[i].sId == '0x00060100' ){ // temperature data
        console.log("The measured temperature is " + senses[i].val); // remove this
        currentTemp = senses[i].val;
        pushData["temp"] = currentTemp;
        pushData["time"] = time;
        storeSensesData("temperature", "temp", currentTemp, time);   
      }
      else if (senses[i].sId == '0x00060200' ){ // Humidity data
        console.log("The measured Humidity is " + senses[i].val); // remove this
        currentHumidity = senses[i].val;
        pushData["humidity"] = currentHumidity;
        storeSensesData("humidity", "humidity", currentHumidity, time);   
      }
      else if (senses[i].sId == '0x00060400' ){ // Air pressure data
        console.log("The measured Air pressure is " + senses[i].val); // remove this
        currentPressure = senses[i].val;
        pushData["pressure"] = currentPressure;
        storeSensesData("pressure", "pressure", currentPressure, time);  
      }
      else if (senses[i].sId == '0x00030200' ){ // Battery level data
        console.log("The measured battery level is " + senses[i].val); // remove this
        currentBattery = senses[i].val;
        pushData["battery"] = currentBattery;
        storeSensesData("battery", "battery", currentBattery, time);
      }
      else if (senses[i].sId == '0x00030400' ){ // Charger connected data
        console.log("Charger is connected or not" + senses[i].val); // remove this
        chargerConnected = senses[i].val;
        pushData["charger"] = chargerConnected;
        if (chargerConnected){ // charger is connected, store timestamps into database
          storeSensesData("charger", "chargerOn", chargerConnected, time);
        }
      }
      else{
        console.dir(senses[i]);
      }
    }
    pushMeasuredData(pushData); // send data to browser  
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
server.post('/getSensesData', function (req, res, next) {
    if (req.params.buttonStats){ // button has been pressed, store stats into database
      storeButtonStats(req.params.range, res, getTempData );
    }
    else
    { // button has not been pressed, no need to store stats into database
      getTempData(req.params.range, res, getPressureData);
      console.log ("A request to get temperature data for last " + req.params.range + " hours from the database was received");
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

//REST API implementation for getting the log data from the client
server.post('/battery', function (req, res, next) {
    console.log ("Battery info requested");
    getBatterydata(res, getChargerdata);
    next();
});

// REST API implementation for handling the push messages from the Thingsee IOT
server.post('/', function (req, res, next) {
    var time = new Date();
    var hh = addZero(time.getHours());
    var mm = addZero(time.getMinutes());
    var ss = addZero(time.getSeconds());
    var consoleTime = hh + ":" + mm + ":" + ss; 
    
    console.log('got IOT message from Lutikka. Timestamp ' + consoleTime); // remove this
    handleSenses(req.params[0].senses, time);

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
