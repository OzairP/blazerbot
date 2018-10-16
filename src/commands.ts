import { MessageOptions, StringResolvable } from 'discord.js'
import { playerSummaryToMessage, summarizePlayer, summarizeTeam, teamSummaryToMessage } from './functions/summarizer'
import fs from 'fs'
import { promisify } from 'util'

export const commands: Array<[RegExp, (...args: Array<any>) => Promise<StringResolvable | [StringResolvable, MessageOptions]>]> = [

	[
		// Display README
		/\.bb help/,
		async function () {
			return '\n' + (await promisify(fs.readFile)('./README.md')).toString()
		}
	],

	[
		// Summarize a team's TESPA Compete Overwatch page
		/\.bb summarize (.+)/,
		async function (teamPage: string) {
			return teamSummaryToMessage(await summarizeTeam(teamPage))
		}
	],

	[
		// Summarize a BattleTag
		/\.bb stat (.+)/,
		async function (battleTag: string) {
			return playerSummaryToMessage(await summarizePlayer(battleTag))
		}
	]

]
