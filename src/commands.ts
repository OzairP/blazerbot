import { MessageOptions, StringResolvable } from 'discord.js'
import { summarizeTeam, teamSummaryToMessage } from './functions/summarizer'

export const commands: [[RegExp, (...args: Array<any>) => Promise<StringResolvable | [StringResolvable, MessageOptions]>]] = [

	[
		/\.bb summarize (https:\/\/compete\.tespa\.org\/tournament\/111\/team\/\d+(?:\/)?)/,
		async function (teamPage: string) {
			const summary = await summarizeTeam(teamPage)
			return teamSummaryToMessage(summary)
		}
	]

]
