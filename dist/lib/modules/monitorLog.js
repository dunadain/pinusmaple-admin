"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonitorLogModule = void 0;
/*!
 * Pinus -- consoleModule monitorLog
 * Copyright(c) 2012 fantasyni <fantasyni@163.com>
 * MIT Licensed
 */
const pinus_logger_1 = require("pinus-logger");
const path = require("path");
let logger = (0, pinus_logger_1.getLogger)('pinus-admin', path.basename(__filename));
const readLastLines = require('read-last-lines');
let DEFAULT_INTERVAL = 5 * 60; // in second
/**
 * Initialize a new 'Module' with the given 'opts'
 *
 * @class Module
 * @constructor
 * @param {object} opts
 * @api public
 */
class MonitorLogModule {
    constructor(opts) {
        var _a;
        opts = opts || {};
        this.root = (_a = opts.path) !== null && _a !== void 0 ? _a : '';
        this.interval = opts.interval || DEFAULT_INTERVAL;
    }
    /**
    * collect monitor data from monitor
    *
    * @param {Object} agent monitorAgent object
    * @param {Object} msg client message
    * @param {Function} cb callback function
    * @api public
    */
    monitorHandler(agent, msg, cb) {
        if (!msg.logfile) {
            cb(new Error('logfile should not be empty'));
            return;
        }
        let serverId = agent.id;
        fetchLogs(this.root, msg, function (data) {
            cb(null, { serverId: serverId, body: data });
        });
    }
    /**
     * Handle client request
     *
     * @param {Object} agent masterAgent object
     * @param {Object} msg client message
     * @param {Function} cb callback function
     * @api public
     */
    clientHandler(agent, msg, cb) {
        agent.request(msg.serverId, MonitorLogModule.moduleId, msg, function (err, res) {
            if (err) {
                logger.error('fail to run log for ' + err.stack);
                return;
            }
            cb(null, res);
        });
    }
}
exports.MonitorLogModule = MonitorLogModule;
MonitorLogModule.moduleId = 'monitorLog';
// get the latest logs
let fetchLogs = function (root, msg, callback) {
    let num = msg.number;
    let logfile = msg.logfile;
    let serverId = msg.serverId;
    let filePath = path.join(root, getLogFileName(logfile, serverId));
    let endLogs = [];
    readLastLines.read(filePath, num)
        .then((output) => {
        let endOut = [];
        let outputS = output.replace(/^\s+|\s+$/g, '').split(/\s+/);
        for (let i = 5; i < outputS.length; i += 6) {
            endOut.push(outputS[i]);
        }
        let endLength = endOut.length;
        for (let j = 0; j < endLength; j++) {
            let json;
            try {
                json = JSON.parse(endOut[j]);
            }
            catch (e) {
                //    logger.error('the log cannot parsed to json, ' + e);
                continue;
            }
            endLogs.push({
                time: json.time,
                route: json.route || json.service,
                serverId: serverId,
                timeUsed: json.timeUsed,
                params: endOut[j]
            });
        }
        callback({ logfile: logfile, dataArray: endLogs });
    });
};
let getLogFileName = function (logfile, serverId) {
    return logfile + '-' + serverId + '.log';
};
//# sourceMappingURL=monitorLog.js.map