# Kerttu
Weather Station based on Thingsee IOT One device

This project is based on the Thingsee One IOT device, which has lots of different sensors. This devide can be configured to activate one, some or all these sensors and to send the JSON data to the REST API of a server. The interval of the measurements can be adjusted among other things.

The idea of this project is to activate three Thingsee One sensors: temperature, humidity and the pressure to create a weather station, called Kerttu. The data is received in the Kerttu.js node.js server and procesed and stored in the database. The node.js server uses socket.io to send the measurement data into the browser realtime to plot the graph and to display the measurement.

ToDo list:
- create node.js server to receive the temperature measurement data and log it into the console *DONE*
- create html page and socket connection between the node.js serverand the html page to receive the temperature data and log it to the console *DONE*
- Implement a graph to plot the temperature *DONE*
- Implement a nice visual display to show the measured temperature *DONE*
- create an account on the AWS (Amazon cloud) and make the node.js server run there. This enables other persons to join the project and to display the data. *DONE*
- implement storage of the data into the database in the node.js server *DONE*
- active humidity sensor and implement data processing in the node.js server
- implement processing of humidity data and graph plotting in the html
- active pressure sensor and implement data processing in the node.js server
- implement processing of pressure data and graph plotting in the html
- implement logging visitor data and statistics for pressing buttons *DONE*
- implement REST API for getting the log data *DONE*
- implement functionality to show the log data
- implement REST API to get old data from the node.js. Web page uses this when starting to display the data of 24 or so last measurements *DONE for the temperature data*
- implement functionality in the web page to choose whether to show last 24 hour measurement / last 7 days / last month. This uses the REST API to get the old data *DONE*
- implement functionality in the node.js to get data from the database for last 24 or so measurements / last 7 days / last / month *DONE*
- implement alarm functionality for setting alarm when the temperature crossed a certain threshold and then sending the alarm via e-mail
- implement functionality and REST APIs to get the battery level of the Thingsee One and to display it on the web page. Perhaps generating alarm too if level goes below threshold?
- implement facebook and/or twitter connectivity and make Kerttu to tweet or send a Facebook status update whenever a new temperature e.g. record is broken etc.

<bold>Kerttu is currently running in the Amazon cloud</bold>. Try it http://52.34.164.37/Kerttu.html
Please note however that the service might be down to the R&D purposes. 
