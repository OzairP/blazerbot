import dotenv from 'dotenv'
import DiscordJS from 'discord.js'
import { commands } from './commands'

dotenv.config()

const client = new DiscordJS.Client()

client.on('message', message => {
	commands.forEach(([regex, executor]) => {
		// Test if the command matches regex
		if (!regex.test(message.content)) {
			return
		}

		// Indicate the bot is doing something
		message.channel.startTyping()

		// Spread regex capture groups as commands
		executor(...regex.exec(message.content)!.splice(1))
			.then(response => message.reply(...[].concat(response))) // Apply response data as message.reply args
			.then(() => message.channel.stopTyping()) // Stop typing
			.catch((e: Error) => { // Error handling
				message.reply(`Error: ${e.message}`)
					.catch(console.error)
				message.channel.stopTyping()
				console.error(e)
			})
	})
})

client.login(process.env.DISCORD_TOKEN)
	.then(() => console.log('Logged in'))
	.catch(console.error)
