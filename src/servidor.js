var http = require("http");
var url = require("url");
var fs = require("fs");
var socketio = require("socket.io");
var path = require("path");
var mimeTypes = { "html": "text/html", "jpeg": "image/jpeg", "js": "text/javascript", "css": "text/css", "swf": "application/x-shockwave-flash" };

var MongoClient = require('mongodb').MongoClient;
var MongoServer = require('mongodb').MongoServer;
const request = require('request');


var TEMPERATURA_MAX = 35;
var TEMPERATURA_MIN = 15;
var LUMINOSIDAD_MAX = 60;
var LUMINOSIDAD_MIN = 10;
var temperatura = 20;
var luminosidad = 50;
var persianas = 'CERRADA';
var aireAcondicionado = 'APAGADO';


//---------------------------Creacion del servidor---------------------------------
var httpServer = http.createServer(
    function(request, response) {
        var uri = url.parse(request.url).pathname;
        if (uri == "/") uri = "/cliente.html";
        var fname = path.join(process.cwd(), uri);
        fs.exists(fname, function(exists) {
            if (exists) {
                fs.readFile(fname, function(err, data) {
                    if (!err) {
                        var extension = path.extname(fname).split(".")[1];
                        var mimeType = mimeTypes[extension];
                        response.writeHead(200, mimeType);
                        response.write(data);
                        response.end();
                    } else {
                        response.writeHead(200, { "Content-Type": "text/plain" });
                        response.write('Error en la lectura en el fichero: ' + uri);
                        response.end();
                    }
                });
            } else {
                console.log("Peticion invalida: " + uri);
                response.writeHead(200, { "Content-Type": "text/plain" });
                response.write('404 Not Found\n');
                response.end();
            }
        });
    }
);




//---------------------------Creacion de la base de datos y sus funciones--------------------------------

MongoClient.connect("mongodb://localhost:27017/", { useNewUrlParser: true, useUnifiedTopology: true }, function(err, db) {
    httpServer.listen(8080);
    var io = socketio(httpServer);
    var dbo = db.db("BaseDatosdomotica");

    dbo.createCollection("cambioSensores", function(err, collection) {

        io.sockets.on('connection',
            function(client) {

                client.emit('my-address', { host: client.request.connection.remoteAddress, port: client.request.connection.remotePort });

                client.on('poner', function(data) {
                    collection.insert(data, { safe: true }, function(err, result) {});
                });
                client.on('obtener', function(data) {
                    collection.find(data).toArray(function(err, results) {
                        client.emit('obtener', results);
                    });
                });

                client.on('setTemp', function(data) {
                    console.log("Nueva temperatura :" + data.temp);
                    temperatura = data.temp;

                    if (temperatura > TEMPERATURA_MAX) {
                        io.sockets.emit("TemperaturaNotificacion", {
                            mensaje: "Demasiada temperatura (Max: " + TEMPERATURA_MAX + " )"
                        });
                        aireAcondicionado = 'ENCENIDO';
                        io.sockets.emit("actualizarAire", aireAcondicionado);

                    } else if (temperatura < TEMPERATURA_MIN) {
                        io.sockets.emit("TemperaturaNotificacion", { mensaje: "Muy poca temperatura (Min: " + TEMPERATURA_MIN + ")" });
                        aireAcondicionado = 'APAGADO';
                        io.sockets.emit("actualizarAire", aireAcondicionado);
                    } else {
                        io.sockets.emit("TemperaturaNotificacion", { mensaje: "" });
                        collection.insert(data, { safe: true }, function(err, result) {});
                        io.sockets.emit("actualizarTemperatura", temperatura);
                    }

                });

                client.on("setLum", function(data) {
                    luminosidad = data.lum;
                    console.log("Nueva luminosidad :" + data.lum);

                    if (luminosidad > LUMINOSIDAD_MAX) {
                        io.sockets.emit("LuminosidadNotificacion", { mensaje: "Demasiada luminosidad (Max: " + LUMINOSIDAD_MAX + " )" });
                        persianas = "CERRADA";
                        io.sockets.emit("actualizarPersianas", persianas);
                    } else if (luminosidad < LUMINOSIDAD_MIN) {
                        io.sockets.emit("LuminosidadNotificacion", { mensaje: "Muy poca luminosidad (Min: " + LUMINOSIDAD_MIN + ")" });
                        persianas = "ABIERTA";
                        io.sockets.emit("actualizarPersianas", persianas);
                    } else {
                        io.sockets.emit("LuminosidadNotificacion", { mensaje: "" });
                        collection.insert(data, { safe: true }, function(err, result) {});
                        io.sockets.emit("actualizarLuminosidad", luminosidad);
                    }
                });

                client.on('changeAire', function() {
                    if (aireAcondicionado == 'APAGADO')
                        aireAcondicionado = 'ENCENDIDO';
                    else {
                        aireAcondicionado = 'APAGADO';
                    }
                    io.sockets.emit('actualizarAire', aireAcondicionado);
                    collection.insert({ aire: aireAcondicionado });
                });

                client.on('changePersianas', function() {
                    if (persianas == 'CERRADA')
                        persianas = 'ABIERTA';
                    else {
                        persianas = 'CERRADA';
                    }
                    io.sockets.emit('actualizarPersianas', persianas);
                    collection.insert({ persiana: persianas });
                });

                client.on('getTemperatura', function() {
                    io.sockets.emit("actualizarTemperatura", temperatura);
                });
                client.on('getLuminosidad', function() {
                    io.sockets.emit("actualizarLuminosidad", luminosidad);
                });

                client.on('getAire', function() {
                    io.sockets.emit('actualizarAire', aireAcondicionado);
                });

                client.on('getPersianas', function() {
                    io.sockets.emit('actualizarPersianas', persianas);
                });

                client.on('getTempMax', function() {
                    io.sockets.emit("tempMax", TEMPERATURA_MAX);
                });

                client.on('getLumMax', function() {
                    io.sockets.emit("lumMax", LUMINOSIDAD_MAX);
                });


                client.on('getTempMin', function() {
                    io.sockets.emit("tempMin", TEMPERATURA_MIN);
                });

                client.on('getLumMin', function() {
                    io.sockets.emit("lumMin", LUMINOSIDAD_MIN);
                });

            });


    });
});


console.log("Iniciando sistema de domotica");