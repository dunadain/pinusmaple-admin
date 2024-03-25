"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RobustMqttClient = void 0;
/**
 * 更健壮的MQTT客户端，除非主动调用disconnect，否则会始终保持与server的连接
 * 情况1：
 *   master必须第一个启动，才能启动其它服务器进程，否则会启动失败。调整后，不需要必须先启动master，其它进程如果先启动了，会等待master启动后再向master注册
 * 情况2：
 *  由于master上会注册所有服务器进程，在重启master的过程中发现有概率出现心跳超时直接就断开monitorAgent与masterAgent的连接，不会重连。
 *  断开后会导致其它进程向master注册或者移除无法通知到连接断开的服务器，需要自己排查进程是不是断开了，手动重启断开的进程才能重新连接masterAgent
 */
const pinus_logger_1 = require("pinus-logger");
const path = require("path");
const mqttClient_1 = require("./mqttClient");
let logger = (0, pinus_logger_1.getLogger)('pinus-admin', path.basename(__filename));
class RobustMqttClient extends mqttClient_1.MqttClient {
    connect(host, port, cb) {
        var _a, _b;
        super.connect(host, port, cb);
        let self = this;
        // 移除父类监听，使用新的超时机制
        (_a = this.socket) === null || _a === void 0 ? void 0 : _a.removeAllListeners('timeout');
        (_b = this.socket) === null || _b === void 0 ? void 0 : _b.on('timeout', function () {
            self.onSocketClose();
        });
    }
    onSocketClose() {
        // console.log('onSocketClose ' + this.closed);
        if (this.closed) {
            return;
        }
        this.disconnect();
        this.reconnect();
    }
    checkKeepAlive() {
        var _a;
        if (this.closed) {
            return;
        }
        let now = Date.now();
        let KEEP_ALIVE_TIMEOUT = this.keepalive * 2;
        if (this.lastPong < this.lastPing && now - this.lastPing > KEEP_ALIVE_TIMEOUT) {
            logger.error('mqtt rpc client checkKeepAlive error timeout for %d', KEEP_ALIVE_TIMEOUT);
            this.onSocketClose();
        }
        else {
            (_a = this.socket) === null || _a === void 0 ? void 0 : _a.pingreq();
            this.lastPing = Date.now();
        }
    }
    disconnect() {
        var _a;
        this.connected = false;
        this.closed = true;
        // 取消定时
        if (this.keepaliveTimer)
            clearInterval(this.keepaliveTimer);
        if (this.timeoutId)
            clearTimeout(this.timeoutId);
        if (this.reconnectId)
            clearTimeout(this.reconnectId);
        // 重置
        this.lastPing = -1;
        this.lastPong = -1;
        // 释放连接
        (_a = this.socket) === null || _a === void 0 ? void 0 : _a.disconnect();
        this.socket = null;
    }
}
exports.RobustMqttClient = RobustMqttClient;
//# sourceMappingURL=robustMqttClient.js.map