export default class PubSubClient {
	// 4 minutes in ms
	pingInterval = 240000

	socket;

	openEvent = new Event('socket:open');

	callbacks = new Map();

	pendingResponses = new Map();

	/**
	 * @property {String} publishUrl URL used to publish to the socket
	 */
	publishUrl = '';

	constructor(subscribeUrl, publishUrl) {
		console.assert(!!subscribeUrl, 'socket url not defined, please provide a valid url for the socket to connect to');

		this.publishUrl = publishUrl;
		this.socket = new WebSocket(subscribeUrl);

		this.socket.addEventListener('open', () => this.onOpen());
		this.socket.addEventListener('close', () => this.onClose());
		this.socket.addEventListener('error', e => this.onError(e));
		this.socket.addEventListener('message', msg => this.onMessage(msg));

		this.initCallbacks();
	}

	initCallbacks() {
		const defaultCallbackNames = [
			'socket:open',
			'socket:close',
			'socket:message',
			'socket:error',
			'client:pong',
			'client:message',
			'client:response'
		];

		defaultCallbackNames.forEach(callbackName => this.callbacks.set(callbackName, []));
	}

	/**
	 * socket connection open handler
	 */
	onOpen() {
		console.info('connection open');
		// circumvent this not refering to the class in the setInterval
		const interval = this.pingInterval;

		setInterval(() => {
			this.sendPing();
		}, interval);

		// execute attached event listeners
		this.emit('socket:open');
	}

	/**
	 * socket connection close handler
	 */
	onClose() {
		console.info('connection closed');

		// execute attached event listeners
		this.emit('socket:close');
	}

	/**
	 * socket error handler
	 * @param {Object} error socket error
	 */
	onError(error) {
		console.error(error);

		// execute attached event listeners
		this.emit('socket:error', error);
	}

	/**
	 * message reception handler
	 * @param {Object} socketMessage message recieved by the socket
	 */
	onMessage(socketMessage) {
		// parse json data
		const messageData = JSON.parse(socketMessage.data);

		switch (messageData.type) {
			case 'PONG':
				this.emit('client:pong');
				break;

			case 'response':
				this.processResponses(socketMessage);
				this.emit('client:response', socketMessage);
				break;

			case 'MESSAGE':
				this.emit('client:message', { 'topic': messageData.data.topic, 'message': JSON.parse(messageData.data.message) });
				break;

			default:
				this.emit('client:message', messageData);
				break;
		}


		// execute attached event listeners
		this.emit('socket:message', socketMessage);
	}

	/**
	 * send a PING message
	 */
	sendPing() {
		this.sendMessage('PING');
	}

	/**
	 * send a message on the socket
	 * @param {String} type type of the message to be sent (PING, LISTEN, UNLISTEN...)
 	 * @param {Object=} data free form object to be published
	 * @param {String=} nonce unique string used to identify a possible response
	 */
	sendMessage(type, data, nonce) {
		const message = { type };

		// add data to the message if it exists
		if (data) {
			message.data = data;
		}

		// add nonce to the message if it exists
		if (nonce) {
			message.nonce = nonce;
		}

		this.socket.send(JSON.stringify(message));
	}

	/**
	 * subscribe to one or many topics with the same security requirement
	 * @param {String|String[]} topicList a single topic or an array of tpoics to subscribe to
	 * @param {String} auth Oauth token if needed, all topics needs to have the same security requirement
	 * @returns {Promise} status of the subscription request
	 */
	subscribe(topicList, auth) {
		// get a unique ID for the request
		const nonce = this.getNonce();
		// initiate the promise resolve and reject functions
		let outsideResolve;
		let outsideReject;

		// convert single topic string to array if needed
		if (typeof topicList === 'string') {
			topicList = [topicList];
		}

		// send the subscribe request
		this.sendMessage('LISTEN', { 'topics': topicList, 'auth_token': auth }, nonce);

		// prepare the promise to be used externaly in an event handler
		// see : https://stackoverflow.com/questions/26150232/resolve-javascript-promise-outside-function-scope
		const prom = new Promise((resolve, reject) => {
			outsideResolve = resolve;
			outsideReject = reject;
		});

		// await the response and resolve the promise accordingly
		this.awaitResponce(nonce, data => {
			if (data.error !== '') {
				outsideReject(data.error);
			}
			else {
				outsideResolve();
			}
		});

		// return the promise
		return prom;
	}

	/**
	 * @typedef {'socket:open'|'socket:close'|'socket:message'|'socket:close'|'client:pong'|'client:message'|'client:response'} EventName a list of valid event Names
	 */
	/**
	 * @callback EventCallback
	 * @param {*} data any data that can be contained by the event emited
	 */
	/**
	 * add an event listner to the client
	 * @param {EventName} eventName name of the event to lister to
	 * @param {EventCallback} callback function to be called when the event occurs
	 */
	addEventListener(eventName, callback) {
		// if no event listener are present for this event create it
		if (!this.callbacks.has(eventName)) {
			throw new Error(`Event ${ eventName } doesn't exist`);
		}

		// add the provided callback for the event
		const callbackList = this.callbacks.get(eventName);

		callbackList.push(callback);
		this.callbacks.set(eventName, callbackList);
	}

	/**
	 * execute all event listener registerer for the given event
	 * @param {EventName} eventName Name of the event to emit
	 * @param {*} data data caried by the event
	 */
	emit(eventName, data) {
		if (!this.callbacks.has(eventName)) {
			throw new Error(`Event ${ eventName } doesn't exist`);
		}

		this.callbacks.get(eventName).forEach(callback => callback(data));
	}

	/**
	 * await a response based on its nonce and execute a callback when it arrives
	 * @param {String} nonce nonce of the response to await
	 * @param {Function} callback function to be called when the response arrives
	 */
	awaitResponce(nonce, callback) {
		this.pendingResponses.set(nonce, callback);
	}

	/**
	 * looks thourght all pending responses and execture the callback registered
	 * @param {Object} message message Object as recieved from the socket
	 */
	processResponses(message) {
		const data = JSON.parse(message.data);
		const callback = this.pendingResponses.get(data.nonce);

		// if a callback has been registered for this nonce execute it and remove the nonce from the pending responses
		if (callback) {
			this.pendingResponses.delete(data.nonce);

			callback(data);
		}
	}

	/**
	 * generate a UUID v4 string
	 * @returns {String}
	 */
	getNonce() {
		// see https://gist.github.com/jed/982883
		function b(a) {
			return a ? (a ^ Math.random() * 16 >> a / 4).toString(16) : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, b);
		}

		return b();
	}

	publish(topic, body, auth) {
		fetch(
			`${ this.publishUrl }/${ topic }`,
			{
				method: 'POST',
				headers: new Headers({
					'Content-Type': 'application/json',
					'Authorization': auth
				}),
				body: JSON.stringify(body)
			}
		)
			.then(response => response.blob())
			.then(data => data.text())
			.then(data => {
				console.log('success', data);
			})
			.catch(error => {
				console.log('failed', error);
			});
	}

	sendCommand(name, parameters, auth) {
		return this.publish('commands', {
			command: name,
			parameters: parameters
		}, auth);
	}
}