"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MqttServer = void 0;
const pinus_logger_1 = require("pinus-logger");
const events_1 = require("events");
const net = require("net");
const path = require("path");
let logger = (0, pinus_logger_1.getLogger)('pinus-admin', path.basename(__filename));
const mqtt_constructor = require('mqtt-connection');
let curId = 1;
class MqttServer extends events_1.EventEmitter {
    constructor(opts, cb) {
        super();
        this.opts = opts;
        this.cb = cb;
        this.inited = false;
        this.closed = true;
    }
    listen(port) {
        // check status
        if (this.inited) {
            if (this.cb)
                this.cb(new Error('already inited.'));
            return;
        }
        this.inited = true;
        let self = this;
        this.server = new net.Server();
        this.server.listen(port);
        logger.info('[MqttServer] listen on %d', port);
        this.server.on('listening', this.emit.bind(this, 'listening'));
        this.server.on('error', function (err) {
            // logger.error('mqtt server is error: %j', err.stack);
            self.emit('error', err);
        });
        this.server.on('connection', function (stream) {
            let socket = mqtt_constructor(stream);
            socket.id = curId++;
            self.socket = socket;
            socket.on('connect', (pkg) => {
                socket.connack({
                    returnCode: 0
                });
            });
            socket.on('publish', function (pkg) {
                let topic = pkg.topic;
                let msg = pkg.payload.toString();
                msg = JSON.parse(msg);
                // logger.debug('[MqttServer] publish %s %j', topic, msg);
                socket.emit(topic, msg);
            });
            socket.on('pingreq', function () {
                socket.pingresp();
            });
            socket.send = function (topic, msg) {
                socket.publish({
                    topic: topic,
                    payload: JSON.stringify(msg)
                });
            };
            self.emit('connection', socket);
        });
    }
    send(topic, msg) {
        var _a;
        (_a = this.socket) === null || _a === void 0 ? void 0 : _a.publish({
            topic: topic,
            payload: msg
        });
    }
    close() {
        var _a;
        if (this.closed) {
            return;
        }
        this.socket = undefined;
        this.closed = true;
        (_a = this.server) === null || _a === void 0 ? void 0 : _a.close();
        this.emit('closed');
    }
}
exports.MqttServer = MqttServer;
//# sourceMappingURL=mqttServer.js.map