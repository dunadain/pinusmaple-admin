"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRO_FAIL = exports.PRO_OK = exports.PRO_CODE = exports.isRequest = exports.parse = exports.composeCommand = exports.composeResponse = exports.composeRequest = void 0;
function composeRequest(id, moduleId, body) {
    if (id) {
        // request message
        return JSON.stringify({
            reqId: id,
            moduleId: moduleId,
            body: body
        });
    }
    else {
        // notify message
        return {
            moduleId: moduleId,
            body: body
        };
    }
}
exports.composeRequest = composeRequest;
function composeResponse(req, err, res) {
    if (req.reqId) {
        // request only
        return JSON.stringify({
            respId: req.reqId,
            error: cloneError(err),
            body: res
        });
    }
    // invalid message(notify dose not need response)
    return null;
}
exports.composeResponse = composeResponse;
function composeCommand(id, command, moduleId, body) {
    if (id) {
        // command message
        return JSON.stringify({
            reqId: id,
            command: command,
            moduleId: moduleId,
            body: body
        });
    }
    else {
        return JSON.stringify({
            command: command,
            moduleId: moduleId,
            body: body
        });
    }
}
exports.composeCommand = composeCommand;
function parse(msg) {
    if (typeof msg === 'string') {
        return JSON.parse(msg);
    }
    return msg;
}
exports.parse = parse;
function isRequest(msg) {
    return (msg && msg.reqId);
}
exports.isRequest = isRequest;
let cloneError = function (origin) {
    // copy the stack infos for Error instance json result is empty
    if (!(origin instanceof Error)) {
        return origin;
    }
    let res = {
        message: origin.message,
        stack: origin.stack
    };
    return res;
};
var PRO_CODE;
(function (PRO_CODE) {
    PRO_CODE[PRO_CODE["OK"] = 1] = "OK";
    PRO_CODE[PRO_CODE["FAIL"] = -1] = "FAIL";
})(PRO_CODE = exports.PRO_CODE || (exports.PRO_CODE = {}));
exports.PRO_OK = PRO_CODE.OK;
exports.PRO_FAIL = PRO_CODE.FAIL;
//# sourceMappingURL=protocol.js.map