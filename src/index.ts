import dotenv from 'dotenv'
import DiscordJS from 'discord.js'
import promise_delay from 'p-min-delay'
import { commands } from './commands'

dotenv.config()

const client = new DiscordJS.Client()

client.on('message', message => {
	if (message.author.bot) {
		return
	}

	commands.forEach(([regex, executor]) => {
		// Test if the command matches regex
		if (!regex.test(message.content)) {
			return
		}

		// Indicate the bot is doing something
		message.channel.startTyping()

		// Spread regex capture groups as commands
		promise_delay(executor(message, ...regex.exec(message.content)!.splice(1)), 2500)
			.then(response => (message.channel.stopTyping(), response)) // Stop typing
			.then(response => response && message.reply(...[].concat(response))) // Apply response data as message.reply args
			.catch((e: Error) => { // Error handling
				message.reply(`Error: ${e.message}`)
					.catch(console.error)
				message.channel.stopTyping()
				console.error(e)
			})
	})
})

client.login(process.env.DISCORD_TOKEN)
	.then(() => {
		console.log('Logged in')
		return client.user.setActivity('.bb help')
	})
	.catch(console.error)
