import PubSubClient from './pubsubClient.js';

const url = 'wss://pubsub.warths.fr/';

const client = new PubSubClient(url);

client.addEventListener('socket:open', () => {
	client.subscribe('commands')
		.then(() => console.log('subscribed!'));
});

client.addEventListener('client:message', msg => console.log(msg));