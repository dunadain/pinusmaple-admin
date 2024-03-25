"use strict";
/*!
 * Pinus -- commandLine Client
 * Copyright(c) 2015 fantasyni <fantasyni@163.com>
 * MIT Licensed
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminClient = void 0;
const mqttClient_1 = require("../protocol/mqtt/mqttClient");
const protocol = require("../util/protocol");
// let io = require('socket.io-client');
const utils = require("../util/utils");
class AdminClient {
    constructor(opt) {
        this.id = '';
        this.reqId = 1;
        this.callbacks = {};
        this._listeners = {};
        this.state = AdminClient.ST_INITED;
        this.username = '';
        this.password = '';
        this.md5 = false;
        this.id = '';
        this.reqId = 1;
        this.callbacks = {};
        this._listeners = {};
        this.state = AdminClient.ST_INITED;
        this.socket = null;
        opt = opt || {};
        this.username = opt['username'] || '';
        this.password = opt['password'] || '';
        this.md5 = opt['md5'] || false;
    }
    connect(id, host, port, cb) {
        this.id = id;
        let self = this;
        console.log('try to connect ' + host + ':' + port);
        this.socket = new mqttClient_1.MqttClient({
            id: id
        });
        this.socket.connect(host, port);
        // this.socket = io.connect('http://' + host + ':' + port, {
        //     'force new connection': true,
        //     'reconnect': false
        // });
        this.socket.on('connect', () => {
            self.state = AdminClient.ST_CONNECTED;
            if (self.md5) {
                self.password = utils.md5(self.password);
            }
            self.doSend('register', {
                type: 'client',
                id: id,
                username: self.username,
                password: self.password,
                md5: self.md5
            });
        });
        this.socket.on('register', (res) => {
            if (res.code !== protocol.PRO_OK) {
                cb(res.msg);
                return;
            }
            self.state = AdminClient.ST_REGISTERED;
            cb();
        });
        this.socket.on('client', (msg) => {
            msg = protocol.parse(msg);
            if (msg.respId) {
                // response for request
                let cb = self.callbacks[msg.respId];
                delete self.callbacks[msg.respId];
                if (cb && typeof cb === 'function') {
                    cb(msg.error, msg.body);
                }
            }
            else if (msg.moduleId) {
                // notify
                self.emit(msg.moduleId, msg);
            }
        });
        this.socket.on('error', function (err) {
            if (self.state < AdminClient.ST_CONNECTED) {
                cb(err);
            }
            self.emit('error', err);
        });
        this.socket.on('disconnect', (reason) => {
            this.state = AdminClient.ST_CLOSED;
            self.emit('close');
        });
    }
    request(moduleId, msg, cb) {
        let id = this.reqId++;
        // something dirty: attach current client id into msg
        msg = msg || {};
        msg.clientId = this.id;
        msg.username = this.username;
        let req = protocol.composeRequest(id, moduleId, msg);
        if (cb)
            this.callbacks[id] = cb;
        this.doSend('client', req);
        // this.socket.emit('client', req);
    }
    notify(moduleId, msg) {
        // something dirty: attach current client id into msg
        msg = msg || {};
        msg.clientId = this.id;
        msg.username = this.username;
        let req = protocol.composeRequest(0, moduleId, msg);
        this.doSend('client', req);
        // this.socket.emit('client', req);
    }
    command(command, moduleId, msg, cb) {
        let id = this.reqId++;
        msg = msg || {};
        msg.clientId = this.id;
        msg.username = this.username;
        let commandReq = protocol.composeCommand(id, command, moduleId, msg);
        this.callbacks[id] = cb;
        this.doSend('client', commandReq);
        // this.socket.emit('client', commandReq);
    }
    doSend(topic, msg) {
        var _a;
        (_a = this.socket) === null || _a === void 0 ? void 0 : _a.send(topic, msg);
    }
    on(event, listener) {
        this._listeners[event] = this._listeners[event] || [];
        this._listeners[event].push(listener);
    }
    emit(event, ...args) {
        let _listeners = this._listeners[event];
        if (!_listeners || !_listeners.length) {
            return;
        }
        let listener;
        for (let i = 0, l = _listeners.length; i < l; i++) {
            listener = _listeners[i];
            if (typeof listener === 'function') {
                listener.apply(null, args);
            }
        }
    }
}
exports.AdminClient = AdminClient;
AdminClient.ST_INITED = 1;
AdminClient.ST_CONNECTED = 2;
AdminClient.ST_REGISTERED = 3;
AdminClient.ST_CLOSED = 4;
//# sourceMappingURL=client.js.map