"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfilerModule = exports.moduleError = void 0;
const pinus_logger_1 = require("pinus-logger");
const utils = require("../util/utils");
const path = require("path");
let logger = (0, pinus_logger_1.getLogger)('pinus-admin', path.basename(__filename));
let profiler = null;
try {
    profiler = require('v8-profiler');
}
catch (e) {
}
const fs = require("fs");
const profileProxy_1 = require("../util/profileProxy");
if (!profiler) {
    exports.moduleError = 1;
}
class ProfilerModule {
    constructor(opts) {
        if (opts && opts.isMaster) {
            this.proxy = new profileProxy_1.ProfileProxy();
        }
    }
    monitorHandler(agent, msg, cb) {
        let type = msg.type, action = msg.action, uid = msg.uid, result = null;
        if (type === 'CPU') {
            if (action === 'start') {
                profiler.startProfiling();
            }
            else {
                result = profiler.stopProfiling();
                let res = {};
                res.head = result.getTopDownRoot();
                res.bottomUpHead = result.getBottomUpRoot();
                res.msg = msg;
                agent.notify(ProfilerModule.moduleId, { clientId: msg.clientId, type: type, body: res });
            }
        }
        else {
            let snapshot = profiler.takeSnapshot();
            let appBase = process.cwd();
            let name = appBase + '/logs/' + utils.format(new Date()) + '.log';
            let log = fs.createWriteStream(name, { 'flags': 'a' });
            let data;
            snapshot.serialize({
                onData: function (chunk, size) {
                    chunk = chunk + '';
                    data = {
                        method: 'Profiler.addHeapSnapshotChunk',
                        params: {
                            uid: uid,
                            chunk: chunk
                        }
                    };
                    log.write(chunk);
                    agent.notify(ProfilerModule.moduleId, { clientId: msg.clientId, type: type, body: data });
                },
                onEnd: function () {
                    agent.notify(ProfilerModule.moduleId, { clientId: msg.clientId, type: type, body: { params: { uid: uid } } });
                    profiler.deleteAllSnapshots();
                }
            });
        }
    }
    masterHandler(agent, msg, cb) {
        var _a, _b;
        if (msg.type === 'CPU') {
            (_a = this.proxy) === null || _a === void 0 ? void 0 : _a.stopCallBack(msg.body, msg.clientId, agent);
        }
        else {
            (_b = this.proxy) === null || _b === void 0 ? void 0 : _b.takeSnapCallBack(msg.body);
        }
    }
    clientHandler(agent, msg, cb) {
        if (msg.action === 'list') {
            list(agent, msg, cb);
            return;
        }
        if (typeof msg === 'string') {
            msg = JSON.parse(msg);
        }
        let id = msg.id;
        let command = msg.method.split('.');
        let method = command[1];
        let params = msg.params;
        let clientId = msg.clientId;
        if (!this.proxy || !this.proxy[method] || typeof this.proxy[method] !== 'function') {
            return;
        }
        this.proxy[method](id, params, clientId, agent);
    }
}
exports.ProfilerModule = ProfilerModule;
ProfilerModule.moduleId = 'profiler';
let list = function (agent, msg, cb) {
    let servers = [];
    let idMap = agent.idMap;
    for (let sid in idMap) {
        servers.push(sid);
    }
    cb(null, servers);
};
//# sourceMappingURL=profiler.js.map