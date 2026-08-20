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
        const { initData, amount, description, payload } = req.body;
        
        // Validate Telegram initData
        const isValid = validateTelegramInitData(initData);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid session' });
        }

        // Parse user data
        const userData = parseUserData(initData);
        const userId = userData.id;

        // Create invoice using Telegram Bot API
        const botToken = process.env.BOT_TOKEN;
        const telegramResponse = await fetch(
            `https://api.telegram.org/bot${botToken}/createInvoiceLink`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: description,
                    description: `Purchase for 2048 Master`,
                    payload: payload,
                    currency: 'XTR',
                    prices: [{ label: description, amount: amount }],
                    provider_token: '',
                    max_tip_amount: 0,
                    suggested_tip_amounts: [],
                    start_parameter: 'start',
                    need_name: false,
                    need_phone_number: false,
                    need_email: false,
                    need_shipping_address: false
                })
            }
        );

        const telegramData = await telegramResponse.json();

        if (!telegramData.ok) {
            throw new Error(telegramData.description || 'Failed to create invoice');
        }

        // Store pending transaction in Supabase
        const { data: transaction, error: dbError } = await supabase
            .from('transactions')
            .insert({
                user_id: userId,
                invoice_link: telegramData.result,
                payload: payload,
                amount: amount,
                status: 'pending',
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (dbError) {
            console.error('Database error:', dbError);
            // Continue even if database fails, but log the error
        }

        return res.status(200).json({
            invoice_link: telegramData.result,
            transaction_id: transaction?.id,
            success: true
        });

    } catch (error) {
        console.error('Invoice creation error:', error);
        return res.status(500).json({ error: error.message });
    }
}

function validateTelegramInitData(initData) {
    const botToken = process.env.BOT_TOKEN;
    
    // Parse initData
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');
    
    // Sort and create check string
    const checkString = Array.from(urlParams.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
    
    // Create secret key
    const secretKey = crypto
        .createHash('sha256')
        .update(botToken)
        .digest();
    
    // Calculate hash
    const calculatedHash = crypto
        .createHmac('sha256', secretKey)
        .update(checkString)
        .digest('hex');
    
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