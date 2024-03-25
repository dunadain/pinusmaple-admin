"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemInfoModule = void 0;
/*!
 * Pinus -- consoleModule systemInfo
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
class SystemInfoModule {
    constructor(opts) {
        opts = opts || {};
        this.type = opts.type || consoleService_1.ModuleType.pull;
        this.interval = opts.interval || DEFAULT_INTERVAL;
        this.delay = opts.delay || DEFAULT_DELAY;
    }
    monitorHandler(agent, msg, cb) {
        // collect data
        monitor.sysmonitor.getSysInfo(function (err, data) {
            agent.notify(SystemInfoModule.moduleId, { serverId: agent.id, body: data });
        });
    }
    masterHandler(agent, msg, cb) {
        if (!msg) {
            agent.notifyAll(SystemInfoModule.moduleId);
            return;
        }
        let body = msg.body;
        let oneData = {
            Time: body.iostat.date, hostname: body.hostname, serverId: msg.serverId, cpu_user: body.iostat.cpu.cpu_user,
            cpu_nice: body.iostat.cpu.cpu_nice, cpu_system: body.iostat.cpu.cpu_system, cpu_iowait: body.iostat.cpu.cpu_iowait,
            cpu_steal: body.iostat.cpu.cpu_steal, cpu_idle: body.iostat.cpu.cpu_idle, tps: body.iostat.disk.tps,
            kb_read: body.iostat.disk.kb_read, kb_wrtn: body.iostat.disk.kb_wrtn, kb_read_per: body.iostat.disk.kb_read_per,
            kb_wrtn_per: body.iostat.disk.kb_wrtn_per, totalmem: body.totalmem, freemem: body.freemem, 'free/total': (body.freemem / body.totalmem),
            m_1: body.loadavg[0], m_5: body.loadavg[1], m_15: body.loadavg[2]
        };
        let data = agent.get(SystemInfoModule.moduleId);
        if (!data) {
            data = {};
            agent.set(SystemInfoModule.moduleId, data);
        }
        data[msg.serverId] = oneData;
    }
    clientHandler(agent, msg, cb) {
        cb(null, agent.get(SystemInfoModule.moduleId) || {});
    }
}
exports.SystemInfoModule = SystemInfoModule;
SystemInfoModule.moduleId = 'systemInfo';
//# sourceMappingURL=systemInfo.js.map