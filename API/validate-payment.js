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
        const { initData, transactionId } = req.body;
        
        // Validate Telegram initData
        const isValid = validateTelegramInitData(initData);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid session' });
        }

        // Get transaction from database
        const { data: transaction, error: dbError } = await supabase
            .from('transactions')
            .select('*')
            .eq('id', transactionId)
            .single();

        if (dbError) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        // Update transaction status
        const { error: updateError } = await supabase
            .from('transactions')
            .update({ status: 'completed' })
            .eq('id', transactionId);

        if (updateError) {
            return res.status(500).json({ error: 'Failed to update transaction' });
        }

        return res.status(200).json({
            valid: true,
            transaction: transaction
        });

    } catch (error) {
        console.error('Payment validation error:', error);
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