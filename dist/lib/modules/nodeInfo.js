"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeInfoModule = void 0;
/*!
 * Pinus -- consoleModule nodeInfo processInfo
 * Copyright(c) 2012 fantasyni <fantasyni@163.com>
 * MIT Licensed
 */
const monitor = require("pinus-monitor");
const pinus_logger_1 = require("pinus-logger");
const consoleService_1 = require("../consoleService");
const path = require("path");
let logger = (0, pinus_logger_1.getLogger)('pinus-admin', path.basename(__filename));
let DEFAULT_INTERVAL = 5 * 60; // in second
let DEFAULT_DELAY = 10; // in second
class NodeInfoModule {
    constructor(opts) {
        opts = opts || {};
        this.type = opts.type || consoleService_1.ModuleType.pull;
        this.interval = opts.interval || DEFAULT_INTERVAL;
        this.delay = opts.delay || DEFAULT_DELAY;
    }
    monitorHandler(agent, msg, cb) {
        let serverId = agent.id;
        let pid = process.pid;
        let params = {
            serverId: serverId,
            pid: String(pid)
        };
        monitor.psmonitor.getPsInfo(params, function (err, data) {
            agent.notify(NodeInfoModule.moduleId, { serverId: agent.id, body: data });
        });
    }
    masterHandler(agent, msg, cb) {
        if (!msg) {
            agent.notifyAll(NodeInfoModule.moduleId);
            return;
        }
        let body = msg.body;
        let data = agent.get(NodeInfoModule.moduleId);
        if (!data) {
            data = {};
            agent.set(NodeInfoModule.moduleId, data);
        }
        data[msg.serverId] = body;
    }
    clientHandler(agent, msg, cb) {
        cb(null, agent.get(NodeInfoModule.moduleId) || {});
    }
}
exports.NodeInfoModule = NodeInfoModule;
NodeInfoModule.moduleId = 'nodeInfo';
//# sourceMappingURL=nodeInfo.js.map