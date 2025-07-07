// scripts/fetch-matches.js
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

// تعريف الدوريات الكبرى التي تريد متابعتها (استخدم IDs من api-football)
// مثال:
// 39: Premier League (England)
// 140: La Liga (Spain)
// 960: Saudi League (KSA)
// 203: Super League (Egypt)
// 2: UEFA Champions League
const TARGET_LEAGUE_IDS = [39, 140, 78, 135, 61, 2, 3, 960, 203];
const API_FOOTBALL_URL = 'https://v3.football.api-sports.io';

// هذه الدالة هي قلب السكربت
const runFetch = async () => {
    // قراءة المتغيرات السرية التي سنضعها في GitHub
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
    const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !API_FOOTBALL_KEY) {
        console.error('Error: Environment variables are not set.');
        process.exit(1); // إنهاء السكربت مع خطأ
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    console.log('Successfully connected to Supabase.');

    try {
        const currentYear = new Date().getFullYear();
        let allMatchesToUpsert = [];

        for (const leagueId of TARGET_LEAGUE_IDS) {
            console.log(`Fetching matches for league: ${leagueId}`);
            const response = await fetch(`${API_FOOTBALL_URL}/fixtures?league=${leagueId}&season=${currentYear}&status=NS`, {
                method: 'GET',
                headers: {
                    'x-rapidapi-host': 'v3.football.api-sports.io',
                    'x-rapidapi-key': API_FOOTBALL_KEY,
                },
            });

            if (!response.ok) {
                console.error(`API error for league ${leagueId}: ${response.statusText}`);
                continue;
            }

            const data = await response.json();
            const formattedMatches = data.response.map(fixture => ({
                api_id: fixture.fixture.id,
                team1_name: fixture.teams.home.name,
                team1_logo: fixture.teams.home.logo,
                team2_name: fixture.teams.away.name,
                team2_logo: fixture.teams.away.logo,
                league: fixture.league.name,
                datetime: fixture.fixture.date,
            }));
            allMatchesToUpsert.push(...formattedMatches);
        }

        if (allMatchesToUpsert.length > 0) {
            console.log(`Upserting ${allMatchesToUpsert.length} matches to Supabase...`);
            const { error } = await supabase
                .from('matches')
                .upsert(allMatchesToUpsert, { onConflict: 'api_id', ignoreDuplicates: false });

            if (error) throw error;
            console.log('Matches upserted successfully!');
        } else {
            console.log('No new matches to upsert.');
        }
    } catch (error) {
        console.error('Error during script execution:', error);
        process.exit(1);
    }
};

// تشغيل الدالة
runFetch();
