"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMonitorConsole = exports.createMasterConsole = exports.ConsoleService = exports.ModuleType = void 0;
const pinus_logger_1 = require("pinus-logger");
const monitorAgent_1 = require("./monitor/monitorAgent");
const events_1 = require("events");
const masterAgent_1 = require("./master/masterAgent");
const schedule = require("pinus-scheduler");
const protocol = require("./util/protocol");
const utils = require("./util/utils");
const path = require("path");
let logger = (0, pinus_logger_1.getLogger)('pinus-admin', path.basename(__filename));
let MS_OF_SECOND = 1000;
var ModuleType;
(function (ModuleType) {
    ModuleType["push"] = "push";
    ModuleType["pull"] = "pull";
    ModuleType["Normal"] = "";
})(ModuleType = exports.ModuleType || (exports.ModuleType = {}));
/**
 * ConsoleService Constructor
 *
 * @class ConsoleService
 * @constructor
 * @param {Object} opts construct parameter
 *                 opts.type     {String} server type, 'master', 'connector', etc.
 *                 opts.id         {String} server id
 *                 opts.host     {String} (monitor only) master server host
 *                 opts.port     {String | Number} listen port for master or master port for monitor
 *                 opts.master  {Boolean} current service is master or monitor
 *                 opts.info     {Object} more server info for current server, {id, serverType, host, port}
 * @api public
 */
class ConsoleService extends events_1.EventEmitter {
    constructor(_opts) {
        super();
        this.port = 0;
        this.env = '';
        this.master = false;
        this.id = '';
        this.host = '';
        this.type = '';
        if (_opts.port)
            this.port = _opts.port;
        if (_opts.env)
            this.env = _opts.env;
        this.values = {};
        let masterOpts = _opts;
        let monitorOpts = _opts;
        this.master = !!masterOpts.master;
        this.modules = {};
        this.commands = {
            'list': listCommand,
            'enable': enableCommand,
            'disable': disableCommand
        };
        if (this.master) {
            this.authUser = masterOpts.authUser || utils.defaultAuthUser;
            this.authServer = masterOpts.authServer || utils.defaultAuthServerMaster;
            this.agent = new masterAgent_1.MasterAgent(this, masterOpts);
        }
        else {
            if (monitorOpts.type)
                this.type = monitorOpts.type;
            if (monitorOpts.id)
                this.id = monitorOpts.id;
            if (monitorOpts.host)
                this.host = monitorOpts.host;
            this.authServer = monitorOpts.authServer || utils.defaultAuthServerMonitor;
            this.agent = new monitorAgent_1.MonitorAgent({
                consoleService: this,
                id: this.id,
                type: this.type,
                info: monitorOpts.info,
                monitorAgentClientFactory: monitorOpts.monitorAgentClientFactory
            });
        }
    }
    /**
     * start master or monitor
     *
     * @param {Function} cb callback function
     * @api public
     */
    start(cb) {
        if (this.master) {
            let self = this;
            this.agent.listen(this.port, function (err) {
                if (!!err) {
                    utils.invokeCallback(cb, err);
                    return;
                }
                exportEvent(self, self.agent, 'register');
                exportEvent(self, self.agent, 'disconnect');
                exportEvent(self, self.agent, 'reconnect');
                process.nextTick(function () {
                    utils.invokeCallback(cb);
                });
            });
        }
        else {
            logger.info('try to connect master: %j, %j, %j', this.type, this.host, this.port);
            this.agent.connect(this.port, this.host, cb);
            exportEvent(this, this.agent, 'close');
        }
        exportEvent(this, this.agent, 'error');
        for (let mid in this.modules) {
            this.enable(mid);
        }
    }
    /**
     * stop console modules and stop master server
     *
     * @api public
     */
    stop() {
        for (let mid in this.modules) {
            this.disable(mid);
        }
        this.agent.close();
    }
    /**
     * register a new adminConsole module
     *
     * @param {String} moduleId adminConsole id/name
     * @param {Object} module module object
     * @api public
     */
    register(moduleId, module) {
        this.modules[moduleId] = registerRecord(this, moduleId, module);
    }
    /**
     * enable adminConsole module
     *
     * @param {String} moduleId adminConsole id/name
     * @api public
     */
    enable(moduleId) {
        let record = this.modules[moduleId];
        if (record && !record.enable) {
            record.enable = true;
            addToSchedule(this, record);
            return true;
        }
        return false;
    }
    /**
     * disable adminConsole module
     *
     * @param {String} moduleId adminConsole id/name
     * @api public
     */
    disable(moduleId) {
        let record = this.modules[moduleId];
        if (record && record.enable) {
            record.enable = false;
            if (record.schedule && record.jobId) {
                schedule.cancelJob(record.jobId);
                record.jobId = undefined;
            }
            return true;
        }
        return false;
    }
    /**
     * call concrete module and handler(monitorHandler,masterHandler,clientHandler)
     *
     * @param {String} moduleId adminConsole id/name
     * @param {String} method handler
     * @param {Object} msg message
     * @param {Function} cb callback function
     * @api public
     */
    execute(moduleId, method, msg, cb) {
        let self = this;
        let m = this.modules[moduleId];
        if (!m) {
            logger.error('unknown module: %j.', moduleId);
            cb('unknown moduleId:' + moduleId);
            return;
        }
        if (!m.enable) {
            logger.error('module %j is disable.', moduleId);
            cb('module ' + moduleId + ' is disable');
            return;
        }
        let module = m.module;
        if (!module || typeof module[method] !== 'function') {
            logger.error('module %j dose not have a method called %j.', moduleId, method);
            cb('module ' + moduleId + ' dose not have a method called ' + method);
            return;
        }
        let log = {
            action: 'execute',
            moduleId: moduleId,
            method: method,
            msg: msg
        };
        let aclMsg = aclControl(self.agent, 'execute', method, moduleId, msg);
        if (aclMsg !== 0 && aclMsg !== 1) {
            log['error'] = aclMsg;
            self.emit('admin-log', log, aclMsg);
            cb(new Error(aclMsg.toString()), null);
            return;
        }
        if (method === 'clientHandler') {
            self.emit('admin-log', log);
        }
        module[method](this.agent, msg, cb);
    }
    command(command, moduleId, msg, cb) {
        let self = this;
        let fun = this.commands[command];
        if (!fun || typeof fun !== 'function') {
            cb('unknown command:' + command);
            return;
        }
        let log = {
            action: 'command',
            moduleId: moduleId,
            msg: msg
        };
        let aclMsg = aclControl(self.agent, 'command', null, moduleId, msg);
        if (aclMsg !== 0 && aclMsg !== 1) {
            log['error'] = aclMsg;
            self.emit('admin-log', log, aclMsg);
            cb(new Error(aclMsg.toString()), null);
            return;
        }
        self.emit('admin-log', log);
        fun(this, moduleId, msg, cb);
    }
    /**
     * set module data to a map
     *
     * @param {String} moduleId adminConsole id/name
     * @param {Object} value module data
     * @api public
     */
    set(moduleId, value) {
        this.values[moduleId] = value;
    }
    /**
     * get module data from map
     *
     * @param {String} moduleId adminConsole id/name
     * @api public
     */
    get(moduleId) {
        return this.values[moduleId];
    }
}
exports.ConsoleService = ConsoleService;
/**
 * register a module service
 *
 * @param {Object} service consoleService object
 * @param {String} moduleId adminConsole id/name
 * @param {Object} module module object
 * @api private
 */
let registerRecord = function (service, moduleId, module) {
    let record = {
        moduleId: moduleId,
        module: module,
        enable: false
    };
    if (module.type && module.interval) {
        if (!service.master && record.module.type === 'push' || service.master && record.module.type !== 'push') {
            // push for monitor or pull for master(default)
            record.delay = module.delay || 0;
            record.interval = module.interval || 1;
            // normalize the arguments
            if (record.delay < 0) {
                record.delay = 0;
            }
            if (record.interval < 0) {
                record.interval = 1;
            }
            record.interval = Math.ceil(record.interval);
            record.delay *= MS_OF_SECOND;
            record.interval *= MS_OF_SECOND;
            record.schedule = true;
        }
    }
    return record;
};
/**
 * schedule console module
 *
 * @param {Object} service consoleService object
 * @param {Object} record  module object
 * @api private
 */
let addToSchedule = function (service, record) {
    if (record && record.schedule) {
        record.jobId = schedule.scheduleJob({
            start: Date.now() + record.delay,
            period: record.interval
        }, doScheduleJob, {
            service: service,
            record: record
        });
    }
};
/**
 * run schedule job
 *
 * @param {Object} args argments
 * @api private
 */
let doScheduleJob = function (args) {
    if (!args)
        return;
    let service = args.service;
    let record = args.record;
    if (!service || !record || !record.module || !record.enable) {
        return;
    }
    if (service.master) {
        record.module.masterHandler(service.agent, null, function (err) {
            logger.error('interval push should not have a callback.');
        });
    }
    else {
        record.module.monitorHandler(service.agent, null, function (err) {
            logger.error('interval push should not have a callback.');
        });
    }
};
/**
 * export closure function out
 *
 * @param {Function} outer outer function
 * @param {Function} inner inner function
 * @param {object} event
 * @api private
 */
let exportEvent = function (outer, inner, event) {
    inner.on(event, function () {
        let args = Array.from(arguments);
        args.unshift(event);
        outer.emit.apply(outer, args);
    });
};
/**
 * List current modules
 */
let listCommand = function (consoleService, moduleId, msg, cb) {
    let modules = consoleService.modules;
    let result = [];
    for (let moduleId in modules) {
        if (/^__\w+__$/.test(moduleId)) {
            continue;
        }
        result.push(moduleId);
    }
    cb(null, {
        modules: result
    });
};
/**
 * enable module in current server
 */
let enableCommand = function (consoleService, moduleId, msg, cb) {
    if (!moduleId) {
        logger.error('fail to enable admin module for ' + moduleId);
        cb('empty moduleId');
        return;
    }
    let modules = consoleService.modules;
    if (!modules[moduleId]) {
        cb(null, protocol.PRO_FAIL);
        return;
    }
    if (consoleService.master) {
        consoleService.enable(moduleId);
        consoleService.agent.notifyCommand('enable', moduleId, msg);
        cb(null, protocol.PRO_OK);
    }
    else {
        consoleService.enable(moduleId);
        cb(null, protocol.PRO_OK);
    }
};
/**
 * disable module in current server
 */
let disableCommand = function (consoleService, moduleId, msg, cb) {
    if (!moduleId) {
        logger.error('fail to enable admin module for ' + moduleId);
        cb('empty moduleId');
        return;
    }
    let modules = consoleService.modules;
    if (!modules[moduleId]) {
        cb(null, protocol.PRO_FAIL);
        return;
    }
    if (consoleService.master) {
        consoleService.disable(moduleId);
        consoleService.agent.notifyCommand('disable', moduleId, msg);
        cb(null, protocol.PRO_OK);
    }
    else {
        consoleService.disable(moduleId);
        cb(null, protocol.PRO_OK);
    }
};
let aclControl = function (agent, action, method, moduleId, msg) {
    if (action === 'execute') {
        if (method !== 'clientHandler' || moduleId !== '__console__') {
            return 0;
        }
        let signal = msg.signal;
        if (!signal || !(signal === 'stop' || signal === 'add' || signal === 'kill')) {
            return 0;
        }
    }
    let clientId = msg.clientId;
    if (!clientId) {
        return 'Unknow clientId';
    }
    let _client = agent.getClientById(clientId);
    if (_client && _client.info && _client.info.level) {
        let level = _client.info.level;
        if (level > 1) {
            return 'Command permission denied';
        }
    }
    else {
        return 'Client info error';
    }
    return 1;
};
/**
 * Create master ConsoleService
 *
 * @param {Object} opts construct parameter
 *                      opts.port {String | Number} listen port for master console
 */
function createMasterConsole(opts) {
    opts.master = true;
    return new ConsoleService(opts);
}
exports.createMasterConsole = createMasterConsole;
/**
 * Create monitor ConsoleService
 *
 * @param {Object} opts construct parameter
 *                      opts.type {String} server type, 'master', 'connector', etc.
 *                      opts.id {String} server id
 *                      opts.host {String} master server host
 *                      opts.port {String | Number} master port
 */
function createMonitorConsole(opts) {
    return new ConsoleService(opts);
}
exports.createMonitorConsole = createMonitorConsole;
//# sourceMappingURL=consoleService.js.map