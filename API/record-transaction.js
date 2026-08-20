import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { initData, transaction } = req.body;
        
        // Validate Telegram initData
        const isValid = validateTelegramInitData(initData);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid session' });
        }

        // Get user data
        const userData = parseUserData(initData);
        const userId = userData.id;

        // Record transaction
        const { data, error } = await supabase
            .from('transactions')
            .insert({
                user_id: userId,
                transaction_type: transaction.type,
                item_type: transaction.itemType,
                coins: transaction.coins,
                stars: transaction.stars,
                status: 'completed',
                created_at: new Date(transaction.timestamp || Date.now()).toISOString()
            });

        if (error) {
            console.error('Transaction recording error:', error);
            return res.status(500).json({ error: error.message });
        }

        // Update user balance
        if (transaction.type === 'star_purchase') {
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('coins')
                .eq('telegram_id', userId)
                .single();

            if (userError && userError.code !== 'PGRST116') {
                // User doesn't exist, create new user
                const { error: createError } = await supabase
                    .from('users')
                    .insert({
                        telegram_id: userId,
                        coins: transaction.coins,
                        username: parseUserData(initData).username || 'User'
                    });

                if (createError) {
                    console.error('User creation error:', createError);
                }
            } else if (userData) {
                // Update existing user
                const { error: updateError } = await supabase
                    .from('users')
                    .update({ coins: userData.coins + transaction.coins })
                    .eq('telegram_id', userId);

                if (updateError) {
                    console.error('User update error:', updateError);
                }
            }
        }

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('Transaction recording error:', error);
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