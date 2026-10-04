// Arcade-wide settings. Fill in `supabase` to switch from this-device accounts to online accounts.

export const CONFIG = {
  brand: {
    top: "NOVEX × XPLAINCRAFT'S",
    name: 'GAMING ARCADE',
    short: 'XC ARCADE',
    version: '3.0.0',
  },
  supabase: {
    url: '',
    anonKey: '',
  },
  economy: {
    startCoins: 150,
    minRunSec: 8, // runs shorter than this give nothing (stops quit-spam farming)
  },
};
