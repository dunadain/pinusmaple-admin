"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MasterSocket = void 0;
const pinus_logger_1 = require("pinus-logger");
let logger = (0, pinus_logger_1.getLogger)('pinus-admin', 'MasterSocket');
const Constants = require("../util/constants");
const protocol = require("../util/protocol");
class MasterSocket {
    constructor() {
        this.id = null;
        this.type = null;
        this.info = null;
        this.agent = null;
        this.socket = null;
        this.username = null;
        this.registered = false;
    }
    onRegister(_msg) {
        var _a, _b, _c;
        if (!_msg || !_msg.type) {
            return;
        }
        let self = this;
        let serverId = _msg.id;
        let serverType = _msg.type;
        let socket = this.socket;
        if (serverType === Constants.TYPE_CLIENT) {
            let msg = _msg;
            // client connection not join the map
            this.id = serverId;
            this.type = serverType;
            this.info = 'client';
            (_a = this.agent) === null || _a === void 0 ? void 0 : _a.doAuthUser(msg, socket, function (err) {
                if (err) {
                    return socket === null || socket === void 0 ? void 0 : socket.disconnect();
                }
                self.username = msg.username;
                self.registered = true;
            });
            return;
        } // end of if(serverType === 'client')
        if (serverType === Constants.TYPE_MONITOR) {
            if (!serverId) {
                return;
            }
            let msg = _msg;
            // if is a normal server
            this.id = serverId;
            this.type = msg.serverType;
            this.info = msg.info;
            (_b = this.agent) === null || _b === void 0 ? void 0 : _b.doAuthServer(msg, socket, function (err) {
                if (err) {
                    return socket === null || socket === void 0 ? void 0 : socket.disconnect();
                }
                self.registered = true;
            });
            this.repushQosMessage(serverId);
            return;
        } // end of if(serverType === 'monitor')
        (_c = this.agent) === null || _c === void 0 ? void 0 : _c.doSend(socket, 'register', {
            code: protocol.PRO_FAIL,
            msg: 'unknown auth master type'
        });
        socket === null || socket === void 0 ? void 0 : socket.disconnect();
    }
    onMonitor(msg) {
        var _a, _b, _c, _d;
        let socket = this.socket;
        if (!this.registered) {
            // not register yet, ignore any message
            // kick connections
            socket === null || socket === void 0 ? void 0 : socket.disconnect();
            return;
        }
        let self = this;
        let type = this.type;
        if (type === Constants.TYPE_CLIENT) {
            logger.error('invalid message from monitor, but current connect type is client.');
            return;
        }
        msg = protocol.parse(msg);
        let respId = msg.respId;
        if (respId) {
            // a response from monitor
            let cb = (_a = self.agent) === null || _a === void 0 ? void 0 : _a.callbacks[respId];
            if (!cb) {
                logger.warn('unknown resp id:' + respId);
                return;
            }
            let id = this.id;
            if (id) {
                if ((_b = self.agent) === null || _b === void 0 ? void 0 : _b.msgMap[id]) {
                    delete self.agent.msgMap[id][respId];
                }
            }
            (_c = self.agent) === null || _c === void 0 ? true : delete _c.callbacks[respId];
            return cb(msg.error, msg.body);
        }
        // a request or a notify from monitor
        (_d = self.agent) === null || _d === void 0 ? void 0 : _d.consoleService.execute(msg.moduleId, 'masterHandler', msg.body, function (err, res) {
            var _a;
            if (protocol.isRequest(msg)) {
                let resp = protocol.composeResponse(msg, err, res);
                if (resp) {
                    (_a = self.agent) === null || _a === void 0 ? void 0 : _a.doSend(socket, 'monitor', resp);
                }
            }
            else {
                // notify should not have a callback
                logger.warn('notify should not have a callback.');
            }
        });
    }
    onClient(msg) {
        var _a, _b;
        let socket = this.socket;
        if (!this.registered) {
            // not register yet, ignore any message
            // kick connections
            return socket === null || socket === void 0 ? void 0 : socket.disconnect();
        }
        let type = this.type;
        if (type !== Constants.TYPE_CLIENT) {
            logger.error('invalid message to client, but current connect type is ' + type);
            return;
        }
        msg = protocol.parse(msg);
        let msgCommand = msg.command;
        let msgModuleId = msg.moduleId;
        let msgBody = msg.body;
        let self = this;
        if (msgCommand) {
            // a command from client
            (_a = self.agent) === null || _a === void 0 ? void 0 : _a.consoleService.command(msgCommand, msgModuleId, msgBody, function (err, res) {
                var _a;
                if (protocol.isRequest(msg)) {
                    let resp = protocol.composeResponse(msg, err, res);
                    if (resp) {
                        (_a = self.agent) === null || _a === void 0 ? void 0 : _a.doSend(socket, 'client', resp);
                    }
                }
                else {
                    // notify should not have a callback
                    logger.warn('notify should not have a callback.');
                }
            });
        }
        else {
            // a request or a notify from client
            // and client should not have any response to master for master would not request anything from client
            (_b = self.agent) === null || _b === void 0 ? void 0 : _b.consoleService.execute(msgModuleId, 'clientHandler', msgBody, function (err, res) {
                var _a;
                if (protocol.isRequest(msg)) {
                    let resp = protocol.composeResponse(msg, err, res);
                    if (resp) {
                        (_a = self.agent) === null || _a === void 0 ? void 0 : _a.doSend(socket, 'client', resp);
                    }
                }
                else {
                    // notify should not have a callback
                    logger.warn('notify should not have a callback.');
                }
            });
        }
    }
    onReconnect(msg, pid) {
        var _a, _b, _c, _d;
        // reconnect a new connection
        if (!msg || !msg.type) {
            return;
        }
        let serverId = msg.id;
        if (!serverId) {
            return;
        }
        let socket = this.socket;
        // if is a normal server
        if ((_a = this.agent) === null || _a === void 0 ? void 0 : _a.idMap[serverId]) {
            // id has been registered
            this.agent.doSend(socket, 'reconnect_ok', {
                code: protocol.PRO_FAIL,
                msg: 'id has been registered. id:' + serverId
            });
            return;
        }
        let msgServerType = msg.serverType;
        let record = (_b = this.agent) === null || _b === void 0 ? void 0 : _b.addConnection(serverId, msgServerType, msg.pid, msg.info, socket);
        this.id = serverId;
        this.type = msgServerType;
        this.registered = true;
        msg.info.pid = pid;
        this.info = msg.info;
        (_c = this.agent) === null || _c === void 0 ? void 0 : _c.doSend(socket, 'reconnect_ok', {
            code: protocol.PRO_OK,
            msg: 'ok'
        });
        (_d = this.agent) === null || _d === void 0 ? void 0 : _d.emit('reconnect', msg.info);
        this.repushQosMessage(serverId);
    }
    onDisconnect() {
        var _a, _b, _c;
        let socket = this.socket;
        if (socket) {
            (_a = this.agent) === null || _a === void 0 ? true : delete _a.sockets[socket.id];
        }
        let registered = this.registered;
        if (!registered) {
            return;
        }
        let id = this.id;
        let type = this.type;
        let info = this.info;
        let username = this.username;
        logger.debug('disconnect %s %s %j', id, type, info);
        if (registered && id && type) {
            (_b = this.agent) === null || _b === void 0 ? void 0 : _b.removeConnection(id, type, info);
            (_c = this.agent) === null || _c === void 0 ? void 0 : _c.emit('disconnect', id, type, info);
        }
        if (type === Constants.TYPE_CLIENT && registered) {
            logger.info('client user ' + username + ' exit');
        }
        this.registered = false;
        this.id = null;
        this.type = null;
    }
    repushQosMessage(serverId) {
        var _a, _b;
        let socket = this.socket;
        // repush qos message
        let qosMsgs = (_a = this.agent) === null || _a === void 0 ? void 0 : _a.msgMap[serverId];
        if (!qosMsgs) {
            return;
        }
        logger.debug('repush qos message %j', qosMsgs);
        for (let reqId in qosMsgs) {
            let qosMsg = qosMsgs[reqId];
            let moduleId = qosMsg['moduleId'];
            let tmsg = qosMsg['msg'];
            (_b = this.agent) === null || _b === void 0 ? void 0 : _b.sendToMonitor(socket, Number(reqId), moduleId, tmsg);
        }
    }
    onError(err) {
        // logger.error('server %s error %s', this.id, err.stack);
        // this.onDisconnect();
    }
}
exports.MasterSocket = MasterSocket;
//# sourceMappingURL=masterSocket.js.map