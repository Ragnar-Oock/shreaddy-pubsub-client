import PubSubClient from './pubsubClient.js';

const url = 'wss://pubsub.warths.fr/';

// const socket = new WebSocket(url)
// socket.addEventListener('open', () => {
// 	console.log('connection is open');
// 	main();
// })
// socket.addEventListener('close', () => {
// 	console.log('connection is closed');
// })
// socket.addEventListener('message', message => {
// 	console.log('message:', message);
// 	const parsedMessage = JSON.parse(message.data);
// 	console.log('parsedMessage:', parsedMessage);

// 	if (parsedMessage.data) {
// 		console.log('data: ', JSON.parse(parsedMessage.data.message));
// 	}
// })
// socket.addEventListener('error', (e)=> {
// 	console.log(e);
// })

// console.log(socket);

// function ping() {
// 	socket.send(JSON.stringify({
// 		"type": "PING"
// 	}));
// }

// function main() {
// 	console.log('sending message');
// 	msg = {
// 		"type": "LISTEN",
// 		"nonce": "d5e78y8zs2f87ysdfrhua7",
// 		"data": {"topics": ["commands"]}
// 	};
// 	socket.send(JSON.stringify(msg));
// 	console.log(socket.bufferedAmount);

// 	console.log(socket.bufferedAmount);

// 	setTimeout(() => {
// 		console.log(socket.bufferedAmount);
// 	}, 5000);

// 	setInterval(() => {
// 		ping()
// 	}, PING_INTERVAL);
// }

const client = new PubSubClient(url);

client.addEventListener('socket:open', () => {
	client.subscribe('commands')
		.then(() => console.log('subscribed!'));
});

client.addEventListener('client:message', msg => console.log(msg));