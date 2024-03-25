"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultAuthServerMonitor = exports.defaultAuthServerMaster = exports.defaultAuthUser = exports.md5 = exports.size = exports.compareServer = exports.format = exports.invokeCallback = void 0;
const crypto = require("crypto");
const path = require("path");
const constants_1 = require("./constants");
/**
 * Check and invoke callback
 */
function invokeCallback(cb, ...args) {
    if (!!cb && typeof cb === 'function') {
        cb.apply(null, Array.prototype.slice.call(arguments, 1));
    }
}
exports.invokeCallback = invokeCallback;
/*
 * Date format
 */
function format(date, format) {
    format = format || 'MM-dd-hhmm';
    let o = {
        'M+': date.getMonth() + 1,
        'd+': date.getDate(),
        'h+': date.getHours(),
        'm+': date.getMinutes(),
        's+': date.getSeconds(),
        'q+': Math.floor((date.getMonth() + 3) / 3),
        'S': date.getMilliseconds() // millisecond
    };
    if (/(y+)/.test(format)) {
        format = format.replace(RegExp.$1, (date.getFullYear() + '').substr(4 - RegExp.$1.length));
    }
    for (let k in o) {
        if (new RegExp('(' + k + ')').test(format)) {
            format = format.replace(RegExp.$1, RegExp.$1.length === 1 ? o[k] :
                ('00' + o[k]).substr(('' + o[k]).length));
        }
    }
    return format;
}
exports.format = format;
function compareServer(server1, server2) {
    return (server1['host'] === server2['host']) &&
        (server1['port'] === server2['port']);
}
exports.compareServer = compareServer;
/**
 * Get the count of elements of object
 */
function size(obj, type) {
    let count = 0;
    for (let i in obj) {
        if (obj.hasOwnProperty(i) && typeof obj[i] !== 'function') {
            if (!type) {
                count++;
                continue;
            }
            if (type && type === obj[i]['type']) {
                count++;
            }
        }
    }
    return count;
}
exports.size = size;
function md5(str) {
    let md5sum = crypto.createHash('md5');
    md5sum.update(str);
    str = md5sum.digest('hex');
    return str;
}
exports.md5 = md5;
function canBeResolve(path) {
    try {
        require.resolve(path);
    }
    catch (err) {
        return false;
    }
    return true;
}
function defaultAuthUser(msg, env, cb) {
    let adminUser = null;
    let appBase = process.cwd();
    let adminUserPath = path.join(appBase, constants_1.DEFAULT_ADMIN_PATH.ADMIN_USER);
    let presentPath = path.join(appBase, 'config', env, constants_1.DEFAULT_ADMIN_PATH.ADMIN_FILENAME);
    if (canBeResolve(adminUserPath)) {
        adminUser = require(adminUserPath);
    }
    else if (canBeResolve(presentPath)) {
        adminUser = require(presentPath);
    }
    else {
        cb(null);
        return;
    }
    let username = msg['username'];
    let password = msg['password'];
    let md5Str = msg['md5'];
    let len = adminUser.length;
    if (md5Str) {
        for (let i = 0; i < len; i++) {
            let user = adminUser[i];
            let p = '';
            if (user['username'] === username) {
                p = md5(user['password']);
                if (password === p) {
                    cb(user);
                    return;
                }
            }
        }
    }
    else {
        for (let i = 0; i < len; i++) {
            let user = adminUser[i];
            if (user['username'] === username && user['password'] === password) {
                cb(user);
                return;
            }
        }
    }
    cb(null);
}
exports.defaultAuthUser = defaultAuthUser;
function defaultAuthServerMaster(msg, env, cb) {
    let id = msg['id'];
    let type = msg['serverType'];
    let token = msg['token'];
    if (type === 'master') {
        cb('ok');
        return;
    }
    let servers = null;
    let appBase = process.cwd();
    let serverPath = path.join(appBase, '/config/adminServer');
    let presentPath = '';
    if (env) {
        presentPath = path.join(appBase, 'config', env, 'adminServer');
    }
    if (canBeResolve(serverPath)) {
        servers = require(serverPath);
    }
    else if (canBeResolve(presentPath)) {
        servers = require(presentPath);
    }
    else {
        cb('ok');
        return;
    }
    let len = servers.length;
    for (let i = 0; i < len; i++) {
        let server = servers[i];
        if (server['type'] === type && server['token'] === token) {
            cb('ok');
            return;
        }
    }
    cb('bad');
    return;
}
exports.defaultAuthServerMaster = defaultAuthServerMaster;
function defaultAuthServerMonitor(msg, env, cb) {
    let id = msg['id'];
    let type = msg['serverType'];
    let servers = null;
    let appBase = process.cwd();
    let serverPath = path.join(appBase, '/config/adminServer');
    let presentPath = '';
    if (env) {
        presentPath = path.join(appBase, 'config', env, 'adminServer');
    }
    if (canBeResolve(serverPath)) {
        servers = require(serverPath);
    }
    else if (canBeResolve(presentPath)) {
        servers = require(presentPath);
    }
    else {
        cb('ok');
        return;
    }
    let len = servers.length;
    for (let i = 0; i < len; i++) {
        let server = servers[i];
        if (server['type'] === type) {
            cb(server['token']);
            return;
        }
    }
    cb(null);
    return;
}
exports.defaultAuthServerMonitor = defaultAuthServerMonitor;
//# sourceMappingURL=utils.js.map