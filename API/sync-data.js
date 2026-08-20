import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
    try {
        if (req.method === 'GET') {
            // Get game data
            const initData = req.query.initData;
            
            // Validate Telegram initData
            const isValid = validateTelegramInitData(initData);
            if (!isValid) {
                return res.status(401).json({ error: 'Invalid session' });
            }

            const userData = parseUserData(initData);
            const userId = userData.id;

            // Get user data from Supabase
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('telegram_id', userId)
                .single();

            if (error && error.code !== 'PGRST116') {
                return res.status(404).json({ error: 'User not found' });
            }

            return res.status(200).json({
                gameData: data ? {
                    coins: data.coins,
                    bestScore: data.best_score,
                    achievements: data.achievements,
                    gamesPlayed: data.games_played,
                    totalMerges: data.total_merges,
                    bestTileEver: data.best_tile_ever,
                    powerUps: data.power_ups
                } : null
            });

        } else if (req.method === 'POST') {
            // Save game data
            const { initData, gameData } = req.body;
            
            // Validate Telegram initData
            const isValid = validateTelegramInitData(initData);
            if (!isValid) {
                return res.status(401).json({ error: 'Invalid session' });
            }

            const userData = parseUserData(initData);
            const userId = userData.id;

            // Upsert user data
            const { data, error } = await supabase
                .from('users')
                .upsert({
                    telegram_id: userId,
                    coins: gameData.coins,
                    best_score: gameData.bestScore,
                    achievements: gameData.achievements,
                    games_played: gameData.gamesPlayed,
                    total_merges: gameData.totalMerges,
                    best_tile_ever: gameData.bestTileEver,
                    power_ups: gameData.powerUps,
                    username: userData.username || 'User',
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'telegram_id'
                });

            if (error) {
                console.error('Sync error:', error);
                return res.status(500).json({ error: error.message });
            }

            return res.status(200).json({ success: true });

        } else {
            return res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('Sync data error:', error);
        return res.status(500).json({ error: error.message });
    }
}

function validateTelegramInitData(initData) {
    const botToken = process.env.BOT_TOKEN;
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');
    
    const checkString = Array.from(urlParams.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
    
    const secretKey = crypto.createHash('sha256').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');
    
    return calculatedHash === hash;
}

function parseUserData(initData) {
    const urlParams = new URLSearchParams(initData);
    const userParam = urlParams.get('user');
    
    if (!userParam) {
        return { id: 'anonymous' };
    }
    
    try {
        return JSON.parse(userParam);
    } catch (error) {
        return { id: 'anonymous' };
    }
}