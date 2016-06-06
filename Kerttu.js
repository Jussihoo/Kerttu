"use strict";
var restify = require("restify");
var server = restify.createServer({
  name: 'Kerttu',
  version: '1.0.0'
});

var https = require("https");
var socketio  = require ("socket.io");
var config = require ("./config/configuration.js");

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

// Facebook feed
var counter = 0; // init
var randomNumber = 6; // init
var batInd1 = true; // init
var batInd2 = true; // init
var batInd3 = true; // init
var chargerInd = true; // init
var feedStatus = [];
feedStatus[0] = "I just stored these measurements into my lovely database. ";
feedStatus[1] = "Right now the weather here https://goo.gl/maps/FKxoaFKajc52 looks like this. ";
feedStatus[2] = "Press like if you like the weather as much as I am. ";
feedStatus[3] = "Wherever you go, no matter what the weather, always bring your own sunshine. ";
feedStatus[4] = "There's no such thing as bad weather, just soft people. ";
feedStatus[5] = "A lot of people like snow. I find it to be an unnecessary freezing of water. ";
feedStatus[6] = "I cannot command winds and weather but I can show you some measurements. ";
feedStatus[7] = "Kyl o komee keli. ";
feedStatus[8] = "Anyone who says sunshine brings happiness has never danced in the rain. ";
feedStatus[9] = "Some people feel the rain — others just get wet. ";
feedStatus[10] = "There is no such thing as bad weather, only different kinds of good weather. ";
feedStatus[11] = "Bad weather always looks worse through a window. ";
feedStatus[12] = "I like the cold weather. It means you get work done. ";
feedStatus[13] = "The weather is like the government, always in the wrong. ";
feedStatus[14] = "You need a web developer? Hire Jussi? https://fi.linkedin.com/in/juhani-hakosalo-18743711b ."
feedStatus[15] = "I wrote a piece of software in 1998 that created fictional weather. ";


var storeSensesData = function(collection,sense, value, timestamp) {
   var senseData = {};
   senseData["time"] = timestamp;
   senseData[sense]  = value;  
   db.collection(collection).insert(senseData, function(err, result) {
      assert.equal(err, null);
      console.log("stored senses data into the database for " + collection + " collection");
  });
}

function randomize(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function postToFacebook(str, token) {
  var req = https.request({
    host: 'graph.facebook.com',
    path: '/'+config.feedID+'/feed?',
    method: 'POST'
  }, function(res) {
    res.setEncoding('utf8');
    res.on('data', function(chunk) {
      console.log('got chunk '+chunk);
    });
    res.on('end', function() {
      console.log('received ack from Facebook');
    });
  });
  req.end('message='+str
    +'&access_token='+encodeURIComponent(token));
  console.log('Sent to Facebook feed');
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
           if (range > 48){ // filter out every other item to optimize graph drawing
              for(var i = 0; i < items.length-1; i++) {
                items.splice(i+1,1); // remove every other item from the list
              }
           }
           samples.humidity = items;
           callback(res, samples); // once all items read from database (asynchronous call), call the callback function and send the response        
    });
};

function getPressureData(range, res, samples, callback){
    db.collection('pressure').find({time: {$gte: new Date(new Date().setHours(new Date().getHours()-range))}},{time:1, pressure:1, _id:0}).sort({ time: 1 }).toArray(function(err,items){ // get the samples from database
           assert.equal(err, null);
           //console.dir(items); // remove this
           if (range > 48){ // filter out every other item to optimize graph drawing
              for(var i = 0; i < items.length-1; i++) {
                items.splice(i+1,1); // remove every other item from the list
              }
           }
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
           if (range > 48){ // filter out every other item to optimize graph drawing
              for(var i = 0; i < items.length-1; i++) {
                items.splice(i+1,1); // remove every other item from the list
              }
           }
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
        currentTemp = Math.round( senses[i].val * 10 ) / 10; // rounding with one decimal
        pushData["temp"] = currentTemp;
        pushData["time"] = time;
        storeSensesData("temperature", "temp", currentTemp, time);   
      }
      else if (senses[i].sId == '0x00060200' ){ // Humidity data
        console.log("The measured Humidity is " + senses[i].val); // remove this
        currentHumidity = Math.round( senses[i].val * 10 ) / 10; // rounding with one decimal
        pushData["humidity"] = currentHumidity;
        storeSensesData("humidity", "humidity", currentHumidity, time);   
      }
      else if (senses[i].sId == '0x00060400' ){ // Air pressure data
        console.log("The measured Air pressure is " + senses[i].val); // remove this
        currentPressure = Math.round( senses[i].val * 10 ) / 10; // rounding with one decimal
        pushData["pressure"] = currentPressure;
        storeSensesData("pressure", "pressure", currentPressure, time);  
      }
      else if (senses[i].sId == '0x00030200' ){ // Battery level data
        console.log("The measured battery level is " + senses[i].val); // remove this
        currentBattery = senses[i].val;
        pushData["battery"] = currentBattery;
        storeSensesData("battery", "battery", currentBattery, time);
        if (currentBattery <15 && currentBattery > 10 && batInd1){
          // make a Facebook feed post
          var string = "My battery is running low. Jussi, please do something";
          postToFacebook(string, config.token);
          batInd1 = false;
        }
        if (currentBattery <=10 && currentBattery > 5 && batInd2){
          // make a Facebook feed post
          var string = "Hey Jussi, I told you to connect that awesome charger to me. What gives?";
          postToFacebook(string, config.token);
          batInd2 = false;
        }
        if (currentBattery <=5 && batInd3 ){
          // make a Facebook feed post
          var string = "I am moving into bi*ch mode right now if you Jussi do not connect that charger NOW. I am warning you";
          postToFacebook(string, config.token);
          batInd3 = false;
        }
      }
      else if (senses[i].sId == '0x00030400' ){ // Charger connected data
        console.log("Charger is connected or not" + senses[i].val); // remove this
        chargerConnected = senses[i].val;
        pushData["charger"] = chargerConnected;
        if (chargerConnected){ // charger is connected, store timestamps into database
          storeSensesData("charger", "chargerOn", chargerConnected, time);
          if (chargerInd){
            // make a Facebook feed post
            var string = "Oh. Energy. Thanks for charging my battery. I am so happy now that my temperature measurement might go grazy";
            postToFacebook(string, config.token);
            chargerInd = false;
            batInd1 = true;
            batInd2 = true;
            batInd3 = true;
          }
        }
        else { // charger not connected
           chargerInd = true;
        }
      }
      else{
        console.dir(senses[i]);
      }
    }
    pushMeasuredData(pushData); // send data to browser
    if (counter == randomNumber){
      // time to write to the Facebook feed
      var feedInd = randomize(0, feedStatus.length-1);
      var string = feedStatus[feedInd]+"Temperature is "+pushData.temp+" Celsius, humidity reading is "+pushData.humidity+"% and air pressure is " +pushData.pressure+" hPA";
      postToFacebook(string, config.token);
      // make a new lottery
      var min = 6*12; // 12 hours
      var max = 6*24; // 24 hours
      randomNumber = randomize(min, max);
      counter = 0;
    }
    else {
      counter++;
    } 
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
    //var string = "Oh. Just got a new visitor to my webpage :)";
    //postToFacebook(string, config.token);
});                              

server.listen(8080, function () {
    console.log('Node.js weatherMachine Kerttu listening at %s', server.url);
});
