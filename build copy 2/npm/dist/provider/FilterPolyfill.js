"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FilterPolyfill = void 0;
exports.filterFromParam = filterFromParam;

var _types = require("../types");

var _util = require("../util");

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const TIMEOUT = 5 * 60 * 1000; // 5 minutes

const JSONRPC_TEMPLATE = {
  jsonrpc: "2.0",
  id: 0
};

class FilterPolyfill {
  // <id, filter>
  // <id>
  // <id, true>
  // <id, cursor>
  // <id, setTimeout id>
  constructor(provider) {
    _defineProperty(this, "logFilters", new Map());

    _defineProperty(this, "blockFilters", new Set());

    _defineProperty(this, "pendingTransactionFilters", new Set());

    _defineProperty(this, "cursors", new Map());

    _defineProperty(this, "timeouts", new Map());

    _defineProperty(this, "nextFilterId", (0, _types.IntNumber)(1));

    this.provider = provider;
  }

  async newFilter(param) {
    const filter = filterFromParam(param);
    const id = this.makeFilterId();
    const cursor = await this.setInitialCursorPosition(id, filter.fromBlock);
    console.log(`Installing new log filter(${id}):`, filter, "initial cursor position:", cursor);
    this.logFilters.set(id, filter);
    this.setFilterTimeout(id);
    return (0, _util.hexStringFromIntNumber)(id);
  }

  async newBlockFilter() {
    const id = this.makeFilterId();
    const cursor = await this.setInitialCursorPosition(id, "latest");
    console.log(`Installing new block filter (${id}) with initial cursor position:`, cursor);
    this.blockFilters.add(id);
    this.setFilterTimeout(id);
    return (0, _util.hexStringFromIntNumber)(id);
  }

  async newPendingTransactionFilter() {
    const id = this.makeFilterId();
    const cursor = await this.setInitialCursorPosition(id, "latest");
    console.log(`Installing new block filter (${id}) with initial cursor position:`, cursor);
    this.pendingTransactionFilters.add(id);
    this.setFilterTimeout(id);
    return (0, _util.hexStringFromIntNumber)(id);
  }

  uninstallFilter(filterId) {
    const id = (0, _util.intNumberFromHexString)(filterId);
    console.log(`Uninstalling filter (${id})`);
    this.deleteFilter(id);
    return true;
  }

  getFilterChanges(filterId) {
    const id = (0, _util.intNumberFromHexString)(filterId);

    if (this.timeouts.has(id)) {
      // extend timeout
      this.setFilterTimeout(id);
    }

    if (this.logFilters.has(id)) {
      return this.getLogFilterChanges(id);
    } else if (this.blockFilters.has(id)) {
      return this.getBlockFilterChanges(id);
    } else if (this.pendingTransactionFilters.has(id)) {
      return this.getPendingTransactionFilterChanges(id);
    }

    return Promise.resolve(filterNotFoundError());
  }

  async getFilterLogs(filterId) {
    const id = (0, _util.intNumberFromHexString)(filterId);
    const filter = this.logFilters.get(id);

    if (!filter) {
      return filterNotFoundError();
    }

    return this.sendAsyncPromise({ ...JSONRPC_TEMPLATE,
      method: "eth_getLogs",
      params: [paramFromFilter(filter)]
    });
  }

  makeFilterId() {
    return (0, _types.IntNumber)(++this.nextFilterId);
  }

  sendAsyncPromise(request) {
    return new Promise((resolve, reject) => {
      this.provider.sendAsync(request, (err, response) => {
        if (err) {
          return reject(err);
        }

        if (Array.isArray(response) || response == null) {
          return reject(new Error(`unexpected response received: ${JSON.stringify(response)}`));
        }

        resolve(response);
      });
    });
  }

  deleteFilter(id) {
    console.log(`Deleting filter (${id})`);
    this.logFilters.delete(id);
    this.blockFilters.delete(id);
    this.pendingTransactionFilters.delete(id);
    this.cursors.delete(id);
    this.timeouts.delete(id);
  }

  async getLogFilterChanges(id) {
    const filter = this.logFilters.get(id);
    const cursorPosition = this.cursors.get(id);

    if (!cursorPosition || !filter) {
      return filterNotFoundError();
    }

    const currentBlockHeight = await this.getCurrentBlockHeight();
    const toBlock = filter.toBlock === "latest" ? currentBlockHeight : filter.toBlock;

    if (cursorPosition > currentBlockHeight) {
      return emptyResult();
    }

    if (cursorPosition > filter.toBlock) {
      return emptyResult();
    }

    console.log(`Fetching logs from ${cursorPosition} to ${toBlock} for filter ${id}`);
    const response = await this.sendAsyncPromise({ ...JSONRPC_TEMPLATE,
      method: "eth_getLogs",
      params: [paramFromFilter({ ...filter,
        fromBlock: cursorPosition,
        toBlock
      })]
    });

    if (Array.isArray(response.result)) {
      const blocks = response.result.map(log => (0, _util.intNumberFromHexString)(log.blockNumber || "0x0"));
      const highestBlock = Math.max(...blocks);

      if (highestBlock && highestBlock > cursorPosition) {
        const newCursorPosition = (0, _types.IntNumber)(highestBlock + 1);
        console.log(`Moving cursor position for filter (${id}) from ${cursorPosition} to ${newCursorPosition}`);
        this.cursors.set(id, newCursorPosition);
      }
    }

    return response;
  }

  async getBlockFilterChanges(id) {
    const cursorPosition = this.cursors.get(id);

    if (!cursorPosition) {
      return filterNotFoundError();
    }

    const currentBlockHeight = await this.getCurrentBlockHeight();

    if (cursorPosition > currentBlockHeight) {
      return emptyResult();
    }

    console.log(`Fetching blocks from ${cursorPosition} to ${currentBlockHeight} for filter (${id})`);
    const blocks = (await Promise.all( // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
    (0, _util.range)(cursorPosition, currentBlockHeight + 1).map(i => this.getBlockHashByNumber((0, _types.IntNumber)(i))))).filter(hash => !!hash); // eslint-disable-next-line @typescript-eslint/restrict-plus-operands

    const newCursorPosition = (0, _types.IntNumber)(cursorPosition + blocks.length);
    console.log(`Moving cursor position for filter (${id}) from ${cursorPosition} to ${newCursorPosition}`);
    this.cursors.set(id, newCursorPosition);
    return { ...JSONRPC_TEMPLATE,
      result: blocks
    };
  }

  async getPendingTransactionFilterChanges(_id) {
    // pending transaction filters are not supported
    return Promise.resolve(emptyResult());
  }

  async setInitialCursorPosition(id, startBlock) {
    const currentBlockHeight = await this.getCurrentBlockHeight();
    const initialCursorPosition = typeof startBlock === "number" && startBlock > currentBlockHeight ? startBlock : currentBlockHeight;
    this.cursors.set(id, initialCursorPosition);
    return initialCursorPosition;
  }

  setFilterTimeout(id) {
    const existing = this.timeouts.get(id);

    if (existing) {
      window.clearTimeout(existing);
    }

    const timeout = window.setTimeout(() => {
      console.log(`Filter (${id}) timed out`);
      this.deleteFilter(id);
    }, TIMEOUT);
    this.timeouts.set(id, timeout);
  }

  async getCurrentBlockHeight() {
    const {
      result
    } = await this.sendAsyncPromise({ ...JSONRPC_TEMPLATE,
      method: "eth_blockNumber",
      params: []
    });
    return (0, _util.intNumberFromHexString)((0, _util.ensureHexString)(result));
  }

  async getBlockHashByNumber(blockNumber) {
    const response = await this.sendAsyncPromise({ ...JSONRPC_TEMPLATE,
      method: "eth_getBlockByNumber",
      params: [(0, _util.hexStringFromIntNumber)(blockNumber), false]
    });

    if (response.result && typeof response.result.hash === "string") {
      return (0, _util.ensureHexString)(response.result.hash);
    }

    return null;
  }

}

exports.FilterPolyfill = FilterPolyfill;

function filterFromParam(param) {
  return {
    fromBlock: intBlockHeightFromHexBlockHeight(param.fromBlock),
    toBlock: intBlockHeightFromHexBlockHeight(param.toBlock),
    addresses: param.address === undefined ? null : Array.isArray(param.address) ? param.address : [param.address],
    topics: param.topics || []
  };
}

function paramFromFilter(filter) {
  const param = {
    fromBlock: hexBlockHeightFromIntBlockHeight(filter.fromBlock),
    toBlock: hexBlockHeightFromIntBlockHeight(filter.toBlock),
    topics: filter.topics
  };

  if (filter.addresses !== null) {
    param.address = filter.addresses;
  }

  return param;
}

function intBlockHeightFromHexBlockHeight(value) {
  if (value === undefined || value === "latest" || value === "pending") {
    return "latest";
  } else if (value === "earliest") {
    return (0, _types.IntNumber)(0);
  } else if ((0, _util.isHexString)(value)) {
    return (0, _util.intNumberFromHexString)(value);
  }

  throw new Error(`Invalid block option: ${String(value)}`);
}

function hexBlockHeightFromIntBlockHeight(value) {
  if (value === "latest") {
    return value;
  }

  return (0, _util.hexStringFromIntNumber)(value);
}

function filterNotFoundError() {
  return { ...JSONRPC_TEMPLATE,
    error: {
      code: -32000,
      message: "filter not found"
    }
  };
}

function emptyResult() {
  return { ...JSONRPC_TEMPLATE,
    result: []
  };
}