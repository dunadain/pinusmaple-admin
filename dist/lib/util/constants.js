"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ADMIN_PATH = exports.TYPE_MONITOR = exports.TYPE_CLIENT = exports.DEFAULT_PARAM = void 0;
exports.DEFAULT_PARAM = {
    KEEPALIVE: 60 * 1000,
    TIMEOUT: 5 * 1000,
    RECONNECT_DELAY: 1 * 1000,
    RECONNECT_DELAY_MAX: 60 * 1000
};
exports.TYPE_CLIENT = 'client';
exports.TYPE_MONITOR = 'monitor';
exports.DEFAULT_ADMIN_PATH = {
    ADMIN_USER: '/config/adminUser.json',
    ADMIN_FILENAME: 'adminUser.json'
};
//# sourceMappingURL=constants.js.map