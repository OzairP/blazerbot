# BlazerBot

A Discord bot written in TypeScript for UAB's Collegiate
Overwatch team.

## Commands

### `.bb summarize \<TESPA TEAM URL\>`
BlazerBot will summarize a team's statistics using the
Overwatch API. Returning information like team average
SR, and individual player summaries including their SR
and top 3 played heroes.

**Example:**
```
.bb summarize https://compete.tespa.org/tournament/111/team/24128
```

**Conditions**
* `TESPA_TEAM_URL` - Must be a valid HTTPS compete.tespa URL with tournament ID `111`.
