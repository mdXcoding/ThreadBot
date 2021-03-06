const { Client, Collection, Intents } = require('discord.js');
const { inlineCode, codeBlock } = require('@discordjs/builders');
const client = new Client({ intents: [Intents.FLAGS.GUILDS] });
const schedule = require('node-schedule');

// settings
const token = process.env.DISCORD_TOKEN;
const MessageChannelName = process.env.DISCORD_CALLBACK_CHANNEL;
const FeedbackChannelName = process.env.DISCORD_FEEDBACK_CHANNEL;
const DebugMode = false;

if (!!!token)
{
	console.log("NO DISCORD TOKEN SET!");
	return;
}

if (!!!MessageChannelName)
{
	console.log("NO DISCORD CHANNEL SET");
	return;
}

client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);

	getThreads();

	const job = schedule.scheduleJob('23 * * * *', function() {
		getThreads();
	});
});

client.login(token);

/**
 * main function
 */
function getThreads()
{
	console.log("doing my job...");

	client.guilds.cache.each(guild => {

		// dismiss inactive guild
		if (!!!guild.available) return;

		// get feedbackChannel
		const feedbackChannel = client.channels.cache.find(channel => channel.name === FeedbackChannelName);


		// create Header Text
		let text = "Unser Community-Mitglied Michele war so nett, eine automatisierte Übersicht der vorhandenen Threads zu bauen. \n" +
				   "Diesen Überblick findet ihr unter diesem Text. Es sind aktive als auch archivierte Threads sichtbar und jede Stunde wird geschaut ob sich was geändert hat und die Liste entsprechend angepasst. \n" +
				   "Anmerkung zu archivierten Threads (die ohne Link): Diese können nur über das #-Menü oben rechts in dem jeweiligen Channel geöffnet werden. \n" +
				   "\n";

		if (feedbackChannel)
		{
			text += `Anregungen/Feedback dazu gerne in <#${feedbackChannel.id}>\n`;
		}

		let promises = [];

		// get all channels
		guild.channels.fetch().then(channels => {

			// channel loop
			channels.each(channel => {

				// skip if channel has no threads or is not viewable
				if (!!!channel.threads || !!!channel.viewable) return;

				// fetch threads promise
				promises.push(
					new Promise((resolve, reject) => {

						let threads = { active: null, inActive: null }

						// active
						channel.threads.fetchActive().then(response => {
							threads.active = response.threads;

							// inactive
							channel.threads.fetchArchived({ type: "public" }).then(response => {
								
								threads.inActive = response.threads ? response.threads : null;
								resolve(new Collection([...threads.active, ...threads.inActive]));
							})
								.catch(e => {
									console.log("access denied: " + channel.name);
									resolve([null, null]);
								});
						});
					})
					.then(threads => {

						// we drop no length threads
						if(!!!threads.size) {
							return;
						}

						// channel text
						if (DebugMode)
						{
							console.log("Channel: " + channel.name);
						}

						text += `\n ** <#${channel.id}> ** \n`;

						threads.each(thread => {

							if (DebugMode)
							{
								console.log("- - - " + thread.name);
							}

							if (thread.archived)
							{
								text +=	`** ** - #${thread.name} \n`;
							}
							else
							{
								text += `** ** - <#${thread.id}> \n`;
							}
						});
					})
				);
			});

			Promise.all(promises).then(response => {

				// get channel to message
				const channelToMessage = client.channels.cache.find(channel => channel.name === MessageChannelName);
				if (!!!channelToMessage) return;

				// check last message
				channelToMessage.messages.fetch({limit: 1}).then(response => {
					let message = response.first();

					if (message && message.author.bot)
					{
						message.edit(text);
					}
					else
					{
						channelToMessage.send(text);
					}

					console.log("done!");
				});
			});
		});
	});
}
