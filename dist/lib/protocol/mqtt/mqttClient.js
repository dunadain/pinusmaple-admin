"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MqttClient = void 0;
const pinus_logger_1 = require("pinus-logger");
const events_1 = require("events");
const constants = require("../../util/constants");
const net = require("net");
const path = require("path");
const MqttCon = require('mqtt-connection');
let logger = (0, pinus_logger_1.getLogger)('pinus-admin', path.basename(__filename));
class MqttClient extends events_1.EventEmitter {
    constructor(opts) {
        super();
        this.requests = {};
        this.connectedTimes = 1;
        this.port = 0;
        this.socket = null;
        this.lastPing = -1;
        this.lastPong = -1;
        this.closed = false;
        this.timeoutId = null;
        this.connected = false;
        this.reconnectId = null;
        this.timeoutFlag = false;
        this.keepaliveTimer = null;
        this.reconnectDelay = 0;
        this.clientId = 'MQTT_ADMIN_' + Date.now();
        this.id = opts.id;
        this.reconnectDelayMax = opts.reconnectDelayMax || constants.DEFAULT_PARAM.RECONNECT_DELAY_MAX;
        this.timeout = opts.timeout || constants.DEFAULT_PARAM.TIMEOUT;
        this.keepalive = opts.keepalive || constants.DEFAULT_PARAM.KEEPALIVE;
    }
    connect(host, port, cb) {
        cb = cb || function () { };
        if (this.connected) {
            return cb(new Error('MqttClient has already connected.'));
        }
        if (host) {
            this.host = host;
        }
        if (port) {
            this.port = port;
        }
        let self = this;
        this.closed = false;
        let stream = net.createConnection(this.port, this.host, () => { });
        this.socket = MqttCon(stream);
        // logger.info('try to connect %s %s', this.host, this.port);
        this.socket.connect({
            clientId: this.clientId
        });
        this.addTimeout();
        this.socket.on('connack', function () {
            if (self.connected) {
                return;
            }
            self.connected = true;
            self.setupKeepAlive();
            if (self.connectedTimes++ === 1) {
                self.emit('connect');
                if (cb)
                    cb();
            }
            else {
                self.emit('reconnect');
            }
        });
        this.socket.on('publish', function (pkg) {
            let topic = pkg.topic;
            let msg = pkg.payload.toString();
            msg = JSON.parse(msg);
            // logger.debug('[MqttClient] publish %s %j', topic, msg);
            self.emit(topic, msg);
        });
        this.socket.on('close', function () {
            logger.error('mqtt socket is close, remote server host: %s, port: %s', self.host, self.port);
            self.onSocketClose();
        });
        this.socket.on('error', function (err) {
            logger.error('mqtt socket is error, remote server host: %s, port: %s', self.host, self.port);
            // self.emit('error', new Error('[MqttClient] socket is error, remote server ' + host + ':' + port));
            self.onSocketClose();
        });
        this.socket.on('pingresp', function () {
            self.lastPong = Date.now();
        });
        this.socket.on('disconnect', function () {
            logger.error('mqtt socket is disconnect, remote server host: %s, port: %s', self.host, self.port);
            self.emit('disconnect', self.id);
            self.onSocketClose();
        });
        this.socket.on('timeout', function (reconnectFlag) {
            if (reconnectFlag) {
                self.reconnect();
            }
            else {
                self.exit();
            }
        });
    }
    send(topic, msg) {
        var _a;
        // console.log('MqttClient send %s %j ~~~', topic, msg);
        (_a = this.socket) === null || _a === void 0 ? void 0 : _a.publish({
            topic: topic,
            payload: JSON.stringify(msg)
        });
    }
    onSocketClose() {
        // console.log('onSocketClose ' + this.closed);
        if (this.closed) {
            return;
        }
        if (this.keepaliveTimer)
            clearInterval(this.keepaliveTimer);
        if (this.timeoutId)
            clearTimeout(this.timeoutId);
        this.keepaliveTimer = null;
        this.lastPing = -1;
        this.lastPong = -1;
        this.connected = false;
        this.closed = true;
        this.socket = null;
        if (this.connectedTimes > 1) {
            this.reconnect();
        }
        else {
            this.exit();
        }
    }
    addTimeout(reconnectFlag) {
        let self = this;
        if (this.timeoutFlag) {
            return;
        }
        this.timeoutFlag = true;
        this.timeoutId = setTimeout(function () {
            var _a;
            self.timeoutFlag = false;
            logger.error('mqtt client connect %s:%d timeout %d s', self.host, self.port, self.timeout / 1000);
            (_a = self.socket) === null || _a === void 0 ? void 0 : _a.emit('timeout', reconnectFlag);
        }, self.timeout);
    }
    reconnect() {
        let delay = this.reconnectDelay * 2 || constants.DEFAULT_PARAM.RECONNECT_DELAY;
        if (delay > this.reconnectDelayMax) {
            delay = this.reconnectDelayMax;
        }
        this.reconnectDelay = delay;
        let self = this;
        // logger.debug('[MqttClient] reconnect %d ...', delay);
        this.reconnectId = setTimeout(function () {
            logger.info('reconnect delay %d s', delay / 1000);
            self.addTimeout(true);
            self.connect();
        }, delay);
    }
    setupKeepAlive() {
        if (this.reconnectId)
            clearTimeout(this.reconnectId);
        if (this.timeoutId)
            clearTimeout(this.timeoutId);
        let self = this;
        this.keepaliveTimer = setInterval(function () {
            self.checkKeepAlive();
        }, this.keepalive);
    }
    checkKeepAlive() {
        var _a, _b, _c;
        if (this.closed) {
            return;
        }
        let now = Date.now();
        let KEEP_ALIVE_TIMEOUT = this.keepalive * 2;
        if (this.lastPing > 0) {
            if (this.lastPong < this.lastPing) {
                if (now - this.lastPing > KEEP_ALIVE_TIMEOUT) {
                    logger.error('mqtt rpc client checkKeepAlive error timeout for %d', KEEP_ALIVE_TIMEOUT);
                    this.close();
                }
                else {
                    (_a = this.socket) === null || _a === void 0 ? void 0 : _a.pingreq();
                }
            }
            else {
                (_b = this.socket) === null || _b === void 0 ? void 0 : _b.pingreq();
                this.lastPing = Date.now();
            }
        }
        else {
            (_c = this.socket) === null || _c === void 0 ? void 0 : _c.pingreq();
            this.lastPing = Date.now();
        }
    }
    disconnect() {
        this.connected = false;
        this.closed = true;
        // 取消定时
        if (this.reconnectId)
            clearTimeout(this.reconnectId);
        if (this.timeoutId)
            clearTimeout(this.timeoutId);
        // 主动断线时，socket已关闭被置null的可能
        if (this.socket) {
            this.socket.disconnect();
        }
    }
    close() {
        var _a;
        this.connected = false;
        this.closed = true;
        (_a = this.socket) === null || _a === void 0 ? void 0 : _a.disconnect();
    }
    exit() {
        logger.info('exit ...');
        process.exit(0);
    }
}
exports.MqttClient = MqttClient;
//# sourceMappingURL=mqttClient.js.map