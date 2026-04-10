'use strict';

const utils = require('@iobroker/adapter-core');
const dgram = require('node:dgram');

class MarstekVenusAdapter extends utils.Adapter {
    constructor(options = {}) {
        super({
            ...options,
            name: 'marstek-venus',
        });

        this.socket = null;
        this.requestId = 1;
        this.pendingRequests = new Map();
        this.pollInterval = null;
        this.slowPollInterval = null;
        this.discoveredIP = null;
        this._pollingInProgress = false;
        this._pollFailureCount = 0;

        this.on('ready', () => this.onReady());
        this.on('stateChange', (id, state) => this.onStateChange(id, state));
        this.on('unload', (callback) => this.onUnload(callback));
        this.on('message', (obj) => this.onMessage(obj));
    }

    async onReady() {
        this.log.info('Starting Marstek Venus adapter');

        await this.initStates();

        this.socket = dgram.createSocket('udp4');

        this.socket.on('error', (err) => {
            this.log.error(`UDP socket error: ${err.message}`);
        });

        this.socket.on('message', this.handleResponse.bind(this));

        this.socket.bind(0, () => {
            this.socket.setBroadcast(true);
            const address = this.socket.address();
            this.log.debug(`UDP socket bound successfully to ${address.address}:${address.port}`);
        });

        if (this.config.autoDiscovery && !this.config.ipAddress) {
            await this.discoverDevices();
        } else if (this.config.ipAddress) {
            this.log.info(`Using configured device: ${this.config.ipAddress}:${this.config.udpPort}`);
            this.startPolling();
        } else {
            this.log.warn('No device configured and auto-discovery disabled');
        }
    }

    async sendRequest(method, params = {}) {
        return new Promise((resolve, reject) => {
            const id = this.requestId++;
            const targetIP = this.discoveredIP || this.config.ipAddress;

            if (!targetIP) {
                this.log.error(`sendRequest ${method}: No target IP configured`);
                reject(new Error(`No target IP configured`));
                return;
            }

            const request = { id, method, params };
            const message = Buffer.from(JSON.stringify(request));

            const timeoutHandle = () => {
                const pending = this.pendingRequests.get(id);
                if (pending) {
                    clearTimeout(pending.timeout);
                    pending.reject(new Error(`Request ${method} timed out`));
                    this.pendingRequests.delete(id);
                }
                this.log.warn(`sendRequest ${method} to ${targetIP}:${this.config.udpPort} timed out`);
            };

            const timeout = setTimeout(timeoutHandle, 20000);

            this.pendingRequests.set(id, { resolve, reject, timeout });

            this.log.debug(`Sending ${method} to ${targetIP}:${this.config.udpPort}`);
            this.socket.send(message, 0, message.length, this.config.udpPort, targetIP, (err) => {
                if (err) {
                    clearTimeout(timeout);
                    this.pendingRequests.delete(id);
                    this.log.error(`sendRequest ${method} to ${targetIP} send error: ${err.message}`);
                    reject(err);
                }
            });

            setTimeout(() => {
                this.socket.send(message, 0, message.length, this.config.udpPort, '255.255.255.255', (err) => {
                    if (err) {
                        this.log.debug(`Broadcast retry for ${method} failed: ${err.message}`);
                    }
                });
            }, 1000);
        });
    }

    handleResponse(msgBuffer, rinfo) {
        try {
            const response = JSON.parse(msgBuffer.toString());
            this.log.debug(`Received response from ${rinfo.address}:${rinfo.port}: ${JSON.stringify(response)}`);

            if (response.id !== undefined && this.pendingRequests.has(response.id)) {
                const pending = this.pendingRequests.get(response.id);
                clearTimeout(pending.timeout);
                this.pendingRequests.delete(response.id);

                if (response.error) {
                    pending.reject(new Error(`API Error ${response.error.code}: ${response.error.message}`));
                    this.log.debug(`Request ${response.id} failed: ${response.error.message}`);
                } else {
                    const resultValue = response.result;
                    pending.resolve(resultValue);
                    this.log.debug(`Request ${response.id} succeeded`);
                    pending.timeout = null;
                    pending.resolve = undefined;
                    pending.reject = undefined;
                }
            } else if (response.result && response.result.device) {
                this.log.info(`Discovered device: ${response.result.device} at ${response.result.ip}`);
                this.log.debug(`Device details: ${JSON.stringify(response.result)}`);

                if (response.result && response.result.ip) {
                    if (!this.config.ipAddress) {
                        this.discoveredIP = response.result.ip;
                        this.log.info(`Auto-selecting discovered device: ${this.discoveredIP}`);
                        this.startPolling();
                        this.setStateAsync('info.device', { val: response.result.device, ack: true });
                        this.setStateAsync('info.firmware', { val: response.result.ver, ack: true });
                        this.setStateAsync('info.mac', { val: response.result.ble_mac || response.result.wifi_mac, ack: true });
                    } else {
                        this.log.info(`Device discovered but using configured IP: ${this.config.ipAddress}`);
                    }
                } else {
                    this.log.warn(`Received discovery response without IP address: ${JSON.stringify(response.result)}`);
                }
            } else {
                this.log.debug(`Received unsolicited message: ${response.method}`);
            }
        } catch (e) {
            this.log.debug(`Invalid response received: ${e.message}`);
            this.log.debug(`Raw message: ${msgBuffer.toString()}`);
            this.log.debug(`From: ${rinfo.address}:${rinfo.port}`);
        }
    }

    startPolling() {
        this.log.info('Starting polling loop');
        this.pollInterval = setInterval(() => this.poll(), this.config.pollInterval || 10000);
        this.startSlowPolling();
        this.poll();
    }

    startSlowPolling() {
        this.log.info('Starting slow polling loop (info + network every 10 min)');
        this.slowPollInterval = setInterval(() => this.pollSlow(), 600000);
        this.pollSlow();
    }

    async onMessage(obj) {
        if (obj.command === 'discover') {
            await this.discoverDevices();
            if (obj.callback) this.sendTo(obj.from, obj.command, {
                success: !!this.discoveredIP,
                ipAddress: this.discoveredIP || null
            }, obj.callback);
        }
    }

    onUnload(callback) {
        try {
            this.log.info('Shutting down Marstek Venus adapter');

            if (this.pollInterval) clearInterval(this.pollInterval);
            if (this.slowPollInterval) clearInterval(this.slowPollInterval);
            if (this.socket) this.socket.close();

            for (const [id, pending] of this.pendingRequests) {
                clearTimeout(pending.timeout);
                pending.reject(new Error('Adapter shutting down'));
                this.pendingRequests.delete(id);
            }

            callback();
        } catch (e) {
            callback();
        }
    }
}

const { Adapter: AdapterMixin } = require('./lib/adapter');
const { Polling } = require('./lib/polling');
const { Control } = require('./lib/control');
const { Discovery } = require('./lib/discovery');

Object.assign(MarstekVenusAdapter.prototype, utils.Adapter.prototype);

// Helper function to copy methods from mixin to prototype
function copyMethods(target, source) {
    if (!source) return;
    if (source.prototype && Object.getPrototypeOf(source.prototype)) {
        // It's a class - copy from prototype
        Object.defineProperties(target, Object.getOwnPropertyDescriptors(source.prototype));
    } else {
        // It's a plain object - copy directly
        Object.assign(target, source);
    }
}

if (AdapterMixin) copyMethods(MarstekVenusAdapter.prototype, AdapterMixin);
if (Polling) copyMethods(MarstekVenusAdapter.prototype, Polling);
if (Control) copyMethods(MarstekVenusAdapter.prototype, Control);
if (Discovery) copyMethods(MarstekVenusAdapter.prototype, Discovery);

// Export both the class and the factory
module.exports = MarstekVenusAdapter;
module.exports.createAdapter = (options) => new MarstekVenusAdapter(options);

if (!module.parent) {
    new MarstekVenusAdapter();
}