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
	return {
		...(await ow.getProfile('pc', 'us', battletag) as Profile),
		...(await ow.getStats('pc', 'us', battletag) as Stats)
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

	// Resolve all player summaries
	const players = await Promise.all(
		// Query user battletags
		$('.compete-table td:nth-child(3)')
			.toArray()
			.map(el => $(el).text())
			.map(summarizePlayer) // Convert to player summaries
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
		player_summaries:
			players.map(player => ({
				battle_tag: player.username,
				skill_rating: player.competitive.rank || 'Unranked',
				skill_rating_name: player.competitive.rank ? skillRatingToName(player.competitive.rank) : 'Unranked',
				heroes: player.private ? 'Unknown' : player.stats.top_heroes.competitive.played.slice(0, 3)
			}))
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

	message += summary.player_summaries.reduce((msg, player) => {
		const heroes = (() => {
			if (!Array.isArray(player.heroes)) {
				return `\t\t${player.heroes}\n`
			}

			return player.heroes.reduce((content, hero) => content + `\t\t${hero.hero} (${hero.played})\n`, '')
		})()

		return msg + `\t${player.battle_tag} — ${player.skill_rating_name} (${player.skill_rating})\n${heroes}\n`
	}, '')

	return message
}
