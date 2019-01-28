import { promisify } from 'util'
import * as ow_ from 'overwatch-api'
import { Profile, Stats } from 'overwatch-api'
import cheerio from 'cheerio'
import axios from 'axios'
import { partition, UnwrapPromise } from './utils'

type PlayerSummary = { discriminator: string } & Stats & Profile
type TeamSummary = UnwrapPromise<ReturnType<typeof summarizeTeam>>

// promisify ow api
const ow = {
	getProfile: promisify(ow_.getProfile),
	getStats: promisify(ow_.getStats),
}

/**
 * Get a users profile and stats
 */
export async function summarizePlayer(battletag: string): Promise<PlayerSummary> {
	// Validate BattleTag
	if (!/.+#\d+/.test(battletag)) {
		throw Error('Bad BattleTag')
	}

	const [, username, discriminator] = /(.+)#(\d+)/.exec(battletag)!

	// Replace hash with dash, required by OW-API
	const battletagDashed = `${username}-${discriminator}`

	// Merge object
	try {
		return {
			discriminator,
			...((await ow.getProfile('pc', 'us', battletagDashed)) as Profile),
			...((await ow.getStats('pc', 'us', battletagDashed)) as Stats),
		}
	} catch (e) {
		console.error(`Failed to reach Overwatch API for ${battletag}.\nError: ${e.message}`, e)
		throw Error(`Failed to reach Overwatch API for ${battletag}.\nError: ${e.message}`)
	}
}

/**
 * Summarize an entire TESPA team page
 */
export async function summarizeTeam(tespaTeamPage: string) {
	// Validate team page
	if (!/https:\/\/compete\.tespa\.org\/tournament\/\d+\/team\/\d+(?:\/)?/.test(tespaTeamPage)) {
		throw Error('Bad team url')
	}

	// Get HTML and pass into cheerio parser
	const pageHTML = await axios.get(tespaTeamPage)
	const $ = cheerio.load(pageHTML.data)
	const playersHTML = $('.compete-table td:nth-child(3)')
		.toArray()
		.map(el => $(el).text())

	if (playersHTML.length === 0) {
		throw Error('Query selector failed, the team page contents is unexpected')
	}

	// Resolve all player summaries
	const playerErrorMix: Array<PlayerSummary | Error> = await Promise.all(
		// Convert to player summaries, keep errors
		playersHTML.map(player => summarizePlayer(player).catch(e => e))
	)

	const [errors, players] = playerErrorMix.reduce(
		...partition<PlayerSummary | Error, Error, PlayerSummary>(el => (el instanceof Error ? -1 : 1))
	)

	// Only public players
	const publicPlayers = players.filter(player => !player.private)
	// Only ranked players
	const rankedPlayers = publicPlayers.filter(player => player.competitive.rank)

	// Compute average SR
	const average_skill_rating = Math.round(
		rankedPlayers.reduce((sr, player) => sr + player.competitive.rank, 0) / rankedPlayers.length
	)

	return {
		total_players: players.length,
		public_players: publicPlayers.length,
		ranked_players: rankedPlayers.length,
		average_skill_rating,
		average_skill_rating_name: skillRatingToName(average_skill_rating),
		player_summaries: players.sort(SRComparator),
		errors,
	}
}

/**
 * Convert a SR to their respective names
 */
export function skillRatingToName(skillRating: number) {
	if (1 <= skillRating && skillRating <= 1499) {
		return 'Bronze'
	} else if (1500 <= skillRating && skillRating <= 1999) {
		return 'Silver'
	} else if (2000 <= skillRating && skillRating <= 2499) {
		return 'Gold'
	} else if (2500 <= skillRating && skillRating <= 2999) {
		return 'Platinum'
	} else if (3000 <= skillRating && skillRating <= 3499) {
		return 'Diamond'
	} else if (3500 <= skillRating && skillRating <= 3999) {
		return 'Master'
	}
	return 'Grandmaster'
}

/**
 * Convert a team summary to a message
 */
export function teamSummaryToMessage(summary: TeamSummary) {
	let message = `
**Average Team SR**: ${summary.average_skill_rating_name} (${summary.average_skill_rating})
**Team Members**: ${summary.total_players} (${summary.ranked_players} are ranked)
**Player Summaries** (current competitive season):\n`

	message += summary.player_summaries.reduce((msg, player) => msg + playerSummaryToMessage(player, 3), '')

	message += `\n**Errors:**\n` + summary.errors.map(e => e.message).join('\n')

	return message
}

/**
 * Convert a player summary to message
 */
export function playerSummaryToMessage(summary: PlayerSummary, heroListLimit: number = 5) {
	const skillRatingName = summary.competitive.rank ? skillRatingToName(summary.competitive.rank) : 'Unranked'
	const heroes = (() => {
		const heroes = summary.stats.top_heroes.competitive.played.splice(0, heroListLimit)
		if (heroes.length === 0) {
			return `\tUnknown\n`
		}

		return heroes.reduce((content, hero) => content + `\t${hero.hero} (${hero.played})\n`, '')
	})()

	return `\n**${summary.username}** — ${skillRatingName} (${summary.competitive.rank ||
		'Unranked'})\nhttps://www.overbuff.com/players/pc/${summary.username}-${summary.discriminator}\n${heroes}`
}

/**
 * Compares SR, honoring the highest rated player
 */
export function SRComparator(a: Profile, b: Profile) {
	const ar = a.competitive.rank
	const br = b.competitive.rank

	// A and B are both unranked
	if (!ar && !br) {
		return 0
	}

	// A is ranked, B is not
	if (ar && !br) {
		return -1
	}

	// B is ranked, A is not
	if (br && !ar) {
		return 1
	}

	return br - ar
}
