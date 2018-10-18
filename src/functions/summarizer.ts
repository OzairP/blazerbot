import { promisify } from 'util'
import * as ow_ from 'overwatch-api'
import { Profile, Stats } from 'overwatch-api'
import cheerio from 'cheerio'
import axios from 'axios'
import { UnwrapPromise } from './utils'

// promsify ow api
const ow = {
	getProfile: promisify(ow_.getProfile),
	getStats: promisify(ow_.getStats)
}

/**
 * Get a users profile and stats
 *
 * @param {string} battletag - Users Battle.net tag
 * @return {Promise<OverwatchAPI.Stats & OverwatchAPI.Profile>}
 */
export async function summarizePlayer (battletag: string): Promise<Stats & Profile> {
	// Validate battletag
	if (!/.+#\d+/.test(battletag)) {
		throw Error('Bad battletag')
	}

	// Replace hash with dash, required by owapi
	battletag = battletag.replace('#', '-')

	// Merge object
	try {
		return {
			...(await ow.getProfile('pc', 'us', battletag) as Profile),
			...(await ow.getStats('pc', 'us', battletag) as Stats)
		}
	} catch (e) {
		console.error(`Failed to call OW API`, e)
		throw Error('Failed to reach Overwatch API')
	}
}

/**
 * Summarize an entire TESPA team page
 * @param {string} teamPage - URL of TESPA team page
 * @return {Promise<{total_players: number; public_players: number; ranked_players: number; average_skill_rating: number; average_skill_rating_name: string; player_summaries: {battle_tag: string; skill_rating: number | string; skill_rating_name: string; heroes: string | OverwatchAPI.HeroPlaytime[]}[]}>}
 */
export async function summarizeTeam (teamPage: string) {
	// Validate team page
	if (!/https:\/\/compete\.tespa\.org\/tournament\/111\/team\/\d+(?:\/)?/
		.test(teamPage)) {
		throw Error('Bad team url')
	}

	// Get HTML and pass into cheerio parser
	const pageHTML = await axios.get(teamPage)
	const $ = cheerio.load(pageHTML.data)
	const playersHTML = $('.compete-table td:nth-child(3)')
		.toArray()
		.map(el => $(el).text())

	if (playersHTML.length === 0) {
		throw Error('Query selector failed, the team page contents is unexpected')
	}

	// Resolve all player summaries
	const players = await Promise.all(
		playersHTML.map(summarizePlayer) // Convert to player summaries
	)

	// Only public players
	const publicPlayers = players.filter(player => !player.private)
	// Only ranked players
	const rankedPlayers = publicPlayers.filter(player => player.competitive.rank)

	// Compute average SR
	const average_skill_rating = Math.round(rankedPlayers
			.reduce((sr, player) => sr + player.competitive.rank, 0)
		/ rankedPlayers.length)

	return {
		total_players: players.length,
		public_players: publicPlayers.length,
		ranked_players: rankedPlayers.length,
		average_skill_rating,
		average_skill_rating_name: skillRatingToName(average_skill_rating),
		player_summaries: players.sort(SRComparator)
	}
}

/**
 * Convert a SR to their respective names
 * @param {number} sr - Skill rating
 * @return {string}
 */
export function skillRatingToName (sr: number) {
	if (1 <= sr && sr <= 1499) {
		return 'Bronze'
	} else if (1500 <= sr && sr <= 1999) {
		return 'Silver'
	} else if (2000 <= sr && sr <= 2499) {
		return 'Gold'
	} else if (2500 <= sr && sr <= 2999) {
		return 'Platinum'
	} else if (3000 <= sr && sr <= 3499) {
		return 'Diamond'
	} else if (3500 <= sr && sr <= 3999) {
		return 'Master'
	}
	return 'Grandmaster'
}

/**
 * Convert a team summary to a message
 * @param {ThenArg<ReturnType<typeof summarizeTeam>>} summary
 * @return {string}
 */
export function teamSummaryToMessage (summary: UnwrapPromise<ReturnType<typeof summarizeTeam>>) {
	let message = `
**Average Team SR**: ${summary.average_skill_rating_name} (${summary.average_skill_rating})
**Team Members**: ${summary.total_players} (${summary.ranked_players} are ranked)
**Player Summaries** (current competitive season):\n`

	message += summary.player_summaries
		.reduce((msg, player) => msg + playerSummaryToMessage(player, 3), '')

	return message
}

/**
 * Convert a player summary to messsage
 *
 * @param {UnwrapPromise<ReturnType<typeof summarizePlayer>>} summary
 * @param {number} heroLimit
 * @return {string}
 */
export function playerSummaryToMessage (summary: UnwrapPromise<ReturnType<typeof summarizePlayer>>, heroLimit: number = 5) {
	const skillRatingName = summary.competitive.rank ? skillRatingToName(summary.competitive.rank) : 'Unranked'
	const heroes = (() => {
		const heroes = summary.stats.top_heroes.competitive.played.splice(0, heroLimit)
		if (heroes.length === 0) {
			return `\tUnknown\n`
		}

		return heroes.reduce((content, hero) => content + `\t${hero.hero} (${hero.played})\n`, '')
	})()

	return `\n${summary.username} — ${skillRatingName} (${summary.competitive.rank || 'Unranked'})\n${heroes}`
}

/**
 * Compares SR, honoring the highest rated player
 *
 * @param {OverwatchAPI.Profile} a
 * @param {OverwatchAPI.Profile} b
 * @return {number}
 */
export function SRComparator (a: Profile, b: Profile) {
	if (a.competitive.rank && !b.competitive.rank) {
		return a.competitive.rank
	}

	if (b.competitive.rank && !a.competitive.rank) {
		return b.competitive.rank
	}

	return b.competitive.rank - a.competitive.rank
}
