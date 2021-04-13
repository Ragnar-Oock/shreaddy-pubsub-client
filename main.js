import PubSubClient from './pubsubClient.js';

const subscribeUrl = 'wss://pubsub.warths.fr/';
const publishUrl = 'https://pubsub.warths.fr/publish';

const client = new PubSubClient(subscribeUrl, publishUrl);

client.addEventListener('socket:open', () => {
	client.subscribe('commands')
		.then(() => {
			console.log('subscribed!');
			client.sendCommand('vip', ['a', 'b'], import.meta.env.VITE_AUTH_TOKEN);

		});
});

client.addEventListener('client:message', event => {
	if (event.topic === 'commands') {
		const parameters = event.message.parameters.reduce((list, param) => list = `${ list }, ${ param }`);

		console.log(`${ event.message.user.display_name } issued the command ${ event.message.command } with the parameters ${ parameters }`);
	}
});

client.addEventListener('socket:message', msg => console.log(msg));