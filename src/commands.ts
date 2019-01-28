import { Message, MessageOptions, StringResolvable } from 'discord.js'
import { playerSummaryToMessage, summarizePlayer, summarizeTeam, teamSummaryToMessage } from './functions/summarizer'
import fs from 'fs'
import { promisify } from 'util'

export const commands: Array<
	[
		RegExp,
		(message: Message, ...args: Array<any>) => Promise<void | StringResolvable | [StringResolvable, MessageOptions]>
	]
> = [
	[
		// Display README
		/^\.bb help$/,
		async function(message) {
			await message.author.send((await promisify(fs.readFile)('./README.md')).toString())
			message.deletable && message.delete()
			return
		},
	],

	[
		// Evaluate code
		/^\.bb eval/,
		function(message, code: string): Promise<string | void> {
			if (message.author.id !== process.env.DISCORD_OWNER) return Promise.reject('Insufficient permission')

			const result = eval(code)

			return result instanceof Promise ? result : Promise.resolve(result)
		},
	],

	[
		// Summarize a team's TESPA Compete Overwatch page
		/^\.bb summarize (.+)$/,
		async function(message, teamPage: string) {
			return teamSummaryToMessage(await summarizeTeam(teamPage))
		},
	],

	[
		// Summarize a BattleTag
		/^\.bb stat (.+)$/,
		async function(message, battleTag: string) {
			return playerSummaryToMessage(await summarizePlayer(battleTag))
		},
	],
]
