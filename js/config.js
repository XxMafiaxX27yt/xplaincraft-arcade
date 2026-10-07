// Arcade-wide settings. Fill in `supabase` to switch from this-device accounts to online accounts.

export const CONFIG = {
  brand: {
    top: 'ARCADE',
    name: 'NOVEXYT',
    short: 'NOVEXYT ARCADE',
    version: '4.0.0',
  },
  supabase: {
    url: 'https://ptfaeeskjeohklyiupil.supabase.co',
    // publishable key: safe in the browser, every table is protected by row level security (supabase/schema.sql)
    anonKey: 'sb_publishable_FdygXuoBmYGo3JM_48ltBQ_D86faHRV',
  },
  economy: {
    startCoins: 150,
    minRunSec: 8, // runs shorter than this give nothing (stops quit-spam farming)
  },
};
