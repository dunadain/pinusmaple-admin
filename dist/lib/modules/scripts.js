"use strict";
/*!
 * Pinus -- consoleModule runScript
 * Copyright(c) 2012 fantasyni <fantasyni@163.com>
 * MIT Licensed
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScriptsModule = void 0;
const pinus_logger_1 = require("pinus-logger");
const vm = require("vm");
const fs = require("fs");
const util = require("util");
const path = require("path");
let logger = (0, pinus_logger_1.getLogger)('pinus-admin', path.basename(__filename));
class ScriptsModule {
    constructor(opts) {
        this.app = opts.app;
        this.root = opts.path;
        this.commands = {
            'list': list,
            'get': get,
            'save': save,
            'run': run
        };
    }
    monitorHandler(agent, msg, cb) {
        let context = {
            app: this.app,
            require: require,
            os: require('os'),
            fs: require('fs'),
            process: process,
            util: util,
            result: undefined
        };
        try {
            vm.createContext(context);
            vm.runInNewContext(msg.script, context);
            let result = context.result;
            if (!result) {
                cb(null, 'script result should be assigned to result value to script module context');
            }
            else {
                cb(null, result);
            }
        }
        catch (e) {
            cb(null, e.toString());
        }
        // cb(null, vm.runInContext(msg.script, context));
    }
    clientHandler(agent, msg, cb) {
        let fun = this.commands[msg.command];
        if (!fun || typeof fun !== 'function') {
            cb('unknown command:' + msg.command);
            return;
        }
        fun(this, agent, msg, cb);
    }
}
exports.ScriptsModule = ScriptsModule;
ScriptsModule.moduleId = 'scripts';
/**
 * List server id and scripts file name
 */
let list = function (scriptModule, agent, msg, cb) {
    let servers = [];
    let scripts = [];
    let idMap = agent.idMap;
    for (let sid in idMap) {
        servers.push(sid);
    }
    fs.readdir(scriptModule.root, function (err, filenames) {
        if (err) {
            filenames = [];
        }
        for (let i = 0, l = filenames.length; i < l; i++) {
            scripts.push(filenames[i]);
        }
        cb(null, {
            servers: servers,
            scripts: scripts
        });
    });
};
/**
 * Get the content of the script file
 */
let get = function (scriptModule, agent, msg, cb) {
    let filename = msg.filename;
    if (!filename) {
        cb('empty filename');
        return;
    }
    fs.readFile(path.join(scriptModule.root, filename), 'utf-8', function (err, data) {
        if (err) {
            logger.error('fail to read script file:' + filename + ', ' + err.stack);
            cb('fail to read script with name:' + filename);
        }
        cb(null, data);
    });
};
/**
 * Save a script file that posted from admin console
 */
let save = function (scriptModule, agent, msg, cb) {
    let filepath = path.join(scriptModule.root, msg.filename);
    fs.writeFile(filepath, msg.body, function (err) {
        if (err) {
            logger.error('fail to write script file:' + msg.filename + ', ' + err.stack);
            cb('fail to write script file:' + msg.filename);
            return;
        }
        cb();
    });
};
/**
 * Run the script on the specified server
 */
let run = function (scriptModule, agent, msg, cb) {
    agent.request(msg.serverId, ScriptsModule.moduleId, msg, function (err, res) {
        if (err) {
            logger.error('fail to run script for ' + err.stack);
            return;
        }
        cb(null, res);
    });
};
//# sourceMappingURL=scripts.js.map