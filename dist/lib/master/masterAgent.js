"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MasterAgent = void 0;
const pinus_logger_1 = require("pinus-logger");
const mqttServer_1 = require("../protocol/mqtt/mqttServer");
const events_1 = require("events");
const masterSocket_1 = require("./masterSocket");
const protocol = require("../util/protocol");
const utils = require("../util/utils");
const path = require("path");
let logger = (0, pinus_logger_1.getLogger)('pinus-admin', path.basename(__filename));
let ST_INITED = 1;
let ST_STARTED = 2;
let ST_CLOSED = 3;
/**
 * MasterAgent Constructor
 *
 * @class MasterAgent
 * @constructor
 * @param {Object} opts construct parameter
 *                 opts.consoleService {Object} consoleService
 *                 opts.id             {String} server id
 *                 opts.type           {String} server type, 'master', 'connector', etc.
 *                 opts.socket         {Object} socket-io object
 *                 opts.reqId          {Number} reqId add by 1
 *                 opts.callbacks      {Object} callbacks
 *                 opts.state          {Number} MasterAgent state
 * @api public
 */
class MasterAgent extends events_1.EventEmitter {
    constructor(consoleService, opts) {
        super();
        this.reqId = 1;
        this.idMap = {};
        this.msgMap = {};
        this.typeMap = {};
        this.clients = {};
        this.sockets = {};
        this.slaveMap = {};
        this.server = null;
        this.callbacks = {};
        this.state = ST_INITED;
        if (opts.whitelist)
            this.whitelist = opts.whitelist;
        this.consoleService = consoleService;
    }
    /**
     * master listen to a port and handle register and request
     *
     * @param {String} port
     * @api public
     */
    listen(port, cb) {
        if (this.state > ST_INITED) {
            logger.error('master agent has started or closed.');
            return;
        }
        this.state = ST_STARTED;
        this.server = new mqttServer_1.MqttServer();
        this.server.listen(port);
        // this.server = sio.listen(port);
        // this.server.set('log level', 0);
        cb = cb || function () { };
        let self = this;
        this.server.on('error', function (err) {
            self.emit('error', err);
            cb(err);
        });
        this.server.once('listening', function () {
            setImmediate(function () {
                cb();
            });
        });
        this.server.on('connection', function (socket) {
            // let id, type, info, registered, username;
            let masterSocket = new masterSocket_1.MasterSocket();
            masterSocket['agent'] = self;
            masterSocket['socket'] = socket;
            self.sockets[socket.id] = socket;
            socket.on('register', function (msg) {
                // register a new connection
                masterSocket.onRegister(msg);
            }); // end of on 'register'
            // message from monitor
            socket.on('monitor', function (msg) {
                masterSocket.onMonitor(msg);
            }); // end of on 'monitor'
            // message from client
            socket.on('client', function (msg) {
                masterSocket.onClient(msg);
            }); // end of on 'client'
            socket.on('reconnect', function (msg) {
                masterSocket.onReconnect(msg);
            });
            socket.on('disconnect', function () {
                masterSocket.onDisconnect();
            });
            socket.on('close', function () {
                masterSocket.onDisconnect();
            });
            socket.on('error', function (err) {
                masterSocket.onError(err);
            });
        }); // end of on 'connection'
    } // end of listen
    /**
     * close master agent
     *
     * @api public
     */
    close() {
        var _a;
        if (this.state > ST_STARTED) {
            return;
        }
        this.state = ST_CLOSED;
        (_a = this.server) === null || _a === void 0 ? void 0 : _a.close();
    }
    /**
     * set module
     *
     * @param {String} moduleId module id/name
     * @param {Object} value module object
     * @api public
     */
    set(moduleId, value) {
        this.consoleService.set(moduleId, value);
    }
    /**
     * get module
     *
     * @param {String} moduleId module id/name
     * @api public
     */
    get(moduleId) {
        return this.consoleService.get(moduleId);
    }
    /**
     * getClientById
     *
     * @param {String} clientId
     * @api public
     */
    getClientById(clientId) {
        return this.clients[clientId];
    }
    /**
     * request monitor{master node} data from monitor
     *
     * @param {String} serverId
     * @param {String} moduleId module id/name
     * @param {Object} msg
     * @param {Function} callback function
     * @api public
     */
    request(serverId, moduleId, msg, cb) {
        if (this.state > ST_STARTED) {
            return false;
        }
        cb = cb || function () { };
        let curId = this.reqId++;
        this.callbacks[curId] = cb;
        if (!this.msgMap[serverId]) {
            this.msgMap[serverId] = {};
        }
        this.msgMap[serverId][curId] = {
            moduleId: moduleId,
            msg: msg
        };
        let record = this.idMap[serverId];
        if (!record) {
            cb(new Error('unknown server id:' + serverId));
            return false;
        }
        this.sendToMonitor(record.socket, curId, moduleId, msg);
        return true;
    }
    /**
     * request server data from monitor by serverInfo{host:port}
     *
     * @param {String} serverId
     * @param {Object} serverInfo
     * @param {String} moduleId module id/name
     * @param {Object} msg
     * @param {Function} callback function
     * @api public
     */
    requestServer(serverId, serverInfo, moduleId, msg, cb) {
        if (this.state > ST_STARTED) {
            return false;
        }
        let record = this.idMap[serverId];
        if (!record) {
            utils.invokeCallback(cb, new Error('unknown server id:' + serverId));
            return false;
        }
        let curId = this.reqId++;
        this.callbacks[curId] = cb;
        if (utils.compareServer(record.info, serverInfo)) {
            this.sendToMonitor(record.socket, curId, moduleId, msg);
        }
        else {
            let slaves = this.slaveMap[serverId];
            for (let i = 0, l = slaves.length; i < l; i++) {
                if (utils.compareServer(slaves[i].info, serverInfo)) {
                    this.sendToMonitor(slaves[i].socket, curId, moduleId, msg);
                    break;
                }
            }
        }
        return true;
    }
    /**
     * notify a monitor{master node} by id without callback
     *
     * @param {String} serverId
     * @param {String} moduleId module id/name
     * @param {Object} msg
     * @api public
     */
    notifyById(serverId, moduleId, msg) {
        if (this.state > ST_STARTED) {
            return false;
        }
        let record = this.idMap[serverId];
        if (!record) {
            logger.error('fail to notifyById for unknown server id:' + serverId);
            return false;
        }
        this.sendToMonitor(record.socket, 0, moduleId, msg);
        return true;
    }
    /**
     * notify a monitor by server{host:port} without callback
     *
     * @param {String} serverId
     * @param {Object} serverInfo{host:port}
     * @param {String} moduleId module id/name
     * @param {Object} msg
     * @api public
     */
    notifyByServer(serverId, serverInfo, moduleId, msg) {
        if (this.state > ST_STARTED) {
            return false;
        }
        let record = this.idMap[serverId];
        if (!record) {
            logger.error('fail to notifyByServer for unknown server id:' + serverId);
            return false;
        }
        if (utils.compareServer(record.info, serverInfo)) {
            this.sendToMonitor(record.socket, 0, moduleId, msg);
        }
        else {
            let slaves = this.slaveMap[serverId];
            for (let i = 0, l = slaves.length; i < l; i++) {
                if (utils.compareServer(slaves[i].info, serverInfo)) {
                    this.sendToMonitor(slaves[i].socket, 0, moduleId, msg);
                    break;
                }
            }
        }
        return true;
    }
    /**
     * notify slaves by id without callback
     *
     * @param {String} serverId
     * @param {String} moduleId module id/name
     * @param {Object} msg
     * @api public
     */
    notifySlavesById(serverId, moduleId, msg) {
        if (this.state > ST_STARTED) {
            return false;
        }
        let slaves = this.slaveMap[serverId];
        if (!slaves || slaves.length === 0) {
            logger.error('fail to notifySlavesById for unknown server id:' + serverId);
            return false;
        }
        this.broadcastMonitors(slaves, moduleId, msg);
        return true;
    }
    /**
     * notify monitors by type without callback
     *
     * @param {String} type serverType
     * @param {String} moduleId module id/name
     * @param {Object} msg
     * @api public
     */
    notifyByType(type, moduleId, msg) {
        if (this.state > ST_STARTED) {
            return false;
        }
        let list = this.typeMap[type];
        if (!list || list.length === 0) {
            logger.error('fail to notifyByType for unknown server type:' + type);
            return false;
        }
        this.broadcastMonitors(list, moduleId, msg);
        return true;
    }
    /**
     * notify all the monitors without callback
     *
     * @param {String} moduleId module id/name
     * @param {Object} msg
     * @api public
     */
    notifyAll(moduleId, msg) {
        if (this.state > ST_STARTED) {
            return false;
        }
        this.broadcastMonitors(this.idMap, moduleId, msg);
        return true;
    }
    /**
     * notify a client by id without callback
     *
     * @param {String} clientId
     * @param {String} moduleId module id/name
     * @param {Object} msg
     * @api public
     */
    notifyClient(clientId, moduleId, msg) {
        if (this.state > ST_STARTED) {
            return false;
        }
        let record = this.clients[clientId];
        if (!record) {
            logger.error('fail to notifyClient for unknown client id:' + clientId);
            return false;
        }
        this.sendToClient(record.socket, 0, moduleId, msg);
    }
    notifyCommand(command, moduleId, msg) {
        if (this.state > ST_STARTED) {
            return false;
        }
        this.broadcastCommand(this.idMap, command, moduleId, msg);
        return true;
    }
    doAuthUser(msg, socket, cb) {
        if (!msg.id) {
            // client should has a client id
            return cb(new Error('client should has a client id'));
        }
        let self = this;
        let username = msg.username;
        if (!username) {
            // client should auth with username
            this.doSend(socket, 'register', {
                code: protocol.PRO_FAIL,
                msg: 'client should auth with username'
            });
            return cb(new Error('client should auth with username'));
        }
        let authUser = self.consoleService.authUser;
        let env = self.consoleService.env;
        if (authUser)
            authUser(msg, env, (user) => {
                if (!user) {
                    // client should auth with username
                    this.doSend(socket, 'register', {
                        code: protocol.PRO_FAIL,
                        msg: 'client auth failed with username or password error'
                    });
                    return cb(new Error('client auth failed with username or password error'));
                }
                if (self.clients[msg.id]) {
                    this.doSend(socket, 'register', {
                        code: protocol.PRO_FAIL,
                        msg: 'id has been registered. id:' + msg.id
                    });
                    return cb(new Error('id has been registered. id:' + msg.id));
                }
                logger.info('client user : ' + username + ' login to master');
                this.addConnection(msg.id, msg.type, null, user, socket);
                this.doSend(socket, 'register', {
                    code: protocol.PRO_OK,
                    msg: 'ok'
                });
                cb();
            });
    }
    doAuthServer(msg, socket, cb) {
        let self = this;
        let authServer = self.consoleService.authServer;
        let env = self.consoleService.env;
        authServer(msg, env, (status) => {
            if (status !== 'ok') {
                this.doSend(socket, 'register', {
                    code: protocol.PRO_FAIL,
                    msg: 'server auth failed,check config `adminServer`.'
                });
                cb(new Error('server auth failed,check config `adminServer`.'));
                return;
            }
            let record = this.addConnection(msg.id, msg.serverType, msg.pid, msg.info, socket);
            this.doSend(socket, 'register', {
                code: protocol.PRO_OK,
                msg: 'ok'
            });
            msg.info = msg.info;
            msg.info.pid = msg.pid;
            self.emit('register', msg.info);
            cb(null);
        });
    }
    /**
     * add monitor,client to connection -- idMap
     *
     * @param {Object} agent agent object
     * @param {String} id
     * @param {String} type serverType
     * @param {Object} socket socket-io object
     * @api private
     */
    addConnection(id, type, pid, info, socket) {
        let record = {
            id: id,
            type: type,
            pid: pid,
            info: info,
            socket: socket
        };
        if (type === 'client') {
            this.clients[id] = record;
        }
        else {
            if (!this.idMap[id]) {
                this.idMap[id] = record;
                let list = this.typeMap[type] = this.typeMap[type] || [];
                list.push(record);
            }
            else {
                let slaves = this.slaveMap[id] = this.slaveMap[id] || [];
                slaves.push(record);
            }
        }
        return record;
    }
    /**
     * remove monitor,client connection -- idMap
     *
     * @param {Object} agent agent object
     * @param {String} id
     * @param {String} type serverType
     * @api private
     */
    removeConnection(id, type, info) {
        if (type === 'client') {
            delete this.clients[id];
        }
        else {
            // remove master node in idMap and typeMap
            let record = this.idMap[id];
            if (!record) {
                return;
            }
            let _info = record['info']; // info {host, port}
            if (utils.compareServer(_info, info)) {
                delete this.idMap[id];
                let list = this.typeMap[type];
                if (list) {
                    for (let i = 0, l = list.length; i < l; i++) {
                        if (list[i].id === id) {
                            list.splice(i, 1);
                            break;
                        }
                    }
                    if (list.length === 0) {
                        delete this.typeMap[type];
                    }
                }
            }
            else {
                // remove slave node in slaveMap
                let slaves = this.slaveMap[id];
                if (slaves) {
                    for (let i = 0, l = slaves.length; i < l; i++) {
                        if (utils.compareServer(slaves[i]['info'], info)) {
                            slaves.splice(i, 1);
                            break;
                        }
                    }
                    if (slaves.length === 0) {
                        delete this.slaveMap[id];
                    }
                }
            }
        }
    }
    /**
     * send msg to monitor
     *
     * @param {Object} socket socket-io object
     * @param {Number} reqId request id
     * @param {String} moduleId module id/name
     * @param {Object} msg message
     * @api private
     */
    sendToMonitor(socket, reqId, moduleId, msg) {
        this.doSend(socket, 'monitor', protocol.composeRequest(reqId, moduleId, msg));
    }
    /**
     * send msg to client
     *
     * @param {Object} socket socket-io object
     * @param {Number} reqId request id
     * @param {String} moduleId module id/name
     * @param {Object} msg message
     * @api private
     */
    sendToClient(socket, reqId, moduleId, msg) {
        this.doSend(socket, 'client', protocol.composeRequest(reqId, moduleId, msg));
    }
    doSend(socket, topic, msg) {
        socket.send(topic, msg);
    }
    /**
     * broadcast msg to monitor
     *
     * @param {Object} record registered modules
     * @param {String} moduleId module id/name
     * @param {Object} msg message
     * @api private
     */
    broadcastMonitors(records, moduleId, msg) {
        msg = protocol.composeRequest(0, moduleId, msg);
        if (records instanceof Array) {
            for (let i = 0, l = records.length; i < l; i++) {
                let socket = records[i].socket;
                this.doSend(socket, 'monitor', msg);
            }
        }
        else {
            for (let id in records) {
                let record = records[id];
                let socket = record.socket;
                this.doSend(socket, 'monitor', msg);
            }
        }
    }
    broadcastCommand(records, command, moduleId, msg) {
        msg = protocol.composeCommand(0, command, moduleId, msg);
        if (records instanceof Array) {
            for (let i = 0, l = records.length; i < l; i++) {
                let socket = records[i].socket;
                this.doSend(socket, 'monitor', msg);
            }
        }
        else {
            for (let id in records) {
                let record = records[id];
                let socket = record.socket;
                this.doSend(socket, 'monitor', msg);
            }
        }
    }
}
exports.MasterAgent = MasterAgent;
//# sourceMappingURL=masterAgent.js.map